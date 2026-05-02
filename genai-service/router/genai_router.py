from flask import Blueprint, jsonify, request

from middleware.service_auth import require_service_secret
from service.gemini_service import (
    classify_virtual_cluster,
    generate_exam_questions,
    generate_roadmap,
)

genai_router = Blueprint("genai_router", __name__)


@genai_router.route("/health", methods=["GET"])
def health():
    # Public — used by uptime monitors / load balancers only
    return jsonify({"status": "ok", "service": "urway-genai-service"})


@genai_router.route("/cluster", methods=["POST"])
@require_service_secret
def cluster():
    payload = request.get_json(force=True, silent=True) or {}
    try:
        result = classify_virtual_cluster(payload)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@genai_router.route("/roadmap", methods=["POST"])
@require_service_secret
def roadmap():
    payload = request.get_json(force=True, silent=True) or {}
    try:
        result = generate_roadmap(payload)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@genai_router.route("/exam-questions", methods=["POST"])
@require_service_secret
def exam_questions():
    payload        = request.get_json(force=True, silent=True) or {}
    source_material = payload.get("sourceMaterial", [])
    profile        = payload.get("profile", {})
    try:
        result = generate_exam_questions(source_material, profile)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
