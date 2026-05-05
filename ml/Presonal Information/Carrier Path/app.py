import os
import pickle

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLE_PATH = os.path.join(BASE_DIR, "career_path_bundle.pkl")


def load_bundle(path):
    with open(path, "rb") as f:
        return pickle.load(f)


app = Flask(__name__)
CORS(app)

bundle = load_bundle(BUNDLE_PATH)
kmeans = bundle["kmeans"]
scaler = bundle["scaler"]
feature_cols = list(bundle["feature_cols"])
cluster_names = bundle.get("cluster_names", {})


def parse_float(value, field_name):
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a number")


def build_feature_row(payload):
    row = {}
    for col in feature_cols:
        if col not in payload:
            raise ValueError(f"{col} is required")
        row[col] = parse_float(payload[col], col)
    return pd.DataFrame([row], columns=feature_cols)


@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True) or {}
    try:
        row = build_feature_row(payload)
        x_scaled = scaler.transform(row.values)
        cluster_id = int(kmeans.predict(x_scaled)[0])
        cluster_name = cluster_names.get(cluster_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        return jsonify({"error": "Prediction failed"}), 500

    response = {
        "cluster_id": cluster_id,
        "cluster_name": cluster_name,
    }
    return jsonify(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5004, debug=True)
