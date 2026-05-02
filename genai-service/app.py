import os

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS

from router.genai_router import genai_router

load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)

    backend_origin = os.environ.get("BACKEND_ORIGIN", "http://127.0.0.1:5000")
    CORS(
        app,
        origins=[backend_origin, "http://localhost:5000"],
        supports_credentials=True,
    )

    app.register_blueprint(genai_router, url_prefix="/api")

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": "Route not found"}), 404

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": str(e)}), 500

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", "5001"))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"U'rWay GenAI service running on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=debug)
