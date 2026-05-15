import joblib
from fastapi import FastAPI, HTTPException

from app.schemas import PredictionRequest
from app.utils import build_dataframe, get_shap_explanation
from app.llm_response import generate_ai_explanation

app = FastAPI(
    title="Pre-Delinquency Prediction API",
    description="Predicts customer delinquency risk using behavioral & credit signals.",
)

# ── Load model ────────────────────────────────────────────────────────────────
model = joblib.load("xgb_delinquency_model.joblib")


# ── Routes ───────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "pre-delinquency-prediction-api",
        "message": "Service is running",
    }


@app.post("/predict")
async def predict(req: PredictionRequest):
    """
    Accept a single customer record, run it through the XGBoost model,
    and return the predicted class, probability scores, and AI-powered
    SHAP explanations (top 3 reasons for the prediction).
    """
    try:
        df = build_dataframe(req)

        prediction = int(model.predict(df)[0])
        label = "delinquency" if prediction == 1 else "no_delinquency"

        # Probability for each class (if the model supports it)
        probabilities = None
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(df)[0]
            probabilities = {
                "no_delinquency": round(float(proba[0]), 4),
                "delinquency": round(float(proba[1]), 4),
            }

        # ── SHAP Explainability ──────────────────────────────────────────
        shap_result = get_shap_explanation(model, df, prediction, top_n=3)

        # ── AI-Powered Explanation (Mistral) ─────────────────────────────
        ai_reasons = await generate_ai_explanation(
            prediction_label=label,
            probabilities=probabilities or {},
            top_reasons=shap_result["top_reasons"],
        )

        return {
            "customer_id": req.customer_id,
            "date": req.date,
            "prediction": prediction,
            "label": label,
            "probabilities": probabilities,
            "explanation": {
                "method": "SHAP (TreeExplainer) + Mistral AI",
                "base_value": shap_result["base_value"],
                "top_3_reasons": ai_reasons,
            },
            "all_feature_contributions": shap_result["all_contributions"],
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))