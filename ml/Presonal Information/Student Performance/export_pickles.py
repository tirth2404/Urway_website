import os
import pickle

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import LabelEncoder, StandardScaler


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "stu_perf.csv")

BEST_K = 5
RANDOM_STATE = 42

BIN_COLS = ["schoolsup", "famsup", "paid", "activities", "internet"]
NUM_COLS = ["traveltime", "studytime", "failures", "freetime", "goout"]
FEATURE_COLS = [
    "traveltime",
    "studytime",
    "failures",
    "schoolsup",
    "famsup",
    "paid",
    "activities",
    "internet",
    "freetime",
    "goout",
]

CLUSTER_NAMES = {
    0: "Supported Studiers",
    1: "Offline Independents",
    2: "School-Supported",
    3: "Connected Achievers",
    4: "Casual Learners",
}


def remove_outliers_iqr(df, numeric_cols):
    q1 = df[numeric_cols].quantile(0.25)
    q3 = df[numeric_cols].quantile(0.75)
    iqr = q3 - q1

    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    mask = ~((df[numeric_cols] < lower) | (df[numeric_cols] > upper)).any(axis=1)
    return df[mask].copy()


def main():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Missing dataset: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    if "Unnamed: 0" in df.columns:
        df = df.drop(columns=["Unnamed: 0"])

    label_encoders = {}
    for col in BIN_COLS:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col])
        label_encoders[col] = le

    df_clean = remove_outliers_iqr(df, NUM_COLS)

    x = df_clean[FEATURE_COLS]
    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(x)

    stds = x_scaled.std(axis=0)
    non_constant = stds != 0
    x_scaled = x_scaled[:, non_constant]
    feature_cols = [f for f, keep in zip(FEATURE_COLS, non_constant) if keep]

    kmeans = KMeans(
        n_clusters=BEST_K,
        init="k-means++",
        n_init=50,
        random_state=RANDOM_STATE,
    )
    kmeans.fit(x_scaled)

    bundle = {
        "kmeans": kmeans,
        "scaler": scaler,
        "label_encoders": label_encoders,
        "feature_cols": feature_cols,
        "non_constant_mask": non_constant,
        "cluster_names": CLUSTER_NAMES,
        "bin_cols": BIN_COLS,
        "num_cols": NUM_COLS,
    }

    bundle_path = os.path.join(BASE_DIR, "stu_pref_bundle.pkl")
    with open(bundle_path, "wb") as f:
        pickle.dump(bundle, f)

    print("Saved stu_pref_bundle.pkl")


if __name__ == "__main__":
    main()
