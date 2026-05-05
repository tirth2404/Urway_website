import os
import pickle

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
SKILLS_MLB_PATH = os.path.join(BASE_DIR, "skills_mlb.pkl")
INTERESTS_MLB_PATH = os.path.join(BASE_DIR, "interests_mlb.pkl")
COURSE_OHE_PATH = os.path.join(BASE_DIR, "course_ohe.pkl")
SVD_PATH = os.path.join(BASE_DIR, "svd.pkl")


def load_pickle(path):
    with open(path, "rb") as f:
        return pickle.load(f)

app = Flask(__name__)
CORS(app)

rf_model = load_pickle(MODEL_PATH)
skills_mlb = load_pickle(SKILLS_MLB_PATH)
interests_mlb = load_pickle(INTERESTS_MLB_PATH)
course_ohe = load_pickle(COURSE_OHE_PATH)
svd = load_pickle(SVD_PATH)


def normalize_text(value):
    return str(value).strip().lower()


def split_semicolon(value):
    tokens = [t.strip() for t in normalize_text(value).split(";") if t.strip()]
    return tokens


def map_tokens_to_known(tokens, known_set):
    """Map unknown tokens to a safe fallback; prefer 'unknown', then 'other'."""
    cleaned = [t for t in tokens if t in known_set]
    if cleaned:
        return cleaned
    if "unknown" in known_set:
        return ["unknown"]
    if "other" in known_set:
        return ["other"]
    return []


def map_category(value, known_set):
    """Map unknown categories to a safe fallback; prefer 'unknown', then 'other'."""
    value = normalize_text(value)
    if value in known_set:
        return value
    if "unknown" in known_set:
        return "unknown"
    if "other" in known_set:
        return "other"
    return value


def build_feature_vector(payload):
    ug_course = payload.get("ug_course", "")
    ug_specialization = payload.get("ug_specialization", "")
    interests = payload.get("interests", "")
    skills = payload.get("skills", "")
    ug_score_raw = payload.get("ug_score", None)

    if ug_score_raw is None:
        raise ValueError("ug_score is required")

    # Accept both numeric scores and grade band strings
    BAND_MIDPOINTS = {"<50": 40, "50-60": 55, "60-70": 65, "70-80": 75, "80-90": 85, "90+": 95}
    if str(ug_score_raw) in BAND_MIDPOINTS:
        ug_score = float(BAND_MIDPOINTS[str(ug_score_raw)])
    else:
        try:
            ug_score = float(ug_score_raw)
        except (TypeError, ValueError):
            raise ValueError("ug_score must be a number or a valid band like '70-80'")

    # Normalize and map unseen values
    skill_tokens = map_tokens_to_known(
        split_semicolon(skills), set(skills_mlb.classes_)
    )
    interest_tokens = map_tokens_to_known(
        split_semicolon(interests), set(interests_mlb.classes_)
    )

    course_known = set(course_ohe.categories_[0])
    spec_known = set(course_ohe.categories_[1])

    ug_course = map_category(ug_course, course_known)
    ug_specialization = map_category(ug_specialization, spec_known)

    # Build single-row DataFrame
    row = pd.DataFrame(
        [
            {
                "ug_course": ug_course,
                "ug_specialization": ug_specialization,
                "interests": ";".join(interest_tokens),
                "skills": ";".join(skill_tokens),
                "ug_score": str(ug_score),
            }
        ]
    )

    # Encode
    sk_enc = skills_mlb.transform([skill_tokens])
    int_enc = interests_mlb.transform([interest_tokens])
    cs_enc = course_ohe.transform(
        row[["ug_course", "ug_specialization"]].fillna("unknown")
    )

    score_bin = pd.cut(
        [ug_score],
        bins=[0, 50, 60, 70, 80, 90, 100],
        labels=["<50", "50-60", "60-70", "70-80", "80-90", "90+"],
        include_lowest=True,
    )
    score_enc = pd.get_dummies(
        pd.Categorical(
            score_bin,
            categories=["<50", "50-60", "60-70", "70-80", "80-90", "90+"],
        )
    ).values

    X_full = np.hstack([sk_enc, int_enc, cs_enc, score_enc])
    X_reduced = svd.transform(X_full)

    return X_reduced


@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True) or {}
    try:
        features = build_feature_vector(payload)
        cluster = int(rf_model.predict(features)[0])
        proba = rf_model.predict_proba(features)[0]
        confidence = float(proba[cluster])
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        return jsonify({"error": "Prediction failed"}), 500

    return jsonify({"cluster": cluster, "confidence": round(confidence, 4)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)
