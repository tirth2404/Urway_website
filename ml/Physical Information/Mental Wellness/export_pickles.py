import os
import pickle

import numpy as np
import pandas as pd
from sklearn.preprocessing import OrdinalEncoder, StandardScaler


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "mental_wellness.csv")

COLS = [
    "Sleep_Hours",
    "Sleep_Quality",
    "Physical_Activity_Min",
    "Diet_Quality",
    "Stress_Level",
]

FLOOR_LABELS = [
    "Floor 0 - At Risk",
    "Floor 1 - Below Average",
    "Floor 2 - Average",
    "Floor 3 - Healthy",
]


def remove_outliers_iqr(df, numeric_cols):
    q1 = df[numeric_cols].quantile(0.25)
    q3 = df[numeric_cols].quantile(0.75)
    iqr = q3 - q1

    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    mask = ~((df[numeric_cols] < lower) | (df[numeric_cols] > upper)).any(axis=1)
    return df[mask].reset_index(drop=True)


def main():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Missing dataset: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    df = df[COLS].drop_duplicates().dropna()

    sleep_enc = OrdinalEncoder()
    diet_enc = OrdinalEncoder()

    df["Sleep_Quality"] = sleep_enc.fit_transform(df[["Sleep_Quality"]])
    df["Diet_Quality"] = diet_enc.fit_transform(df[["Diet_Quality"]])

    df_clean = remove_outliers_iqr(
        df,
        ["Sleep_Hours", "Physical_Activity_Min", "Stress_Level"],
    )

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(df_clean[COLS].values)
    x_scaled_df = pd.DataFrame(x_scaled, columns=COLS)

    health_score = (
        x_scaled_df["Sleep_Hours"] * 1
        + x_scaled_df["Sleep_Quality"] * 2
        + x_scaled_df["Diet_Quality"] * 2
        + x_scaled_df["Physical_Activity_Min"] * 1
        - x_scaled_df["Stress_Level"] * 2
    )

    _, bins = pd.qcut(
        health_score,
        q=4,
        labels=FLOOR_LABELS,
        retbins=True,
    )

    bundle = {
        "sleep_encoder": sleep_enc,
        "diet_encoder": diet_enc,
        "scaler": scaler,
        "health_bins": np.asarray(bins, dtype=float),
        "floor_labels": FLOOR_LABELS,
        "cols": COLS,
    }

    bundle_path = os.path.join(BASE_DIR, "mental_wellness_bundle.pkl")
    with open(bundle_path, "wb") as f:
        pickle.dump(bundle, f)

    print("Saved mental_wellness_bundle.pkl")


if __name__ == "__main__":
    main()
