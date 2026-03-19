import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from router.genai_router import genai_router

load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)

    backend_origin = os.environ.get("BACKEND_ORIGIN", "http://127.0.0.1:5000")
    CORS(app, origins=[backend_origin, "http://localhost:5000"], supports_credentials=True)

    app.register_blueprint(genai_router, url_prefix="/api")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5001")), debug=True)
