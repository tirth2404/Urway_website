import os
import pickle

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "career_path.csv")

BEST_K = 4
RANDOM_STATE = 42

CLUSTER_NAMES = {
    0: "Presenters",
    1: "Leaders & Team Players",
    2: "Communicators",
    3: "Project-Driven Builders",
}


def main():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Missing dataset: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    if "Unnamed: 0" in df.columns:
        df = df.drop(columns=["Unnamed: 0"])

    feature_cols = df.columns.tolist()

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(df.values)

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
        "feature_cols": feature_cols,
        "cluster_names": CLUSTER_NAMES,
    }

    bundle_path = os.path.join(BASE_DIR, "career_path_bundle.pkl")
    with open(bundle_path, "wb") as f:
        pickle.dump(bundle, f)

    print("Saved career_path_bundle.pkl")


if __name__ == "__main__":
    main()
