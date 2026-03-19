from flask import Blueprint, jsonify, request

from service.gemini_service import (
    classify_virtual_cluster,
    generate_exam_questions,
    generate_roadmap,
)

genai_router = Blueprint("genai_router", __name__)


@genai_router.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "genai-service-python"})


@genai_router.route("/cluster", methods=["POST"])
def cluster():
    payload = request.get_json(force=True) or {}
    return jsonify(classify_virtual_cluster(payload))


@genai_router.route("/roadmap", methods=["POST"])
def roadmap():
    payload = request.get_json(force=True) or {}
    return jsonify(generate_roadmap(payload))


@genai_router.route("/exam-questions", methods=["POST"])
def exam_questions():
    payload = request.get_json(force=True) or {}
    source_material = payload.get("sourceMaterial", [])
    profile = payload.get("profile", {})
    return jsonify(generate_exam_questions(source_material, profile))
