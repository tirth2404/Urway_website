import os
import pickle

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLE_PATH = os.path.join(BASE_DIR, "mental_wellness_bundle.pkl")


def load_bundle(path):
    with open(path, "rb") as f:
        return pickle.load(f)


app = Flask(__name__)
CORS(app)

bundle = load_bundle(BUNDLE_PATH)
sleep_enc = bundle["sleep_encoder"]
diet_enc = bundle["diet_encoder"]
scaler = bundle["scaler"]
health_bins = np.asarray(bundle["health_bins"], dtype=float)
floor_labels = list(bundle["floor_labels"])
cols = list(bundle["cols"])

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

    row = pd.DataFrame(
        [
            {
                "Sleep_Hours": sleep_hours,
                "Sleep_Quality": sleep_quality,
                "Physical_Activity_Min": activity_min,
                "Diet_Quality": diet_quality,
                "Stress_Level": stress_level,
            }
        ]
    )

    row["Sleep_Quality"] = sleep_enc.transform(row[["Sleep_Quality"]])
    row["Diet_Quality"] = diet_enc.transform(row[["Diet_Quality"]])

    x_scaled = scaler.transform(row[cols].values)

    health_score = (
        x_scaled[0, cols.index("Sleep_Hours")] * 1
        + x_scaled[0, cols.index("Sleep_Quality")] * 2
        + x_scaled[0, cols.index("Diet_Quality")] * 2
        + x_scaled[0, cols.index("Physical_Activity_Min")] * 1
        - x_scaled[0, cols.index("Stress_Level")] * 2
    )

    return float(health_score)


def assign_floor(score):
    floor = pd.cut(
        [score],
        bins=health_bins,
        labels=floor_labels,
        include_lowest=True,
    )[0]

    if pd.isna(floor):
        if score < health_bins[0]:
            return floor_labels[0], 0
        return floor_labels[-1], len(floor_labels) - 1

    floor_idx = floor_labels.index(floor)
    return str(floor), floor_idx


@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True) or {}
    try:
        score = compute_health_score(payload)
        floor_label, floor_num = assign_floor(score)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        return jsonify({"error": "Prediction failed"}), 500

    return jsonify(
        {
            "health_score": round(score, 4),
            "health_floor": floor_label,
            "floor_num": int(floor_num),
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5003, debug=True)
