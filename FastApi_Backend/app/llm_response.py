"""
Mistral AI integration for generating human-readable SHAP explanations
that bank employees can easily understand.
"""

import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"

# ── Full feature glossary for the LLM prompt ─────────────────────────────────
FEATURE_GLOSSARY = """
### Feature Glossary (for context — what each feature means in banking terms):

**Credit & Loan Features:**
- credit_score: The customer's credit bureau score (e.g. CIBIL). Higher = better creditworthiness. Range: 300–900.
- emi_to_income_ratio: What fraction of monthly income goes toward EMI repayments. Above 0.5 means >50% of income is committed to EMIs — very risky.
- emi_credit_stress: A composite metric combining EMI burden and credit utilization. Higher values indicate the customer is over-leveraged.

**Payment Behavior:**
- missed_payments_last_6m: How many scheduled payments (EMI, credit card, etc.) the customer missed in the last 6 months.
- failed_autodebit_count: Number of auto-debit/NACH mandate failures (insufficient funds in account when auto-debit was attempted).
- recent_failed_autodebit_flag: Binary (0/1) — whether the customer had a failed auto-debit in the most recent billing cycle.
- payment_failure_severity: A composite score capturing how severe and frequent payment failures have been. Higher = worse.

**Income & Savings Signals:**
- salary_delay_days: How many days late the customer's salary was credited compared to the expected date. Indicates employer instability.
- income_drop_pct: Percentage drop in the customer's income compared to their baseline. E.g., 15 means income fell 15%.
- savings_decline_pct: Percentage decline in the customer's savings balance over a period. Indicates financial stress.
- savings_decline_trend: Direction of savings — negative values mean savings are falling over time.

**Spending & Cash Behavior:**
- credit_utilization_ratio: Fraction of total credit limit currently used. Above 0.75 is generally concerning.
- discretionary_spend_drop_pct: Percentage drop in non-essential spending (dining, entertainment, travel). A large drop may indicate the customer is cutting costs due to financial stress.
- utility_payment_delay_days: How many days late the customer pays utility bills (electricity, water, phone).
- gambling_spend_increase_pct: Percentage increase in spending categorized as gambling/betting. Higher values indicate risky financial behavior.
- atm_withdrawal_increase_pct: Percentage increase in ATM cash withdrawals. A sudden spike may indicate informal borrowing or cash-crunch behavior.
- atm_withdrawal_count_30d: Total number of ATM withdrawals in the last 30 days.

**Digital Lending Signals:**
- upi_lending_app_txn_count: Number of UPI transactions to known lending/loan apps (e.g. payday loan apps). Indicates the customer may be taking informal loans.

**Risk & Stress Composites:**
- risk_momentum_score: How quickly the customer's risk profile is deteriorating. Higher = risk is accelerating.
- behavioral_risk_score: An aggregate score combining multiple behavioral red flags (payment failures, spending patterns, etc.). Higher = riskier.
- liquidity_stress: How tight the customer's cash position is. Higher = more stressed.
- volatility_liquidity_risk: Combines balance volatility with liquidity stress. Higher = unstable finances.
- composite_stress_index: The master stress score combining all sub-indicators. Higher = greater overall financial distress.
- balance_volatility_30d: How much the customer's bank balance fluctuated in the last 30 days. High volatility = unpredictable cash flow.

**Demographic / Segment:**
- customer_segment_salaried: 1 if the customer is a salaried employee, 0 otherwise.
- customer_segment_self_employed: 1 if the customer is self-employed, 0 otherwise.
- geography_rural: 1 if the customer is from a rural area, 0 otherwise.
- geography_tier2: 1 if the customer is from a Tier-2 city, 0 otherwise.
- risk_cohort_moderate: 1 if the customer was assigned to the 'moderate risk' cohort, 0 otherwise.
- risk_cohort_stable: 1 if the customer was assigned to the 'stable/low risk' cohort, 0 otherwise.

**Temporal Features:**
- month: Calendar month (1–12).
- quarter: Calendar quarter (1–4).
- month_sin / month_cos: Sine and cosine encodings of the month for cyclical pattern capture. These are mathematical transformations — not directly interpretable but help the model detect seasonal trends.
"""


def _build_prompt(prediction_label: str, probabilities: dict, top_reasons: list[dict]) -> str:
    """
    Build the system + user prompt for Mistral AI.
    """

    reasons_text = ""
    for i, r in enumerate(top_reasons, 1):
        reasons_text += (
            f"  Reason {i}:\n"
            f"    Feature: {r['feature']} ({r['feature_label']})\n"
            f"    Customer's value: {r['feature_value']}\n"
            f"    SHAP contribution: {r['shap_value']} ({r['direction']})\n\n"
        )

    system_prompt = f"""You are an AI assistant for bank employees at an Indian bank's Collections & Risk department.
Your job is to explain — in simple, non-technical language — why the delinquency prediction model flagged (or cleared) a customer.

{FEATURE_GLOSSARY}

RULES:
1. Write exactly 3 bullet-point reasons (one per SHAP factor provided).
2. Each reason must be 2–3 sentences max.
3. Use plain language a bank relationship manager would understand — NO jargon like "SHAP value", "log-odds", "feature importance", or "model".
4. Explain WHAT the factor means for this customer and WHY it matters for delinquency risk.
5. If a feature is a composite/derived score, explain what real-world behaviors it reflects.
6. Reference the actual numeric value of the feature to ground the explanation.
7. Output ONLY valid JSON — an array of 3 objects, each with "rank" (int), "feature" (string), and "explanation" (string).
8. No markdown formatting, no code fences — raw JSON only."""

    user_prompt = f"""The model predicted: **{prediction_label}**
Probability of delinquency: {probabilities.get('delinquency', 'N/A')}
Probability of no delinquency: {probabilities.get('no_delinquency', 'N/A')}

The top 3 contributing factors (from SHAP analysis) are:

{reasons_text}

Generate the 3 human-readable explanations for a bank employee."""

    return system_prompt, user_prompt


async def generate_ai_explanation(
    prediction_label: str,
    probabilities: dict,
    top_reasons: list[dict],
) -> list[dict]:
    """
    Call Mistral AI to generate human-readable explanations for the
    top 3 SHAP reasons. Returns a list of dicts with rank, feature, explanation.
    Falls back to the raw SHAP reasons if the API call fails.
    """
    if not MISTRAL_API_KEY:
        # No API key — return a fallback
        return [
            {
                "rank": i + 1,
                "feature": r["feature_label"],
                "explanation": r.get("reason", r["direction"]),
            }
            for i, r in enumerate(top_reasons)
        ]

    system_prompt, user_prompt = _build_prompt(prediction_label, probabilities, top_reasons)

    payload = {
        "model": "mistral-small-latest",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 600,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(MISTRAL_API_URL, json=payload, headers=headers)
            response.raise_for_status()

        data = response.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)

        # Handle both {"reasons": [...]} and direct [...] formats
        if isinstance(parsed, list):
            return parsed
        elif isinstance(parsed, dict):
            # Try common keys
            for key in ("reasons", "explanations", "top_reasons", "results"):
                if key in parsed:
                    return parsed[key]
            # If it's a dict with rank/explanation keys, wrap it
            if "rank" in parsed:
                return [parsed]

        return parsed

    except Exception as e:
        # Fallback: return template-based reasons if Mistral fails
        print(f"[ai_response] Mistral API error: {e}")
        return [
            {
                "rank": i + 1,
                "feature": r["feature_label"],
                "explanation": r.get("reason", r["direction"]),
            }
            for i, r in enumerate(top_reasons)
        ]
