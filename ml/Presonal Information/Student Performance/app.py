import os
import pickle

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLE_PATH = os.path.join(BASE_DIR, "stu_pref_bundle.pkl")


def load_bundle(path):
    with open(path, "rb") as f:
        return pickle.load(f)


app = Flask(__name__)
CORS(app)

bundle = load_bundle(BUNDLE_PATH)
kmeans = bundle["kmeans"]
scaler = bundle["scaler"]
label_encoders = bundle["label_encoders"]
feature_cols = list(bundle["feature_cols"])
non_constant_mask = np.asarray(bundle["non_constant_mask"], dtype=bool)
cluster_names = bundle.get("cluster_names", {})
bin_cols = list(bundle.get("bin_cols", []))
num_cols = list(bundle.get("num_cols", []))


def parse_float(value, field_name):
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a number")


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


def build_feature_row(payload):
    row = {}
    for col in feature_cols:
        if col not in payload:
            raise ValueError(f"{col} is required")

        if col in bin_cols:
            row[col] = encode_binary(payload[col], label_encoders[col], col)
        elif col in num_cols:
            row[col] = parse_float(payload[col], col)
        else:
            row[col] = parse_float(payload[col], col)

    return pd.DataFrame([row], columns=feature_cols)


@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True) or {}
    try:
        row = build_feature_row(payload)
        x_scaled = scaler.transform(row.values)
        x_scaled = x_scaled[:, non_constant_mask]
        cluster_id = int(kmeans.predict(x_scaled)[0])
        cluster_name = cluster_names.get(cluster_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        return jsonify({"error": "Prediction failed"}), 500

    return jsonify({"cluster_id": cluster_id, "cluster_name": cluster_name})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005, debug=True)
