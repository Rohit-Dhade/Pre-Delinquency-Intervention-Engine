import joblib
import numpy as np
import pandas as pd
import shap

from app.schemas import PredictionRequest

# ── Load expected feature names from training artefact ────────────────────────
EXPECTED_FEATURES = joblib.load("model_feature_names.joblib").tolist()

# ── Human-readable labels for model features ─────────────────────────────────
FEATURE_LABELS: dict[str, str] = {
    "credit_score": "Credit Score",
    "emi_to_income_ratio": "EMI-to-Income Ratio",
    "salary_delay_days": "Salary Delay (days)",
    "savings_decline_pct": "Savings Decline (%)",
    "income_drop_pct": "Income Drop (%)",
    "credit_utilization_ratio": "Credit Utilization Ratio",
    "failed_autodebit_count": "Failed Auto-Debit Count",
    "missed_payments_last_6m": "Missed Payments (last 6 months)",
    "discretionary_spend_drop_pct": "Discretionary Spending Drop (%)",
    "utility_payment_delay_days": "Utility Payment Delay (days)",
    "gambling_spend_increase_pct": "Gambling Spend Increase (%)",
    "balance_volatility_30d": "Balance Volatility (30-day)",
    "atm_withdrawal_increase_pct": "ATM Withdrawal Increase (%)",
    "atm_withdrawal_count_30d": "ATM Withdrawal Count (30-day)",
    "upi_lending_app_txn_count": "UPI Lending App Transactions",
    "recent_failed_autodebit_flag": "Recent Failed Auto-Debit Flag",
    "savings_decline_trend": "Savings Decline Trend",
    "risk_momentum_score": "Risk Momentum Score",
    "emi_credit_stress": "EMI Credit Stress",
    "liquidity_stress": "Liquidity Stress",
    "payment_failure_severity": "Payment Failure Severity",
    "behavioral_risk_score": "Behavioral Risk Score",
    "volatility_liquidity_risk": "Volatility-Liquidity Risk",
    "composite_stress_index": "Composite Stress Index",
    "month": "Month",
    "quarter": "Quarter",
    "month_sin": "Month (sine)",
    "month_cos": "Month (cosine)",
    "customer_segment_salaried": "Customer Segment: Salaried",
    "customer_segment_self_employed": "Customer Segment: Self-Employed",
    "geography_rural": "Geography: Rural",
    "geography_tier2": "Geography: Tier-2 City",
    "risk_cohort_moderate": "Risk Cohort: Moderate",
    "risk_cohort_stable": "Risk Cohort: Stable",
}


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


def get_shap_explanation(model, df: pd.DataFrame, prediction: int, top_n: int = 3) -> dict:
    """
    Use SHAP TreeExplainer to compute feature contributions and return
    the top N reasons driving the prediction.

    Returns a dict with:
      - base_value: the model's baseline prediction (log-odds or probability)
      - top_reasons: list of the top N features with their contribution details
      - all_contributions: full sorted list of feature contributions
    """
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(df)

    # shap_values shape: (1, num_features) for binary classification
    # For XGBClassifier, shap_values is a single array (log-odds for class 1)
    if isinstance(shap_values, list):
        # Older SHAP versions return [class_0_values, class_1_values]
        sv = shap_values[1][0]  # class 1 (delinquency) contributions
    else:
        sv = shap_values[0]  # single array for binary classification

    base_value = float(
        explainer.expected_value[1]
        if isinstance(explainer.expected_value, (list, np.ndarray))
        else explainer.expected_value
    )

    feature_names = df.columns.tolist()
    feature_values = df.iloc[0].tolist()

    # Build contributions list sorted by absolute SHAP value (descending)
    contributions = []
    for fname, fval, sval in zip(feature_names, feature_values, sv):
        label = FEATURE_LABELS.get(fname, fname.replace("_", " ").title())
        contributions.append({
            "feature": fname,
            "feature_label": label,
            "feature_value": round(float(fval), 4),
            "shap_value": round(float(sval), 4),
            "direction": "increases risk" if sval > 0 else "decreases risk",
        })

    contributions.sort(key=lambda c: abs(c["shap_value"]), reverse=True)

    # Build human-friendly reason strings for the top N
    top_reasons = []
    for c in contributions[:top_n]:
        if prediction == 1:
            # Delinquency predicted
            if c["shap_value"] > 0:
                reason = f"{c['feature_label']} ({c['feature_value']}) strongly pushes toward delinquency"
            else:
                reason = f"{c['feature_label']} ({c['feature_value']}) partially offsets risk, but not enough"
        else:
            # No delinquency predicted
            if c["shap_value"] < 0:
                reason = f"{c['feature_label']} ({c['feature_value']}) strongly supports no delinquency"
            else:
                reason = f"{c['feature_label']} ({c['feature_value']}) raises some concern, but outweighed by other factors"

        top_reasons.append({
            **c,
            "reason": reason,
        })

    return {
        "base_value": round(base_value, 4),
        "top_reasons": top_reasons,
        "all_contributions": contributions,
    }
