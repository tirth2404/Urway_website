import os
import json
import isodate
import pandas as pd
import time
import uuid
from pymongo import MongoClient
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime

# =========================================================
# CONFIGURATION
# =========================================================


def load_env_file(env_path):
    """Load simple KEY=VALUE pairs from a .env file into os.environ."""
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("\"").strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_env_file(".env")

MONGO_URI = os.getenv("MONGO_URI")
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

missing_env = [
    name
    for name, value in [
        ("MONGO_URI", MONGO_URI),
        ("CLIENT_ID", CLIENT_ID),
        ("CLIENT_SECRET", CLIENT_SECRET),
    ]
    if not value
]

if missing_env:
    missing_str = ", ".join(missing_env)
    raise RuntimeError(f"Missing required env vars: {missing_str}. Check .env file.")


CLIENT_CONFIG = {
    "installed": {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "redirect_uris": ["http://localhost"]
    }
}

SCOPES = ['https://www.googleapis.com/auth/youtube.readonly']

# Don't connect to MongoDB at startup - only when needed
# This allows --show-users to work without network
db_client = None
db = None


def get_db_connection():
    """Lazy load MongoDB connection only when needed."""
    global db_client, db
    if db_client is None:
        try:
            print("[DB] Connecting to MongoDB (this may take a moment)...")
            # Increased timeouts for better reliability
            db_client = MongoClient(
                MONGO_URI, 
                serverSelectionTimeoutMS=10000,
                connectTimeoutMS=10000,
                socketTimeoutMS=10000,
                retryWrites=True,
                maxPoolSize=1
            )
            # Test the connection
            db_client.admin.command('ping')
            db = db_client.urway_project_db
            print("[DB] [OK] Connected to MongoDB successfully")
        except Exception as e:
            print(f"[DB] [ERROR] Connection failed: {e}")
            db_client = None
            db = None
    return db  # Returns the database object, or None if failed


# Create users directory
if not os.path.exists("users_data"):
    os.makedirs("users_data")


