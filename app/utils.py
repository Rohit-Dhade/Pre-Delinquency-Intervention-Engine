import joblib
import pandas as pd

from app.schemas import PredictionRequest

# ── Load expected feature names from training artefact ────────────────────────
EXPECTED_FEATURES = joblib.load("model_feature_names.joblib").tolist()


def build_dataframe(req: PredictionRequest) -> pd.DataFrame:
    """
    Convert the request into a single-row DataFrame whose columns exactly
    match the model's training schema (including one-hot encoded categoricals).
    """
    data = req.model_dump()

    # Pop identifiers & raw categoricals – they aren't direct model inputs
    data.pop("customer_id", None)
    data.pop("date", None)
    customer_segment = data.pop("customer_segment")
    geography = data.pop("geography")
    risk_cohort = data.pop("risk_cohort")

    # Build a single-row DataFrame with numeric features
    df = pd.DataFrame([data])

    # One-hot encode the categorical features to match training schema
    # Training used pd.get_dummies which creates columns like:
    #   customer_segment_salaried, customer_segment_self_employed
    #   geography_rural, geography_tier2
    #   risk_cohort_moderate, risk_cohort_stable
    cat_cols = {
        "customer_segment": customer_segment,
        "geography": geography,
        "risk_cohort": risk_cohort,
    }
    for col_prefix, value in cat_cols.items():
        for feat in EXPECTED_FEATURES:
            if feat.startswith(f"{col_prefix}_"):
                category = feat[len(col_prefix) + 1:]
                df[feat] = 1.0 if value == category else 0.0

    # Reindex to the exact feature order the model expects; fill missing with 0
    df = df.reindex(columns=EXPECTED_FEATURES, fill_value=0.0)

    return df
