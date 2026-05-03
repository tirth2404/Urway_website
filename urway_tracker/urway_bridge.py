from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient, errors

from datetime import datetime

import logging
import os
import hashlib
import json
import requests
from logging.handlers import RotatingFileHandler
from urllib.parse import urlparse

# Configure logging first so startup/env issues are visible in both console and file.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["*"]}})

def load_local_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k and v and os.environ.get(k) is None:
                    os.environ[k] = v
        logger.info('Loaded .env variables')
    except Exception as e:
        logger.warning('Could not load .env: %s', e)


load_local_env()

# Read after load_local_env() so the .env value is picked up correctly
URWAY_BACKEND_URL = os.environ.get("URWAY_BACKEND_URL", "http://localhost:5000")

# Add File Handler
file_handler = RotatingFileHandler('bridge.log', maxBytes=1024*1024, backupCount=5)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)
logger.setLevel(logging.INFO)


# MongoDB Setup
try:
    MONGO_URI = os.environ.get("MONGO_URI")
    DB_NAME = os.environ.get("DB_NAME", "urway")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # Verify connection
    client.admin.command('ping')
    logger.info("Connected to MongoDB")
except Exception as e:
    logger.error(f"MongoDB Connection Failed: {e}")
    client = None

# Initialize DB references if client connected
if client:
    db = client[DB_NAME]
    activities_collection = db["chrome_activity"]   # Chrome extension browser activity

    # Ensure indexes for efficient queries
    try:
        activities_collection.create_index([('date', 1)])
        activities_collection.create_index([('registrationTimestamp', 1), ('date', 1)])
        activities_collection.create_index([('userEmail', 1)])
        activities_collection.create_index([('siteKey', 1)])
        logger.info("Indexes ensured on chrome_activity collection")
    except Exception as e:
        logger.warning(f"Could not create indexes: {e}")
else:
    db = None
    activities_collection = None


def resolve_user_id(email: str) -> str | None:
    """
    Resolve a Google email to the canonical userId (UUID) from the main backend.
    Returns the UUID string if found, None if the user hasn't signed up on the website.
    """
    try:
        import urllib.request
        import urllib.parse
        encoded = urllib.parse.quote(email, safe='')
        url = f"{URWAY_BACKEND_URL}/api/auth/resolve/{encoded}"
        req = urllib.request.Request(url, method='GET')
        req.add_header('Content-Type', 'application/json')
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                import json as _json
                data = _json.loads(resp.read().decode())
                if data.get('found'):
                    return data.get('userId')
    except Exception as e:
        logger.warning(f"[resolve_user_id] Could not resolve email '{email}': {e}")
    return None


def get_or_create_registration_timestamp(email):
    """
    Get user's canonical registration timestamp.
    
    Looks up from the earliest chrome_activity document for this email.
    If no activity exists yet (first-ever sync), generates a fresh timestamp.
    This means NO separate users collection is needed — the timestamp lives
    inside chrome_activity itself.
    """
    if activities_collection is None:
        return int(datetime.utcnow().timestamp() * 1000)

    try:
        # Find the very first chrome_activity doc for this email (canonical timestamp)
        existing = activities_collection.find_one(
            {"userEmail": email, "registrationTimestamp": {"$exists": True, "$ne": None}},
            sort=[("createdAt", 1)]  # earliest doc = original registration
        )
        if existing and existing.get("registrationTimestamp"):
            return existing["registrationTimestamp"]
    except Exception as e:
        logger.warning(f"[get_or_create_registration_timestamp] Lookup failed for '{email}': {e}")

    # First-time user — generate a fresh timestamp
    # This will be stored in the first chrome_activity document we create.
    return int(datetime.utcnow().timestamp() * 1000)




