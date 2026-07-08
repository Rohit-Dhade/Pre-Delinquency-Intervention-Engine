import asyncio
import joblib
import logging
import os
import subprocess
import sys
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.schemas import PredictionRequest, FeaturePredictionRequest
from app.utils import build_dataframe, get_shap_explanation
from app.llm_response import generate_ai_explanation
from app.feature_store import get_customer_features

# ── Employee Authentication integration ──────────────────────────────────────
# Add Employee_Authentication package to Python path
sys.path.insert(
    0,
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "Employee_Authentication"),
)
import employee_auth  # noqa: E402  — loads .env from Employee_Authentication/
from employee_auth.db.pool import init_pool, close_pool
from employee_auth.db.auth_migrations import auth_migrate
from employee_auth.db.auth_seed import auth_seed
from employee_auth.auth.jwt_handler import get_current_employee
from employee_auth.auth.permissions import require_role
from employee_auth.routers.auth import router as auth_router, limiter
from employee_auth.middleware.auth_middleware import get_client_ip, get_user_agent
from employee_auth.db.auth_queries import log_audit
from employee_auth.models.auth_models import EmployeeInDB

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

# ── Traffic simulation background loop ────────────────────────────────────────
SIMULATION_INTERVAL = int(os.getenv("SIMULATION_INTERVAL_SECONDS", "300"))  # 5 min default
_simulation_task: asyncio.Task | None = None
_simulation_running = False


def _run_simulation_pipeline():
    """Run the full traffic → features → materialize pipeline (blocking)."""
    base_dir = os.path.dirname(os.path.dirname(__file__))
    simulate_path = os.path.join(base_dir, "scripts", "simulate_live_traffic.py")
    feature_sql_path = os.path.join(base_dir, "scripts", "run_feature_sql.py")
    materialize_path = os.path.join(base_dir, "scripts", "feast_materialize.py")

    logger.info("[Simulation] Starting traffic simulation...")
    subprocess.run([sys.executable, simulate_path])

    logger.info("[Simulation] Running feature SQL and updating Parquet...")
    subprocess.run([sys.executable, feature_sql_path])

    logger.info("[Simulation] Materializing features to Online Store...")
    subprocess.run([sys.executable, materialize_path])

    logger.info("[Simulation] Pipeline cycle completed.")


async def _simulation_loop():
    """Continuously run the simulation pipeline with pauses between cycles."""
    global _simulation_running
    _simulation_running = True
    cycle = 0
    while _simulation_running:
        cycle += 1
        logger.info(f"[Simulation] ─── Cycle {cycle} starting ───")
        try:
            # Run the blocking subprocess pipeline in a thread pool
            await asyncio.to_thread(_run_simulation_pipeline)
        except Exception as e:
            logger.error(f"[Simulation] Pipeline error: {e}")

        if not _simulation_running:
            break
        logger.info(f"[Simulation] Sleeping {SIMULATION_INTERVAL}s before next cycle...")
        try:
            await asyncio.sleep(SIMULATION_INTERVAL)
        except asyncio.CancelledError:
            break
    logger.info("[Simulation] Loop stopped.")


@asynccontextmanager
async def lifespan(app):
    """Start auth system + simulation loop on boot, clean up on shutdown."""
    # ── Auth startup ─────────────────────────────────────────────────────
    await init_pool()
    await auth_migrate()
    await auth_seed()
    logger.info("Auth system initialised (pool → migration → seed)")

    # ── Simulation startup ───────────────────────────────────────────────
    global _simulation_task
    logger.info("[Simulation] Auto-starting continuous traffic simulation...")
    _simulation_task = asyncio.create_task(_simulation_loop())
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────
    global _simulation_running
    _simulation_running = False
    if _simulation_task:
        _simulation_task.cancel()
        try:
            await _simulation_task
        except asyncio.CancelledError:
            pass
    logger.info("[Simulation] Stopped on server shutdown.")
    await close_pool()
    logger.info("Auth DB pool closed")


