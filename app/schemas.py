from pydantic import BaseModel, Field
from typing import Optional


class PredictionRequest(BaseModel):
    # Identifiers (not used by the model, kept for traceability)
    customer_id: Optional[str] = None
    date: Optional[str] = None

    # Categorical features (will be one-hot encoded)
    customer_segment: str = Field(..., description="e.g. salaried, self_employed, …")
    geography: str = Field(..., description="e.g. rural, tier2, urban, …")
    risk_cohort: str = Field(..., description="e.g. moderate, stable, high, …")

    # Static credit features
    credit_score: float
    emi_to_income_ratio: float

    # Core time-varying behavioral signals
    salary_delay_days: float
    savings_decline_pct: float
    income_drop_pct: float
    credit_utilization_ratio: float
    failed_autodebit_count: float
    missed_payments_last_6m: float
    discretionary_spend_drop_pct: float
    utility_payment_delay_days: float
    gambling_spend_increase_pct: float
    balance_volatility_30d: float

    # ATM withdrawal signals
    atm_withdrawal_increase_pct: float
    atm_withdrawal_count_30d: float

    # UPI to lending app
    upi_lending_app_txn_count: float

    # Derived flags and trends
    recent_failed_autodebit_flag: float
    savings_decline_trend: float

    # Composite / interaction features
    risk_momentum_score: float
    emi_credit_stress: float
    liquidity_stress: float
    payment_failure_severity: float
    behavioral_risk_score: float
    volatility_liquidity_risk: float
    composite_stress_index: float

    # Temporal features
    month: float
    quarter: float
    month_sin: float
    month_cos: float
