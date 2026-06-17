import joblib
import logging
import os
import subprocess
import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks

from app.schemas import PredictionRequest, FeaturePredictionRequest
from app.utils import build_dataframe, get_shap_explanation
from app.llm_response import generate_ai_explanation
from app.feature_store import get_customer_features

logger = logging.getLogger("uvicorn.error")

# ── Intervention Engine integration ──────────────────────────────────────────
INTERVENTION_SERVICE_URL = os.getenv(
    "INTERVENTION_SERVICE_URL",
    "http://localhost:3001"
)
MODEL_VERSION = os.getenv("MODEL_VERSION", "v1.0.0")


async def call_intervention_engine(
    customer_id: str,
    prob_delinquency: float,
    shap_top3: list,
    customer_segment: str,
    geography: str,
    emi_to_income_ratio: float,
    dry_run: bool = False,
):
    """
    Fire-and-forget call to the Intervention Engine.
    Failures are logged but NEVER block the prediction response.
    """
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{INTERVENTION_SERVICE_URL}/intervention/trigger",
                json={
                    "customer_id": customer_id,
                    "delinquency_prob": float(prob_delinquency),
                    "top_3_shap_reasons": shap_top3[:3],
                    "customer_features": {
                        "emi_to_income_ratio": float(emi_to_income_ratio),
                        "customer_segment": customer_segment,
                        "geography": geography,
                    },
                    "model_version": MODEL_VERSION,
                    "dry_run": dry_run,
                },
                timeout=5.0,
            )
            logger.info(f"Intervention triggered for {customer_id}")
    except Exception as e:
        # Intervention failure must NEVER break prediction
        logger.warning(f"Intervention service unreachable: {e}")

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

        # ── Call Intervention Engine for at-risk customers ────────────────
        if probabilities and probabilities.get("delinquency", 0) > 0.20:
            # Extract customer features from the Feast feature vector
            feat_df = get_customer_features(customer_id)
            emi_ratio = float(feat_df["emi_to_income_ratio"].iloc[0]) if "emi_to_income_ratio" in feat_df.columns else 0.0

            # Determine segment and geography from one-hot features
            segment = "salaried"  # default
            if "customer_segment_self_employed" in feat_df.columns and feat_df["customer_segment_self_employed"].iloc[0] == 1:
                segment = "self_employed"

            geo = "urban"  # default
            if "geography_rural" in feat_df.columns and feat_df["geography_rural"].iloc[0] == 1:
                geo = "rural"
            elif "geography_tier2" in feat_df.columns and feat_df["geography_tier2"].iloc[0] == 1:
                geo = "tier2"

            await call_intervention_engine(
                customer_id=customer_id,
                prob_delinquency=probabilities["delinquency"],
                shap_top3=shap_result["top_reasons"],
                customer_segment=segment,
                geography=geo,
                emi_to_income_ratio=emi_ratio,
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

        # ── Call Intervention Engine for at-risk customers ────────────────
        if probabilities and probabilities.get("delinquency", 0) > 0.20:
            await call_intervention_engine(
                customer_id=req.customer_id,
                prob_delinquency=probabilities["delinquency"],
                shap_top3=shap_result["top_reasons"],
                customer_segment=req.customer_segment,
                geography=req.geography,
                emi_to_income_ratio=float(req.emi_to_income_ratio),
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


# ── Intervention Engine proxy routes ─────────────────────────────────────────
# These forward requests from FastAPI (port 8000) to the Node.js
# Intervention Engine (port 3001) so frontends only need one API gateway.

@app.post("/intervention/outcome")
async def proxy_intervention_outcome(request_body: dict):
    """
    Record a customer's response to an intervention (accepted / ignored).
    Proxied to the Intervention Engine.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{INTERVENTION_SERVICE_URL}/intervention/outcome",
                json=request_body,
                timeout=5.0,
            )
            return resp.json()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Intervention Engine unreachable: {exc}"
        )


@app.get("/intervention/stats")
async def proxy_intervention_stats():
    """
    Retrieve aggregated intervention metrics (acceptance rates, recovery
    rates, email delivery rate, tier distribution).
    Proxied to the Intervention Engine.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{INTERVENTION_SERVICE_URL}/intervention/stats",
                timeout=5.0,
            )
            return resp.json()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Intervention Engine unreachable: {exc}"
        )


@app.get("/intervention/history/{customer_id}")
async def proxy_intervention_history(customer_id: str):
    """
    Retrieve a customer's last 6 interventions and outcomes.
    Proxied to the Intervention Engine.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{INTERVENTION_SERVICE_URL}/intervention/history/{customer_id}",
                timeout=5.0,
            )
            return resp.json()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Intervention Engine unreachable: {exc}"
        )


@app.get("/intervention/health")
async def proxy_intervention_health():
    """
    Health check for the Intervention Engine (PostgreSQL, Mistral,
    Gmail SMTP, FastAPI connectivity).
    Proxied to the Intervention Engine.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{INTERVENTION_SERVICE_URL}/intervention/health",
                timeout=5.0,
            )
            return resp.json()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Intervention Engine unreachable: {exc}"
        )