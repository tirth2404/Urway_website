import os
import pickle

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_pickle(path):
    with open(path, "rb") as f:
        return pickle.load(f)

app = Flask(__name__)
CORS(app)

# ==========================================
# 1. Career Recommender Models
# ==========================================
CAREER_DIR = os.path.join(BASE_DIR, "Education Information")
career_bundle = load_pickle(os.path.join(CAREER_DIR, "career_recommender_bundle.pkl"))
rf_model = career_bundle["model"]
skills_mlb = career_bundle["skills_mlb"]
interests_mlb = career_bundle["interests_mlb"]
course_ohe = career_bundle["course_ohe"]
svd = career_bundle["svd"]


def normalize_text(value):
    return str(value).strip().lower()

def split_semicolon(value):
    tokens = [t.strip() for t in normalize_text(value).split(";") if t.strip()]
    return tokens

def map_tokens_to_known(tokens, known_set):
    cleaned = [t for t in tokens if t in known_set]
    if cleaned:
        return cleaned
    if "unknown" in known_set:
        return ["unknown"]
    if "other" in known_set:
        return ["other"]
    return []

def map_category(value, known_set):
    value = normalize_text(value)
    if value in known_set:
        return value
    if "unknown" in known_set:
        return "unknown"
    if "other" in known_set:
        return "other"
    return value

def build_career_feature_vector(payload):
    ug_course = payload.get("ug_course", "")
    ug_specialization = payload.get("ug_specialization", "")
    interests = payload.get("interests", "")
    skills = payload.get("skills", "")
    ug_score_raw = payload.get("ug_score", None)

    if ug_score_raw is None:
        raise ValueError("ug_score is required")

    BAND_MIDPOINTS = {"<50": 40, "50-60": 55, "60-70": 65, "70-80": 75, "80-90": 85, "90+": 95}
    if str(ug_score_raw) in BAND_MIDPOINTS:
        ug_score = float(BAND_MIDPOINTS[str(ug_score_raw)])
    else:
        try:
            ug_score = float(ug_score_raw)
        except (TypeError, ValueError):
            raise ValueError("ug_score must be a number or a valid band like '70-80'")

    skill_tokens = map_tokens_to_known(split_semicolon(skills), set(skills_mlb.classes_))
    interest_tokens = map_tokens_to_known(split_semicolon(interests), set(interests_mlb.classes_))

    course_known = set(course_ohe.categories_[0])
    spec_known = set(course_ohe.categories_[1])

    ug_course = map_category(ug_course, course_known)
    ug_specialization = map_category(ug_specialization, spec_known)

    row = pd.DataFrame([
        {
            "ug_course": ug_course,
            "ug_specialization": ug_specialization,
            "interests": ";".join(interest_tokens),
            "skills": ";".join(skill_tokens),
            "ug_score": str(ug_score),
        }
    ])

    sk_enc = skills_mlb.transform([skill_tokens])
    int_enc = interests_mlb.transform([interest_tokens])
    cs_enc = course_ohe.transform(row[["ug_course", "ug_specialization"]].fillna("unknown"))

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
    return svd.transform(X_full)

@app.route("/api/career/predict", methods=["POST"])
def predict_career():
    payload = request.get_json(silent=True) or {}
    try:
        features = build_career_feature_vector(payload)
        cluster = int(rf_model.predict(features)[0])
        proba = rf_model.predict_proba(features)[0]
        confidence = float(proba[cluster])
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500
    return jsonify({"cluster": cluster, "confidence": round(confidence, 4)})


# ==========================================
# 2. Mental Wellness Models
# ==========================================
WELLNESS_DIR = os.path.join(BASE_DIR, "Physical Information", "Mental Wellness")
wellness_bundle = load_pickle(os.path.join(WELLNESS_DIR, "mental_wellness_bundle.pkl"))
sleep_enc = wellness_bundle["sleep_encoder"]
diet_enc = wellness_bundle["diet_encoder"]
wellness_scaler = wellness_bundle["scaler"]
health_bins = np.asarray(wellness_bundle["health_bins"], dtype=float)
floor_labels = list(wellness_bundle["floor_labels"])
wellness_cols = list(wellness_bundle["cols"])

sleep_map = {str(v).strip().lower(): v for v in sleep_enc.categories_[0]}
diet_map = {str(v).strip().lower(): v for v in diet_enc.categories_[0]}

def normalize_category(value, mapping):
    key = str(value).strip().lower()
    if key in mapping:
        return mapping[key]
    return next(iter(mapping.values()))

def parse_float(value, field_name):
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a number")

def compute_health_score(payload):
    sleep_hours = parse_float(payload.get("Sleep_Hours"), "Sleep_Hours")
    activity_min = parse_float(payload.get("Physical_Activity_Min"), "Physical_Activity_Min")
    stress_level = parse_float(payload.get("Stress_Level"), "Stress_Level")

    sleep_quality = normalize_category(payload.get("Sleep_Quality"), sleep_map)
    diet_quality = normalize_category(payload.get("Diet_Quality"), diet_map)

    row = pd.DataFrame([{
        "Sleep_Hours": sleep_hours,
        "Sleep_Quality": sleep_quality,
        "Physical_Activity_Min": activity_min,
        "Diet_Quality": diet_quality,
        "Stress_Level": stress_level,
    }])

    row["Sleep_Quality"] = sleep_enc.transform(row[["Sleep_Quality"]])
    row["Diet_Quality"] = diet_enc.transform(row[["Diet_Quality"]])

    x_scaled = wellness_scaler.transform(row[wellness_cols].values)

    health_score = (
        x_scaled[0, wellness_cols.index("Sleep_Hours")] * 1
        + x_scaled[0, wellness_cols.index("Sleep_Quality")] * 2
        + x_scaled[0, wellness_cols.index("Diet_Quality")] * 2
        + x_scaled[0, wellness_cols.index("Physical_Activity_Min")] * 1
        - x_scaled[0, wellness_cols.index("Stress_Level")] * 2
    )
    return float(health_score)