def execute_request_with_retry(request, max_retries=3, backoff_factor=2):
    """Execute API request with retry logic."""
    for attempt in range(max_retries):
        try:
            response = request.execute()
            return response
        except TimeoutError as e:
            if attempt < max_retries - 1:
                wait_time = backoff_factor ** attempt
                print(f"   [TIMEOUT] Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                raise
        except HttpError as e:
            if e.resp.status in [500, 503]:
                if attempt < max_retries - 1:
                    wait_time = backoff_factor ** attempt
                    print(f"   [SERVER_ERROR] Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise
            else:
                raise


def sanitize_email(email):
    """Sanitize email for filename."""
    return email.replace('@', '_at_').replace('.', '_').lower()


def load_all_users_index():
    """Load all users index - preserves ALL previous users."""
    if os.path.exists("all_users_index.json"):
        try:
            with open("all_users_index.json", 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}


def save_all_users_index(index):
    """Save all users index - preserves all existing users."""
    with open("all_users_index.json", 'w') as f:
        json.dump(index, f, indent=2)
    print(f"[OK] Saved all_users_index.json with {len(index)} total users")


def save_to_mongodb_safe(user_email, user_id, user_name, category_time_minutes, videos, files):
    """Safely save user data to MongoDB with comprehensive error handling."""
    print("\n[DB] ====== MONGODB SAVE OPERATION ======")
    print(f"[DB] User: {user_email}")
    print(f"[DB] Videos: {len(videos)}")
    
    try:
        # Get connection
        print("[DB] Step 1: Getting MongoDB connection...")
        db_conn = get_db_connection()
        
        if db_conn is None:
            print("[DB] [ERROR] Failed to get MongoDB connection!")
            return False
        
        print("[DB] [OK] Connection obtained")
        
        # Build record
        print("[DB] Step 2: Building user record...")
        user_record = {
            "user_email": user_email,
            "user_id": user_id,
            "user_name": user_name,
            "category_time_breakdown": category_time_minutes,
            "total_videos": len(videos),
            "files": files,
            "sync_date": datetime.now().isoformat()
        }
        print(f"[DB] [OK] Record built: {len(str(user_record))} bytes")
        
        # Save to MongoDB
        print("[DB] Step 3: Executing MongoDB write...")
        users_collection = db_conn.users
        
        result = users_collection.update_one(
            {"user_email": user_email}, 
            {"$set": user_record}, 
            upsert=True
        )
        
        print(f"[DB] [OK] Write completed")
        print(f"[DB]    - Upserted ID: {result.upserted_id}")
        print(f"[DB]    - Modified Count: {result.modified_count}")
        print(f"[DB]    - Matched Count: {result.matched_count}")
        
        # Verify
        print("[DB] Step 4: Verifying write...")
        verify_doc = users_collection.find_one({"user_email": user_email})
        
        if verify_doc is not None:
            print(f"[DB] [OK] Document verified in MongoDB!")
            print(f"[DB]    - Document ID: {verify_doc.get('_id')}")
            print(f"[DB]    - Total Videos: {verify_doc.get('total_videos')}")
            
            # Get total count
            total = users_collection.count_documents({})
            print(f"[DB] [OK] Total users in collection: {total}")
            print("[DB] ====== SAVE SUCCESSFUL ======\n")
            return True
        else:
            print("[DB] [ERROR] Document not found after write!")
            print("[DB] ====== SAVE FAILED (VERIFICATION) ======\n")
            return False
            
    except Exception as e:
        print(f"[DB] [CRITICAL ERROR] {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        print("[DB] ====== SAVE FAILED (EXCEPTION) ======\n")
        return False


def generate_unique_random_id():
    """Generate a unique random ID for each user login (no reuse between different users)."""
    # Generate completely new random ID each time - ensures different users get different IDs
    random_id = f"user_random_{uuid.uuid4().hex[:16]}"
    print(f"[OK] Generated unique ID for this user: {random_id}")
    return random_id


def display_all_users():
    """Display all registered users."""
    all_users = load_all_users_index()
    if not all_users:
        print("[INFO] No users registered yet")
        return
    
    print("\n[REGISTERED USERS]")
    for i, (email, data) in enumerate(all_users.items(), 1):
        print(f"  {i}. {data['user_name']} ({email})")
        print(f"     Videos: {data['total_videos']}, Time: {data['total_time_minutes']}min")
    print()


def run_sync():
    """
    Fetches ALL YouTube likes, creates separate files for each user.
    Updates common index file and MongoDB.
    Uses Google email as username. Falls back to random ID if email unavailable.
    """
    print(f"\n[START] Starting YouTube Sync...")
    
    # A. Auth Flow
    try:
        flow = InstalledAppFlow.from_client_config(CLIENT_CONFIG, SCOPES)
        creds = flow.run_local_server(port=0)
        youtube = build("youtube", "v3", credentials=creds)
    except Exception as e:
        print(f"[AUTH_ERROR] {e}")
        return

    # B. Get User Email
    print("[EMAIL] Fetching Google Account Email...")
    try:
        user_service = build("oauth2", "v2", credentials=creds)
        user_info = user_service.userinfo().get().execute()
        user_email = user_info.get('email', None)
        if not user_email:
            raise Exception("Email not found in user info")
    except Exception as e:
        print(f"[WARN] Could not fetch email: {e}")
        print(f"[WARN] Generating unique random ID for this user...")
        user_email = generate_unique_random_id()
    
    user_name = user_email  # Use email as the username
    user_id = user_name  # Same as email
    print(f"[EMAIL] User Email: {user_email}")
    email_safe = sanitize_email(user_email)

    # C. Fetch Categories
    print("[CATEGORIES] Fetching YouTube Categories...")
    cat_resp = youtube.videoCategories().list(part="snippet", regionCode="US").execute()
    cat_map = {item['id']: item['snippet']['title'] for item in cat_resp['items']}

    # D. Fetch ALL Likes with Pagination
    print("[FETCHING] Fetching ALL YouTube Likes...")
    videos = []
    request = youtube.videos().list(part="snippet,contentDetails", myRating="like", maxResults=50)
    
    page_count = 0
    while request and page_count < 50:
        page_count += 1
        print(f"   Page {page_count}...")
        
        try:
            response = execute_request_with_retry(request, max_retries=3, backoff_factor=2)
            
            for item in response.get("items", []):
                snippet = item['snippet']
                try:
                    duration_seconds = int(isodate.parse_duration(item['contentDetails'].get('duration')).total_seconds())
                except:
                    duration_seconds = 0
                
                videos.append({
                    "title": snippet['title'],
                    "category": cat_map.get(snippet['categoryId'], "Unknown"),
                    "duration_seconds": duration_seconds
                })
            
            if 'nextPageToken' in response:
                time.sleep(1)
                request = youtube.videos().list(
                    part="snippet,contentDetails", 
                    myRating="like", 
                    maxResults=50,
                    pageToken=response['nextPageToken']
                )
            else:
                break
        except Exception as e:
            print(f"   [ERROR] {e}")
            break
    
    print(f"[OK] Total videos fetched: {len(videos)}")
    
    # E. Group by Category
    category_time = {}
    for video in videos:
        category = video['category']
        duration = video['duration_seconds']
        if category not in category_time:
            category_time[category] = 0
        category_time[category] += duration
    
    category_time_minutes = {
        category: f"{int(seconds / 60)} min" 
        for category, seconds in category_time.items()
    }
    
    print("\n[STATS] Time Spent by Category:")
    for category, time_str in sorted(category_time_minutes.items(), key=lambda x: int(x[1].split()[0]), reverse=True):
        print(f"   {category}: {time_str}")
    
    # F. Create USER-SPECIFIC FILES
    print(f"\n[FILES] Creating files for: {user_email}")
    
    # User JSON
    user_json_file = f"users_data/user_{email_safe}.json"
    user_data = {
        "user_email": user_email,
        "user_id": user_id,
        "user_name": user_name,
        "category_time_breakdown": category_time_minutes,
        "total_videos": len(videos),
        "sync_date": datetime.now().isoformat(),
        "video_count_by_category": {cat: len([v for v in videos if v['category'] == cat]) for cat in category_time}
    }
    
    with open(user_json_file, 'w') as f:
        json.dump(user_data, f, indent=2)
    print(f"[OK] JSON: {user_json_file}")
    
    # User CSV (all videos)
    user_csv_file = f"users_data/user_{email_safe}.csv"
    df_user = pd.DataFrame(videos)
    df_user.to_csv(user_csv_file, index=False)
    print(f"[OK] CSV: {user_csv_file}")
    
    # User Category CSV
    user_category_csv = f"users_data/user_{email_safe}_categories.csv"
    category_rows = [
        {
            "user_email": user_email,
            "user_name": user_name,
            "category": cat,
            "time_spent": time_str,
            "video_count": len([v for v in videos if v['category'] == cat])
        }
        for cat, time_str in category_time_minutes.items()
    ]
    df_categories = pd.DataFrame(category_rows)
    df_categories.to_csv(user_category_csv, index=False)
    print(f"[OK] Categories CSV: {user_category_csv}")
    
    # G. Update ALL USERS INDEX - PRESERVES ALL EXISTING USERS
    print("[INDEX] Loading existing users from index...")
    all_users = load_all_users_index()
    existing_user_count = len(all_users)
    
    print(f"[INDEX] Total users before: {existing_user_count}")
    print(f"[INDEX] Adding/updating user: {user_email}")
    
    all_users[user_email] = {
        "user_id": user_id,
        "user_name": user_name,
        "email_safe": email_safe,
        "json_file": user_json_file,
        "csv_file": user_csv_file,
        "categories_csv": user_category_csv,
        "total_videos": len(videos),
        "total_time_minutes": sum(int(t.split()[0]) for t in category_time_minutes.values()),
        "categories_count": len(category_time),
        "sync_date": datetime.now().isoformat()
    }
    
    print(f"[INDEX] Total users after: {len(all_users)}")
    save_all_users_index(all_users)
    
    # H. Save to MongoDB
    files_dict = {
        "json_file": user_json_file,
        "csv_file": user_csv_file,
        "categories_csv": user_category_csv
    }
    
    db_saved = save_to_mongodb_safe(
        user_email, 
        user_id, 
        user_name, 
        category_time_minutes, 
        videos, 
        files_dict
    )
    
    print(f"\n[OK] SYNC COMPLETE!")
    print(f"[FILES] User data saved in: users_data/user_{email_safe}.*")
    
    # Display all registered users
    display_all_users()
    
    return user_data


if __name__ == "__main__":
    import sys
    
    # Show all registered users if requested
    if len(sys.argv) > 1 and sys.argv[1] == "--show-users":
        print("[VIEWING ALL REGISTERED USERS]")
        display_all_users()
        sys.exit(0)
    
    # Run sync - will use Google email or generate persistent random ID
    run_sync()
