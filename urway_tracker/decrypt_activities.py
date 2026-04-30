#!/usr/bin/env python3
"""
U'rWay Intelligence - Cross-Browser Decryption Tool
Decrypt activities from MongoDB using registration timestamp or master key

Usage (User-specific decryption with registration timestamp):
    python decrypt_activities.py --email your@email.com --registration-timestamp 1706000000000
    python decrypt_activities.py --email your@email.com --registration-timestamp 1706000000000 --export csv
    
Usage (Legacy login timestamp decryption):
    python decrypt_activities.py --email your@email.com --login-timestamp 1706000000000
    
Usage (Master key decryption - Admin only):
    python decrypt_activities.py --master-key --email your@email.com

Note: Registration timestamp is same across all browsers with same email (cross-browser sync)
"""

import sys
import json
import base64
import argparse
import hashlib
from datetime import datetime
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
import pymongo
from pymongo import MongoClient
import csv
from io import StringIO
import requests

class ActivityDecryptor:
    """Decrypt encrypted activities from MongoDB"""
    
    SALT = b"urway_intelligence_salt_v1"
    ITERATIONS = 100000
    
    def __init__(self, email=None, login_timestamp=None, registration_timestamp=None):
        """Initialize decryptor with user credentials or master key"""
        self.email = email
        # Support both legacy loginTimestamp and new registrationTimestamp
        self.login_timestamp = registration_timestamp or login_timestamp
        self.key = None
        
        if email and self.login_timestamp:
            self.key = self._derive_user_key()
    
    def _derive_user_key(self):
        """Derive AES-256 key from email and timestamp (registration or login)"""
        key_material = (self.email + "|" + str(self.login_timestamp)).encode('utf-8')
        
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,  # 256 bits for AES-256
            salt=self.SALT,
            iterations=self.ITERATIONS,
            backend=default_backend()
        )
        
        return kdf.derive(key_material)
    
    def _derive_master_key(self, master_key_timestamp):
        """Derive master key from system timestamp"""
        key_material = ("MASTER_KEY|" + str(master_key_timestamp)).encode('utf-8')
        
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"urway_master_key_salt_v1",
            iterations=self.ITERATIONS,
            backend=default_backend()
        )
        
        return kdf.derive(key_material)
    
    def decrypt_activity(self, encrypted_base64):
        """Decrypt a single activity"""
        if not self.key:
            raise ValueError("No decryption key available")
            
        try:
            # Decode base64
            combined = base64.b64decode(encrypted_base64)
            
            # Extract IV (first 12 bytes)
            iv = combined[:12]
            encrypted_data = combined[12:]
            
            # Decrypt using AES-256-GCM
            cipher = AESGCM(self.key)
            plaintext = cipher.decrypt(iv, encrypted_data, None)
            
            # Parse JSON
            return json.loads(plaintext.decode('utf-8'))
        except Exception as e:
            print(f"❌ Decryption error: {e}", file=sys.stderr)
            return None
    
    @staticmethod
    def compute_user_id(email):
        """Compute userId from email (deterministic hash)"""
        hash_obj = hashlib.sha256(email.encode('utf-8'))
        hash_int = int(hash_obj.hexdigest()[:8], 16)
        return hash_int % 100000000


def connect_mongodb(uri="mongodb://localhost:27017/"):
    """Connect to MongoDB"""
    try:
        client = MongoClient(uri)
        client.admin.command('ping')
        return client
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}", file=sys.stderr)
        sys.exit(1)


def fetch_encrypted_activities(email, login_timestamp=None, use_master_key=False):
    """Fetch encrypted activities from MongoDB"""
    client = connect_mongodb()
    db = client['UrWay_Intelligence']
    collection = db['activities_collection']
    
    query = {"userEmail": email}
    
    if login_timestamp:
        query["loginTimestamp"] = login_timestamp
    
    try:
        activities = list(collection.find(query).sort("date", -1))
        return activities
    except Exception as e:
        print(f"❌ Query failed: {e}", file=sys.stderr)
        return []
    finally:
        client.close()


def get_master_key_from_bridge():
    """Fetch master key status from bridge (admin access)"""
    try:
        response = requests.get("http://localhost:5000/master-key-status")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ Master key fetch failed: {response.text}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"❌ Bridge connection failed: {e}", file=sys.stderr)
        return None


