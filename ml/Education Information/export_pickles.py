import os
import pickle

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import MultiLabelBinarizer, OneHotEncoder


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "new_clean_caeer_recommender.csv")

BEST_K = 10
SVD_COMPONENTS = 50
RANDOM_STATE = 42


def split_semicolon(series, fillna="unknown"):
    """Split semicolon-delimited text into lists of stripped lowercase tokens."""
    return (
        series.fillna(fillna)
        .astype(str)
        .str.lower()
        .str.split(";")
        .apply(lambda tokens: [t.strip() for t in tokens if t.strip()])
    )


def build_features(df):
    """Create the full feature matrix and fitted preprocessors."""
    df = df.copy()

    # Skills / interests multi-hot
    skills_mlb = MultiLabelBinarizer()
    interests_mlb = MultiLabelBinarizer()

    skills_enc = skills_mlb.fit_transform(split_semicolon(df["skills"]))
    interests_enc = interests_mlb.fit_transform(split_semicolon(df["interests"]))

    # Course + specialization OHE
    course_ohe = OneHotEncoder(sparse_output=False, handle_unknown="ignore")
    course_spec_enc = course_ohe.fit_transform(
        df[["ug_course", "ug_specialization"]].fillna("unknown")
    )

    # UG score binning
    df["ug_score_num"] = pd.to_numeric(df["ug_score"], errors="coerce")
    median_score = df["ug_score_num"].median()
    score_clean = df["ug_score_num"].fillna(median_score).astype(float)

    score_binned = pd.cut(
        score_clean,
        bins=[0, 50, 60, 70, 80, 90, 100],
        labels=["<50", "50-60", "60-70", "70-80", "80-90", "90+"],
        include_lowest=True,
    )
    score_enc = pd.get_dummies(score_binned, prefix="score").values

    X_full = np.hstack([skills_enc, interests_enc, course_spec_enc, score_enc])

    return X_full, skills_mlb, interests_mlb, course_ohe


def main():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Missing dataset: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    X_full, skills_mlb, interests_mlb, course_ohe = build_features(df)

    # Dimensionality reduction
    svd = TruncatedSVD(n_components=SVD_COMPONENTS, random_state=RANDOM_STATE)
    X_reduced = svd.fit_transform(X_full)

    # Cluster then train RF on cluster labels
    kmeans = KMeans(n_clusters=BEST_K, n_init=30, random_state=RANDOM_STATE)
    cluster_labels = kmeans.fit_predict(X_reduced)

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    rf.fit(X_reduced, cluster_labels)

    # Save a single bundle pickle
    bundle = {
        "model": rf,
        "skills_mlb": skills_mlb,
        "interests_mlb": interests_mlb,
        "course_ohe": course_ohe,
        "svd": svd,
    }

    bundle_path = os.path.join(BASE_DIR, "career_recommender_bundle.pkl")
    with open(bundle_path, "wb") as f:
        pickle.dump(bundle, f)
    print("Saved career_recommender_bundle.pkl")


if __name__ == "__main__":
    main()