@app.route('/register-or-get-user', methods=['POST'])
def register_or_get_user():
    """Get user's registration timestamp (for cross-browser sync)"""
    
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({"error": "Email required"}), 400
        
        # Get or create (atomic) user with registration timestamp
        registration_timestamp = get_or_create_registration_timestamp(email)
        
        return jsonify({
            "status": "success",
            "email": email,
            "registrationTimestamp": registration_timestamp,
            "message": "Use this timestamp for encryption across all browsers"
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Registration error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    if client:
        try:
            client.admin.command('ping')
            return jsonify({
                "status": "healthy",
                "database": "connected",
                "encryption": "enabled (time-based)",
            }), 200
        except Exception as e:
            return jsonify({"status": "unhealthy", "error": str(e)}), 503
    return jsonify({"status": "unhealthy", "error": "MongoDB not connected"}), 503


@app.route('/sync', methods=['POST'])
def sync_data():
    """Receive encrypted activity segment and persist per-site segments with totals"""
    
    if activities_collection is None:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        data = request.get_json()
        if not data:
            logger.warning("⚠ Received empty data in /sync request")
            return jsonify({"error": "No data provided"}), 400

        user_email = data.get('userEmail')
        if not user_email:
            return jsonify({"error": "userEmail required"}), 400

        # Determine metadata (domain/title/url) from payload or from unencrypted fallback
        domain = data.get('domain') or (data.get('unencryptedData') and data.get('unencryptedData').get('domain'))
        title = data.get('title') or (data.get('unencryptedData') and data.get('unencryptedData').get('title'))
        url = data.get('url') or (data.get('unencryptedData') and data.get('unencryptedData').get('url'))
        date = data.get('date')
        timestamps = data.get('timestamps') or (data.get('unencryptedData') and data.get('unencryptedData').get('timestamps')) or {}
        duration = data.get('duration') or timestamps.get('duration') or 0

        logger.info(f"📥 Received sync segment for: {user_email} domain={domain} title={title} date={date} duration={duration}")

        # Get or create registration timestamp (cross-browser keying for encryption)
        registration_timestamp = get_or_create_registration_timestamp(user_email)

        # Resolve Google email → canonical userId (UUID) from the main U'rWay backend.
        # Falls back to None if user hasn't signed up on the website yet.
        canonical_user_id = resolve_user_id(user_email)

        # Build a canonical site key to store one document per site per date
        site_identifier = (domain or '') + "|" + (title or url or '')
        site_key = hashlib.sha256(site_identifier.encode('utf-8')).hexdigest()

        # Build the segment object (store encryptedData OR unencryptedData inside the segment)
        segment = {
            "startTimestamp": timestamps.get('startTimestamp'),
            "endTimestamp": timestamps.get('endTimestamp'),
            "duration": duration,
            "createdAt": datetime.utcnow()
        }
        if data.get('encryptedData') is not None:
            segment['encryptedData'] = data.get('encryptedData')
            segment['encrypted'] = True
        else:
            segment['unencryptedData'] = data.get('unencryptedData')
            segment['encrypted'] = False

        # Upsert per-site document and append segment if not duplicate
        query = {
            "userEmail": user_email,
            "registrationTimestamp": registration_timestamp,
            "date": date,
            "siteKey": site_key
        }

        existing_doc = activities_collection.find_one(query)

        if existing_doc:
            segments = existing_doc.get('segments', [])
            # If the last segment has the same startTimestamp, extend it instead of appending a new segment
            if segments and segments[-1].get('startTimestamp') == segment.get('startTimestamp'):
                last = segments[-1]
                last_duration = last.get('duration') or 0
                delta = segment.get('duration', 0) - last_duration
                # Use arrayFilters to update the matching last segment
                set_fields = {
                    "segments.$[last].endTimestamp": segment.get('endTimestamp'),
                    "segments.$[last].duration": segment.get('duration'),
                    "lastUpdated": datetime.utcnow()
                }
                # Backfill userId if it was null when document was first created
                if canonical_user_id and not existing_doc.get('userId'):
                    set_fields["userId"] = canonical_user_id
                activities_collection.update_one(query, {
                    "$set": set_fields,
                    "$inc": {"totalDuration": delta}
                }, array_filters=[{"last.startTimestamp": last.get('startTimestamp')}])
                message = "Extended last segment for ongoing site visit"
            else:
                activities_collection.update_one(query, {
                    "$push": {"segments": segment},
                    "$inc": {"totalDuration": duration},
                    "$set": {
                        "lastUpdated": datetime.utcnow(),
                        # Backfill userId if the document was created before the user registered on the website
                        **({"userId": canonical_user_id} if canonical_user_id and not existing_doc.get("userId") else {})
                    }
                })
                message = "Appended new segment to existing site document"
        else:
            doc = {
                "userEmail": user_email,
                "userId": canonical_user_id,   # canonical UUID from website (None if not registered)
                "registrationTimestamp": registration_timestamp,
                "date": date,
                "domain": domain,
                "title": title,
                "url": url,
                "siteKey": site_key,
                "segments": [segment],
                "totalDuration": duration,
                "createdAt": datetime.utcnow(),
                "lastUpdated": datetime.utcnow()
            }
            activities_collection.insert_one(doc)
            message = "Created new site document with initial segment"

        logger.info(f"✅ Sync handled: {message} for {user_email} ({domain})")

        return jsonify({
            "status": "success",
            "message": message,
            "userEmail": user_email,
            "siteKey": site_key,
            "date": date,
            "duration": duration
        }), 200

    except errors.PyMongoError as e:
        logger.error(f"MongoDB Error: {e}")
        return jsonify({"error": "Database error", "details": str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected Error: {e}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500



@app.route('/activities', methods=['GET'])
def get_activities():
    """
    Retrieve encrypted activities (cross-browser consolidated)
    Query params:
    - userEmail: specific user's activities (all browsers with same email)
    - date: specific date
    - masterKey: use master key for decryption (returns decryption hint)
    """
    
    if activities_collection is None:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        query = {}
        
        # Filter by user email (required for user-specific retrieval)
        # This will return activities from ALL browsers using this email
        user_email = request.args.get('userEmail')
        if user_email:
            query['userEmail'] = user_email
            
            # Get the registration timestamp for this email
            registration_timestamp = get_or_create_registration_timestamp(user_email)
            # Query by registration timestamp (cross-browser sync)
            query['registrationTimestamp'] = registration_timestamp
        
        # Filter by date
        date_filter = request.args.get('date')
        if date_filter:
            query['date'] = date_filter
        
        # Check for master key request
        master_key_requested = request.args.get('masterKey') == 'true'
        
        if master_key_requested:
            # Verify master key access (would be restricted in production)
            logger.warning("Master key access requested - ensure this is authorized")
            master_key = get_or_create_master_key()
            if master_key:
                decrement_master_key_use(master_key['keyId'])
                activities = list(activities_collection.find(query).sort("date", -1))
                return jsonify({
                    "status": "success",
                    "decryptionMethod": "master_key",
                    "masterKeyTimestamp": master_key['keyTimestamp'],
                    "usesRemaining": master_key['usesRemaining'] - 1,
                    "activities": activities
                }), 200
        
        # Regular user-specific retrieval (per-site documents with segments)
        docs = list(activities_collection.find(query, {'_id': 0, 'segments': 1, 'domain': 1, 'title':1, 'url':1, 'date':1, 'totalDuration':1}).sort("date", -1))
        sites = []
        total_browser_duration = 0
        for d in docs:
            d.pop('_id', None)
            site = {
                "domain": d.get('domain'),
                "title": d.get('title'),
                "url": d.get('url'),
                "date": d.get('date'),
                "totalDuration": d.get('totalDuration', 0),
                "segments": d.get('segments', [])
            }
            total_browser_duration += site['totalDuration']
            sites.append(site)

        return jsonify({
            "status": "success",
            "count": len(sites),
            "decryptionMethod": "user_registration_timestamp",
            "crossBrowserConsolidated": user_email is not None,
            "message": "Cross-browser consolidated activities" if user_email else "Activities retrieved",
            "totalBrowserDuration": total_browser_duration,
            "sites": sites
        }), 200
        
    except Exception as e:
        logger.error(f"Query Error: {e}")
        return jsonify({"error": f"Query error: {str(e)}"}), 500


@app.route('/history', methods=['GET'])
def get_history():
    """
    Return a summary of all dates with total browsing time per date.
    Query params:
    - userEmail (required)
    """
    if activities_collection is None:
        return jsonify({"error": "Database not available"}), 503

    try:
        user_email = request.args.get('userEmail')
        if not user_email:
            return jsonify({"error": "userEmail required"}), 400

        registration_timestamp = get_or_create_registration_timestamp(user_email)

        pipeline = [
            {"$match": {"userEmail": user_email, "registrationTimestamp": registration_timestamp}},
            {"$group": {
                "_id": "$date",
                "totalDuration": {"$sum": "$totalDuration"},
                "siteCount": {"$sum": 1}
            }},
            {"$sort": {"_id": -1}}
        ]

        results = list(activities_collection.aggregate(pipeline))
        days = []
        for r in results:
            days.append({
                "date": r['_id'],
                "totalDuration": r['totalDuration'],
                "siteCount": r['siteCount']
            })

        return jsonify({
            "status": "success",
            "days": days
        }), 200

    except Exception as e:
        logger.error(f"History query error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/github/exchange', methods=['POST'])
def github_exchange():
    """Exchange GitHub OAuth code for access token and return primary email"""
    try:
        data = request.get_json() or {}
        code = data.get('code')
        redirect_uri = data.get('redirect_uri')
        if not code:
            return jsonify({'error': 'code required'}), 400

        GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID')
        GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET')
        if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
            logger.error('GitHub client id/secret not configured in environment')
            return jsonify({'error': 'Server GitHub credentials not configured'}), 500

        token_url = 'https://github.com/login/oauth/access_token'
        headers = {'Accept': 'application/json'}
        payload = {
            'client_id': GITHUB_CLIENT_ID,
            'client_secret': GITHUB_CLIENT_SECRET,
            'code': code,
        }
        if redirect_uri:
            payload['redirect_uri'] = redirect_uri

        token_resp = requests.post(token_url, data=payload, headers=headers, timeout=10)
        if token_resp.status_code != 200:
            logger.error('GitHub token endpoint returned %s %s', token_resp.status_code, token_resp.text)
            return jsonify({'error': 'Failed to exchange code', 'details': token_resp.text}), 502

        token_json = token_resp.json()
        access_token = token_json.get('access_token')
        if not access_token:
            logger.error('No access_token in GitHub response: %s', token_json)
            return jsonify({'error': 'No access_token returned by GitHub'}), 502

        # Fetch user profile
        user_resp = requests.get('https://api.github.com/user', headers={'Authorization': f'token {access_token}', 'Accept': 'application/vnd.github.v3+json'}, timeout=10)
        if user_resp.status_code != 200:
            logger.error('GitHub /user returned %s %s', user_resp.status_code, user_resp.text)
            return jsonify({'error': 'Failed to fetch GitHub user', 'details': user_resp.text}), 502
        user_json = user_resp.json()
        email = user_json.get('email')

        # If email not public, fetch primary email from /user/emails
        if not email:
            emails_resp = requests.get('https://api.github.com/user/emails', headers={'Authorization': f'token {access_token}', 'Accept': 'application/vnd.github.v3+json'}, timeout=10)
            if emails_resp.status_code == 200:
                emails = emails_resp.json()
                # Find primary and verified email
                primary = next((e for e in emails if e.get('primary') and e.get('verified')), None)
                if not primary:
                    # fallback to first verified email
                    primary = next((e for e in emails if e.get('verified')), None)
                if primary:
                    email = primary.get('email')

        if not email:
            logger.error('Could not determine email for GitHub user: %s', user_json)
            return jsonify({'error': 'No email available from GitHub account'}), 502

        # Success: return email and basic profile
        return jsonify({'status': 'success', 'email': email, 'user': user_json}), 200

    except Exception as e:
        logger.exception('GitHub exchange error')
        return jsonify({'error': 'Server error', 'details': str(e)}), 500




@app.route('/clear-day', methods=['POST'])
def clear_day():
    """Clear activities for a specific date"""
    
    if activities_collection is None:
        return jsonify({"error": "Database not available"}), 503
    
    try:
        user_email = request.json.get('userEmail') if request.json else None
        if not user_email:
            return jsonify({"error": "userEmail required"}), 400
        
        from datetime import datetime
        today = datetime.now().strftime("%m/%d/%Y")
        
        result = activities_collection.delete_many({
            "userEmail": user_email,
            "date": today
        })
        
        logger.info(f"Cleared {result.deleted_count} activities for {user_email} on {today}")
        return jsonify({
            "status": "success",
            "deleted_count": result.deleted_count
        }), 200
        
    except Exception as e:
        logger.error(f"Error clearing day: {e}")
        return jsonify({"error": str(e)}), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal Server Error: {error}")
    return jsonify({"error": "Internal server error"}), 500


if __name__ == '__main__':
    BRIDGE_HOST = os.environ.get("BRIDGE_HOST", "127.0.0.1")
    BRIDGE_PORT = int(os.environ.get("BRIDGE_PORT", "5002"))
    FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"

    print("\n" + "="*50)
    print("🚀 U'rWay Intelligence Bridge Starting...")
    print("="*50)
    print(f"📍 Running on http://{BRIDGE_HOST}:{BRIDGE_PORT}")
    print(f"📂 Database: {DB_NAME}.chrome_activity")

    print(f"🔌 CORS: Enabled for all origins")
    print("\nEndpoints:")
    print("  POST   /sync           - Receive activity pulses")
    print("  GET    /activities     - Retrieve today's activities")
    print("  POST   /clear-day      - Clear activities for date")
    print("  GET    /health         - Health check")
    print("="*50 + "\n")
    app.run(host=BRIDGE_HOST, port=BRIDGE_PORT, debug=FLASK_DEBUG, use_reloader=False)