def export_to_csv(activities):
    """Export decrypted activities to CSV format"""
    output = StringIO()
    
    if not activities:
        return "No activities to export"
    
    # Extract field names from first activity
    fieldnames = ['domain', 'title', 'url', 'date', 'startTime', 'endTime', 'duration', 'timestamps']
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    
    writer.writeheader()
    for activity in activities:
        # Flatten timestamps object
        activity_copy = activity.copy()
        if 'timestamps' in activity_copy and isinstance(activity_copy['timestamps'], dict):
            activity_copy['timestamps'] = json.dumps(activity_copy['timestamps'])
        writer.writerow(activity_copy)
    
    return output.getvalue()


def export_to_json(activities):
    """Export decrypted activities to JSON format"""
    return json.dumps(activities, indent=2, default=str)


def main():
    parser = argparse.ArgumentParser(
        description="Decrypt U'rWay Intelligence activities using timestamp or master key"
    )
    parser.add_argument('--email', help='User email address')
    parser.add_argument('--registration-timestamp', type=int, help='Registration timestamp (milliseconds, for cross-browser sync)')
    parser.add_argument('--login-timestamp', type=int, help='Login timestamp (milliseconds, legacy, use --registration-timestamp instead)')
    parser.add_argument('--master-key', action='store_true', help='Use master key for decryption (admin only)')
    parser.add_argument('--export', choices=['json', 'csv'], default='json', help='Export format')
    parser.add_argument('--output', help='Output file (default: stdout)')
    
    args = parser.parse_args()
    
    if not args.email:
        print("❌ Email required", file=sys.stderr)
        sys.exit(1)
    
    # Support both registration and login timestamps
    timestamp_to_use = args.registration_timestamp or args.login_timestamp
    
    if args.master_key:
        print(f"Using master key for decryption of {args.email}", file=sys.stderr)
        
        # Fetch master key info from bridge
        master_key_info = get_master_key_from_bridge()
        if not master_key_info:
            print("Failed to get master key from bridge", file=sys.stderr)
            sys.exit(1)
        
        master_key_timestamp = master_key_info['masterKeyTimestamp']
        print(f"Master key timestamp: {datetime.fromtimestamp(master_key_timestamp/1000).isoformat()}", file=sys.stderr)
        print(f"Remaining master key uses: {master_key_info['usesRemaining']}", file=sys.stderr)
        
        decryptor = ActivityDecryptor()
        decryptor.key = decryptor._derive_master_key(master_key_timestamp)
    else:
        if not timestamp_to_use:
            print("❌ Either --registration-timestamp, --login-timestamp, or --master-key required", file=sys.stderr)
            sys.exit(1)
        
        timestamp_name = "registration" if args.registration_timestamp else "login"
        print(f"Decrypting activities for: {args.email}", file=sys.stderr)
        print(f"{timestamp_name.capitalize()} timestamp: {datetime.fromtimestamp(timestamp_to_use/1000).isoformat()}", file=sys.stderr)
        
        # Support both registration and login timestamps
        decryptor = ActivityDecryptor(args.email, login_timestamp=args.login_timestamp, registration_timestamp=args.registration_timestamp)
    
    # Fetch encrypted activities (use registration timestamp if available, otherwise login timestamp)
    timestamp_for_fetch = args.registration_timestamp or args.login_timestamp if not args.master_key else None
    encrypted_activities = fetch_encrypted_activities(args.email, timestamp_for_fetch)
    
    if not encrypted_activities:
        print("No activities found for this user", file=sys.stderr)
        return
    
    print(f"Found {len(encrypted_activities)} encrypted activities", file=sys.stderr)
    
    # Decrypt all activities
    decrypted_activities = []
    failed = 0
    
    for i, encrypted_doc in enumerate(encrypted_activities):
        encrypted_data = encrypted_doc.get('encryptedData')
        if not encrypted_data:
            print(f"⚠️  Activity {i+1}: No encrypted data found", file=sys.stderr)
            failed += 1
            continue
        
        decrypted = decryptor.decrypt_activity(encrypted_data)
        if decrypted:
            decrypted_activities.append(decrypted)
        else:
            failed += 1
    
    print(f"✓ Successfully decrypted {len(decrypted_activities)} activities ({failed} failed)", file=sys.stderr)
    
    # Export
    if args.export == 'csv':
        output = export_to_csv(decrypted_activities)
    else:
        output = export_to_json(decrypted_activities)
    
    if args.output:
        try:
            with open(args.output, 'w') as f:
                f.write(output)
            print(f"✓ Exported to: {args.output}", file=sys.stderr)
        except Exception as e:
            print(f"❌ Export failed: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print(output)


if __name__ == '__main__':
    main()
