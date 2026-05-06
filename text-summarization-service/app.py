"""
U'rWay Keyword Extraction Service
===================================
Loads the fine-tuned Flan-T5-small model (saved via save_pretrained) and
exposes a single POST endpoint that accepts a target description and returns
predicted technology keywords as JSON.

Run:
    cd text-summarization-service
    python app.py

Endpoint:
    POST /api/keywords/predict
    Body:  { "description": "<target description text>" }
    Response:
        {
          "description": "<original text>",
          "keywords_raw": "SQL, Python, Pandas, ...",
          "keywords_list": ["SQL", "Python", "Pandas", ...],
          "keyword_count": 3
        }
"""

import os
import pickle
import re

from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
except ImportError:
    AutoTokenizer = None
    AutoModelForSeq2SeqLM = None

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
# The trained model lives one level up in the text-summarization project folder
MODEL_DIR  = os.path.join(
    BASE_DIR, "..", "U'rWay Text Summarization", "models", "u_rway_keyword_model"
)
PICKLE_PATH = os.path.join(MODEL_DIR, "u_rway_keyword_bundle.pkl")

# Default config — will be overridden by the pickle bundle if it exists
BASE_MODEL_NAME = "google/flan-t5-small"
PROMPT_PREFIX   = "extract important technology keywords: "
MAX_INPUT_LEN   = 512
MAX_TARGET_LEN  = 64
FORCE_HF_MODEL  = os.environ.get("FORCE_HF_MODEL", "false").strip().lower() == "true"

# ── Load bundle metadata (if available) ────────────────────────────────────────
if os.path.isfile(PICKLE_PATH):
    print(f"[KeywordService] Loading bundle metadata from {PICKLE_PATH}")
    with open(PICKLE_PATH, "rb") as f:
        BUNDLE = pickle.load(f)
    PROMPT_PREFIX   = BUNDLE.get("prompt_prefix",   PROMPT_PREFIX)
    MAX_INPUT_LEN   = BUNDLE.get("max_input_len",   MAX_INPUT_LEN)
    MAX_TARGET_LEN  = BUNDLE.get("max_target_len",  MAX_TARGET_LEN)
    BASE_MODEL_NAME = BUNDLE.get("model_name",      BASE_MODEL_NAME)
else:
    print("[KeywordService] No pickle bundle found — using defaults.")
    BUNDLE = {}

# ── Resolve model directory ────────────────────────────────────────────────────
# Prefer the local fine-tuned directory if it contains model files.
# Otherwise fall back to downloading the base model from HuggingFace.
saved_model_dir = BUNDLE.get("model_dir", MODEL_DIR)
if not os.path.isdir(saved_model_dir):
    saved_model_dir = MODEL_DIR

# Check if the directory actually has model files (not just the pkl)
_has_model_files = os.path.isdir(saved_model_dir) and any(
    f.endswith((".h5", ".bin", ".safetensors", ".json"))
    for f in os.listdir(saved_model_dir)
    if os.path.isfile(os.path.join(saved_model_dir, f))
)

if _has_model_files and AutoTokenizer is not None and AutoModelForSeq2SeqLM is not None:
    model_source = saved_model_dir
    print(f"[KeywordService] Loading fine-tuned model from: {model_source}")
else:
    model_source = None
    if AutoTokenizer is None or AutoModelForSeq2SeqLM is None:
        print("[KeywordService] transformers is not installed — using lightweight fallback keyword extraction.")
    elif FORCE_HF_MODEL:
        model_source = BASE_MODEL_NAME
        print(f"[KeywordService] Loading base model because FORCE_HF_MODEL=true: {model_source}")
    else:
        print("[KeywordService] Fine-tuned model not found locally — using lightweight fallback keyword extraction.")

# ── Load model + tokenizer ─────────────────────────────────────────────────────
TOKENIZER = None
MODEL = None
if model_source:
    try:
        print(f"[KeywordService] Loading tokenizer …")
        TOKENIZER = AutoTokenizer.from_pretrained(model_source, use_fast=True)

        print(f"[KeywordService] Loading PyTorch model …")
        MODEL = AutoModelForSeq2SeqLM.from_pretrained(model_source)
        print("[KeywordService] Model ready.")
    except (OSError, RuntimeError) as exc:
        print(f"[KeywordService] Model load failed, falling back to lightweight extractor: {exc}")
        TOKENIZER = None
        MODEL = None

# ── Flask app ──────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)


def predict_keywords(description: str) -> str:
    """Run the Flan-T5 model and return a comma-separated keyword string."""
    if TOKENIZER is None or MODEL is None:
        text = str(description).lower()
        vocab = [
            "react", "node js", "node.js", "javascript", "typescript", "html", "css",
            "python", "machine learning", "deep learning", "data science", "sql",
            "mongodb", "flask", "express", "api", "websocket", "git", "github",
            "docker", "tailwind", "vite"
        ]
        matched = []
        for term in vocab:
            if term in text and term not in matched:
                matched.append(term)
        if not matched:
            matched = [token for token in re.split(r"[^a-z0-9+.#-]+", text) if len(token) > 3][:7]
        return ", ".join(matched[:7])

    prompt = PROMPT_PREFIX + str(description).strip()
    encoded = TOKENIZER(
        [prompt],
        max_length=MAX_INPUT_LEN,
        padding="max_length",
        truncation=True,
        return_tensors="pt",
    )
    generated_ids = MODEL.generate(
        input_ids=encoded["input_ids"],
        attention_mask=encoded["attention_mask"],
        max_length=MAX_TARGET_LEN,
        num_beams=4,
        early_stopping=True,
    )
    return TOKENIZER.decode(
        generated_ids[0],
        skip_special_tokens=True,
        clean_up_tokenization_spaces=True,
    )


def normalize_keyword_list(raw: str) -> list[str]:
    """Split the comma-separated output and clean each keyword."""
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    # Deduplicate while preserving order
    seen = set()
    unique = []
    for p in parts:
        key = p.lower()
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "urway-keyword-extractor"})


@app.post("/api/keywords/predict")
def keywords_predict():
    body = request.get_json(silent=True) or {}
    description = str(body.get("description", "")).strip()

    if not description:
        return jsonify({"error": "description is required and must be a non-empty string."}), 400

    keywords_raw  = predict_keywords(description)
    keywords_list = normalize_keyword_list(keywords_raw)

    return jsonify({
        "description":    description,
        "keywords_raw":   keywords_raw,
        "keywords_list":  keywords_list,
        "keyword_count":  len(keywords_list),
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5007))
    print(f"[KeywordService] Running on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
