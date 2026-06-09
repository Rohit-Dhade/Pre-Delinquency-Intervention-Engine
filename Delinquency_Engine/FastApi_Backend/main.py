import joblib
import os
import subprocess
from fastapi import FastAPI, HTTPException, BackgroundTasks

from app.schemas import PredictionRequest, FeaturePredictionRequest
from app.utils import build_dataframe, get_shap_explanation
from app.llm_response import generate_ai_explanation
from app.feature_store import get_customer_features

app = FastAPI(
    title="Pre-Delinquency Prediction API",
    description="Predicts customer delinquency risk using behavioral & credit signals.",
)

# ── Load model ────────────────────────────────────────────────────────────────
model = None
explainer = None

def load_model_artifacts():
    global model, explainer
    
    # Load model
    latest_model_path = "xgb_model_latest.joblib"
    fallback_model_path = "xgb_delinquency_model.joblib"
    
    if os.path.exists(latest_model_path):
        model = joblib.load(latest_model_path)
    else:
        model = joblib.load(fallback_model_path)
        
    # Load SHAP explainer
    explainer_path = "shap_explainer.joblib"
    if os.path.exists(explainer_path):
        explainer = joblib.load(explainer_path)
    else:
        explainer = None

load_model_artifacts()

# ── Routes ───────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "pre-delinquency-prediction-api",
        "message": "Service is running",
    }


@app.get("/predict/{customer_id}")
async def predict_with_feast(customer_id: str):
    """
    Fetch features from Feast online store and predict.
    """
    try:
        # Fetch features from Feast
        df = get_customer_features(customer_id)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found in feature store.")

        prediction = int(model.predict(df)[0])
        label = "delinquency" if prediction == 1 else "no_delinquency"

        # Probability for each class
        probabilities = None
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(df)[0]
            probabilities = {
                "no_delinquency": round(float(proba[0]), 4),
                "delinquency": round(float(proba[1]), 4),
            }

        # SHAP
        shap_result = get_shap_explanation(model, df, prediction, top_n=3, explainer=explainer)

        # AI
        ai_reasons = await generate_ai_explanation(
            prediction_label=label,
            probabilities=probabilities or {},
            top_reasons=shap_result["top_reasons"],
        )

        return {
            "customer_id": customer_id,
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

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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
        shap_result = get_shap_explanation(model, df, prediction, top_n=3, explainer=explainer)

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

@app.post("/admin/reload-model")
async def reload_model():
    """
    Reloads the XGBoost model and SHAP explainer from disk into memory.
    Used by the weekly retraining pipeline after dropping new .joblib files.
    """
    try:
        load_model_artifacts()
        return {"message": "Model and explainer reloaded successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to reload model: {str(exc)}")

@app.post("/simulate_traffic")
async def simulate_traffic(background_tasks: BackgroundTasks):
    """
    Trigger the traffic simulation script in the background.
    """
    def run_script():
        base_dir = os.path.dirname(os.path.dirname(__file__))
        simulate_path = os.path.join(base_dir, "scripts", "simulate_live_traffic.py")
        feature_sql_path = os.path.join(base_dir, "scripts", "run_feature_sql.py")
        materialize_path = os.path.join(base_dir, "scripts", "feast_materialize.py")
        
        import sys
        # 1. Run simulation
        print("Starting live traffic simulation...")
        subprocess.run([sys.executable, simulate_path])
        
        # 2. Compute features and update Parquet
        print("Running feature SQL and updating Parquet...")
        subprocess.run([sys.executable, feature_sql_path])
        
        # 3. Materialize to Feast online store
        print("Materializing features to Online Store...")
        subprocess.run([sys.executable, materialize_path])
        
        print("Live traffic simulation and feature update pipeline completed.")
        
    background_tasks.add_task(run_script)
    return {"message": "Live traffic simulation and automated feature pipeline started in the background."}