import joblib
from fastapi import FastAPI, HTTPException

from app.schemas import PredictionRequest
from app.utils import build_dataframe

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
def predict(req: PredictionRequest):
    """
    Accept a single customer record, run it through the XGBoost model,
    and return the predicted class and probability scores.
    """
    try:
        df = build_dataframe(req)

        prediction = int(model.predict(df)[0])

        # Probability for each class (if the model supports it)
        probabilities = None
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(df)[0]
            probabilities = {
                "no_delinquency": round(float(proba[0]), 4),
                "delinquency": round(float(proba[1]), 4),
            }

        return {
            "customer_id": req.customer_id,
            "date": req.date,
            "prediction": prediction,
            "label": "delinquency" if prediction == 1 else "no_delinquency",
            "probabilities": probabilities,
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))