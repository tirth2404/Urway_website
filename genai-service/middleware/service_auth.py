import hmac
import os
from functools import wraps

from flask import jsonify, request


def require_service_secret(handler):
    @wraps(handler)
    def wrapper(*args, **kwargs):
        expected_secret = (os.environ.get("SERVICE_SECRET") or "").strip()
        if not expected_secret:
            return jsonify({"error": "SERVICE_SECRET is not configured."}), 500

        received_secret = (request.headers.get("X-Service-Secret") or "").strip()
        if not hmac.compare_digest(received_secret, expected_secret):
            return jsonify({"error": "Unauthorized service request."}), 401

        return handler(*args, **kwargs)

    return wrapper