def assign_floor(score):
    floor = pd.cut([score], bins=health_bins, labels=floor_labels, include_lowest=True)[0]
    if pd.isna(floor):
        if score < health_bins[0]:
            return floor_labels[0], 0
        return floor_labels[-1], len(floor_labels) - 1
    floor_idx = floor_labels.index(floor)
    return str(floor), floor_idx

@app.route("/api/wellness/predict", methods=["POST"])
def predict_wellness():
    payload = request.get_json(silent=True) or {}
    try:
        score = compute_health_score(payload)
        floor_label, floor_num = assign_floor(score)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500
    return jsonify({
        "health_score": round(score, 4),
        "health_floor": floor_label,
        "floor_num": int(floor_num),
    })


# ==========================================
# 3. Career Path Models
# ==========================================
CAREER_PATH_DIR = os.path.join(BASE_DIR, "Presonal Information", "Carrier Path")
cp_bundle = load_pickle(os.path.join(CAREER_PATH_DIR, "career_path_bundle.pkl"))
cp_kmeans = cp_bundle["kmeans"]
cp_scaler = cp_bundle["scaler"]
cp_feature_cols = list(cp_bundle["feature_cols"])
cp_cluster_names = cp_bundle.get("cluster_names", {})

def build_cp_feature_row(payload):
    row = {}
    for col in cp_feature_cols:
        if col not in payload:
            raise ValueError(f"{col} is required")
        row[col] = parse_float(payload[col], col)
    return pd.DataFrame([row], columns=cp_feature_cols)

@app.route("/api/career_path/predict", methods=["POST"])
def predict_career_path():
    payload = request.get_json(silent=True) or {}
    try:
        row = build_cp_feature_row(payload)
        x_scaled = cp_scaler.transform(row.values)
        cluster_id = int(cp_kmeans.predict(x_scaled)[0])
        cluster_name = cp_cluster_names.get(cluster_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500
    return jsonify({
        "cluster_id": cluster_id,
        "cluster_name": cluster_name,
    })


# ==========================================
# 4. Student Performance Models
# ==========================================
STUDENT_PERF_DIR = os.path.join(BASE_DIR, "Presonal Information", "Student Performance")
sp_bundle = load_pickle(os.path.join(STUDENT_PERF_DIR, "stu_pref_bundle.pkl"))
sp_kmeans = sp_bundle["kmeans"]
sp_scaler = sp_bundle["scaler"]
sp_label_encoders = sp_bundle["label_encoders"]
sp_feature_cols = list(sp_bundle["feature_cols"])
sp_non_constant_mask = np.asarray(sp_bundle["non_constant_mask"], dtype=bool)
sp_cluster_names = sp_bundle.get("cluster_names", {})
sp_bin_cols = list(sp_bundle.get("bin_cols", []))
sp_num_cols = list(sp_bundle.get("num_cols", []))

# Some historical bundles have feature_cols missing "failures" while the scaler
# was fit on 10 columns including failures. Prefer scaler feature names when present.
sp_expected_feature_cols = list(getattr(sp_scaler, "feature_names_in_", [])) or sp_feature_cols

SP_DEFAULTS = {
    "traveltime": 1,
    "studytime": 2,
    "failures": 0,
    "schoolsup": "no",
    "famsup": "no",
    "paid": "no",
    "activities": "no",
    "internet": "yes",
    "freetime": 3,
    "goout": 3,
}

def encode_binary(value, encoder, field_name):
    raw = str(value).strip().lower()
    if raw in {"yes", "y", "true", "1"}:
        raw = "yes"
    elif raw in {"no", "n", "false", "0"}:
        raw = "no"

    classes = [str(c).lower() for c in encoder.classes_]
    if raw not in classes:
        raw = encoder.classes_[0]
    return encoder.transform([raw])[0]

def build_sp_feature_row(payload):
    row = {}
    for col in sp_expected_feature_cols:
        raw_value = payload.get(col, SP_DEFAULTS.get(col))

        if col in sp_bin_cols:
            row[col] = encode_binary(raw_value, sp_label_encoders[col], col)
        elif col in sp_num_cols:
            row[col] = parse_float(raw_value, col)
        else:
            row[col] = parse_float(raw_value, col)
    return pd.DataFrame([row], columns=sp_expected_feature_cols)

@app.route("/api/student_performance/predict", methods=["POST"])
def predict_student_performance():
    payload = request.get_json(silent=True) or {}
    try:
        row = build_sp_feature_row(payload)
        x_scaled = sp_scaler.transform(row.values)
        x_scaled = x_scaled[:, sp_non_constant_mask]
        cluster_id = int(sp_kmeans.predict(x_scaled)[0])
        cluster_name = sp_cluster_names.get(cluster_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500
    return jsonify({"cluster_id": cluster_id, "cluster_name": cluster_name})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5006, debug=True)