app = FastAPI(
    title="Pre-Delinquency Prediction API",
    description="Predicts customer delinquency risk using behavioral & credit signals.",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allows the React frontend (Vite dev server or production build) to call this
# API directly when not behind a proxy.  Add production origins to the env var.
_cors_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=True,          # needed for httpOnly refresh cookie
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiter + Auth router ───────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(auth_router)

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
async def predict(
    req: PredictionRequest,
    request: Request,
    employee: EmployeeInDB = Depends(
        require_role("admin", "risk_analyst", "relationship_manager")
    ),
):
    """
    Accept a single customer record, run it through the XGBoost model,
    and return the predicted class, probability scores, and AI-powered
    SHAP explanations (top 3 reasons for the prediction).
    """
    try:
        # ── Audit log: PREDICT_ACCESS ────────────────────────────────────
        await log_audit(
            employee_id=employee.employee_id,
            action="PREDICT_ACCESS",
            resource=req.customer_id or "/predict",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            success=True,
            metadata={"customer_id": req.customer_id},
        )

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

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/admin/reload-model")
async def reload_model(
    request: Request,
    admin: EmployeeInDB = Depends(require_role("admin")),
):
    """
    Reloads the XGBoost model and SHAP explainer from disk into memory.
    Used by the weekly retraining pipeline after dropping new .joblib files.
    """
    try:
        load_model_artifacts()
        # ── Audit log ────────────────────────────────────────────────────
        await log_audit(
            employee_id=admin.employee_id,
            action="ADMIN_RELOAD_MODEL",
            resource="/admin/reload-model",
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            success=True,
        )
        return {"message": "Model and explainer reloaded successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to reload model: {str(exc)}")

@app.get("/simulation/status")
async def simulation_status():
    """Check if the background traffic simulation is running."""
    return {
        "running": _simulation_running,
        "interval_seconds": SIMULATION_INTERVAL,
    }


@app.post("/simulation/stop")
async def simulation_stop():
    """Gracefully stop the background traffic simulation."""
    global _simulation_running, _simulation_task
    if not _simulation_running:
        return {"message": "Simulation is not running."}
    _simulation_running = False
    if _simulation_task:
        _simulation_task.cancel()
    return {"message": "Simulation stop requested."}


@app.post("/simulation/start")
async def simulation_start():
    """Restart the background traffic simulation if it was stopped."""
    global _simulation_task, _simulation_running
    if _simulation_running:
        return {"message": "Simulation is already running."}
    _simulation_task = asyncio.create_task(_simulation_loop())
    return {"message": "Simulation restarted."}

# ── Customer Lookup routes ───────────────────────────────────────────────────

@app.get("/customers/search")
async def search_customers(
    q: str = "",
    employee: EmployeeInDB = Depends(
        require_role("admin", "risk_analyst", "relationship_manager")
    ),
):
    """
    Search customers by customer_id, name, or account_number.
    Returns up to 20 matching customers with key fields.
    """
    query_term = q.strip()
    if not query_term:
        raise HTTPException(status_code=400, detail="Search query 'q' is required.")

    from employee_auth.db.pool import _pool  # reuse auth asyncpg pool

    sql = """
        SELECT customer_id, name, account_number, segment, geography,
               credit_score, email, phone_number
        FROM customers
        WHERE customer_id ILIKE $1
           OR name ILIKE $1
           OR account_number ILIKE $1
        ORDER BY customer_id
        LIMIT 20
    """
    pattern = f"%{query_term}%"

    try:
        async with _pool.acquire() as conn:
            rows = await conn.fetch(sql, pattern)
        return [dict(r) for r in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Customer search failed: {exc}")


@app.get("/customers/{customer_id}")
async def get_customer_detail(
    customer_id: str,
    employee: EmployeeInDB = Depends(
        require_role("admin", "risk_analyst", "relationship_manager")
    ),
):
    """
    Retrieve a single customer's profile by exact customer_id.
    """
    from employee_auth.db.pool import _pool

    sql = """
        SELECT customer_id, name, account_number, segment, geography,
               credit_score, email, phone_number, dob, ifsc_code, created_at
        FROM customers
        WHERE customer_id = $1
    """
    try:
        async with _pool.acquire() as conn:
            row = await conn.fetchrow(sql, customer_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
        return dict(row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Customer lookup failed: {exc}")


# ── Intervention Engine proxy routes ─────────────────────────────────────────
# These forward requests from FastAPI (port 8000) to the Node.js
# Intervention Engine (port 3001) so frontends only need one API gateway.

@app.post("/intervention/outcome")
async def proxy_intervention_outcome(
    request_body: dict,
    employee: EmployeeInDB = Depends(
        require_role("admin", "relationship_manager")
    ),
):
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
async def proxy_intervention_stats(
    employee: EmployeeInDB = Depends(
        require_role("admin", "risk_analyst")
    ),
):
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
async def proxy_intervention_history(
    customer_id: str,
    employee: EmployeeInDB = Depends(
        require_role("admin", "risk_analyst", "relationship_manager")
    ),
):
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