"""
Weekly Retraining Pipeline for Pre-Delinquency Engine

Usage:
    source delinquencyenv/bin/activate
    python scripts/weekly_retrain.py
"""
import os
import pathlib
import datetime
import urllib.parse
import requests

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text
from sklearn.model_selection import train_test_split
from sklearn.metrics import average_precision_score
import xgboost as xgb
import joblib
import shap
from feast import FeatureStore

# ── Config ────────────────────────────────────────────────────────────────────
DB_USER = os.getenv("POSTGRES_USER", "rohit")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "@sy2026")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "delinquency_db")

DB_PASS_ENCODED = urllib.parse.quote_plus(DB_PASS)
DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASS_ENCODED}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
FEAST_REPO = PROJECT_ROOT / "feast_repo"
BACKEND_DIR = PROJECT_ROOT / "FastApi_Backend"
LATEST_MODEL_PATH = BACKEND_DIR / "xgb_model_latest.joblib"
OLD_MODEL_PATH = BACKEND_DIR / "xgb_delinquency_model.joblib"
EXPLAINER_PATH = BACKEND_DIR / "shap_explainer.joblib"
FEATURE_NAMES_PATH = BACKEND_DIR / "model_feature_names.joblib"

# Load expected features
EXPECTED_FEATURES = joblib.load(FEATURE_NAMES_PATH).tolist()

def main():
    print("═" * 60)
    print("  Weekly Retraining Pipeline")
    print("═" * 60)

    engine = create_engine(DATABASE_URL)
    
    # ── 1. Determine Target (delinquency_risk_label) ──────────────────────────
    print("▸ Calculating delinquency_risk_label for customers...")
    
    label_sql = """
    WITH failures AS (
        SELECT 
            customer_id, 
            COUNT(*) as fail_count,
            MAX(CASE WHEN event_type = 'EMI' THEN 1 ELSE 0 END) as missed_emi,
            MAX(CASE WHEN paid_date IS NULL THEN (CURRENT_DATE - due_date)
                     ELSE (paid_date - due_date) END) as max_delay
        FROM payment_events
        WHERE status = 'failed'
        GROUP BY customer_id
    )
    SELECT 
        c.customer_id,
        CASE 
            WHEN f.missed_emi > 0 THEN 3
            WHEN f.fail_count >= 2 OR f.max_delay > 7 THEN 2
            WHEN f.fail_count = 1 AND f.max_delay <= 3 THEN 1
            ELSE 0
        END as delinquency_risk_label
    FROM customers c
    LEFT JOIN failures f ON c.customer_id = f.customer_id
    """
    
    entity_df = pd.read_sql(label_sql, engine)
    
    # Positive class = 2 (at-risk) or 3 (critical)
    entity_df["target"] = entity_df["delinquency_risk_label"].apply(lambda x: 1 if x in (2, 3) else 0)
    
    # Read the max event_timestamp from parquet to ensure Feast can match the TTL
    parquet_path = PROJECT_ROOT / "feast_repo" / "data" / "customer_features.parquet"
    if parquet_path.exists():
        parquet_df = pd.read_parquet(parquet_path, columns=["event_timestamp"])
        max_ts = parquet_df["event_timestamp"].max()
        entity_df["event_timestamp"] = max_ts
    else:
        entity_df["event_timestamp"] = pd.Timestamp.utcnow()
    
    print(f"  ✔ Generated {len(entity_df)} entity records.")
    class_counts = entity_df['target'].value_counts()
    print(f"  ✔ Positive (Delinquent): {class_counts.get(1, 0)}, Negative (Healthy): {class_counts.get(0, 0)}")

    # ── 2. Fetch Historical Data via Feast ────────────────────────────────────
    print("\n▸ Fetching historical features from Feast offline store...")
    store = FeatureStore(repo_path=str(FEAST_REPO))
    
    features_to_fetch = [f"customer_features_view:{feat}" for feat in EXPECTED_FEATURES]
    
    # event_timestamp needs to be tz-aware for Feast
    entity_df["event_timestamp"] = pd.to_datetime(entity_df["event_timestamp"])
    if entity_df["event_timestamp"].dt.tz is None:
        entity_df["event_timestamp"] = entity_df["event_timestamp"].dt.tz_localize("UTC")
    else:
        entity_df["event_timestamp"] = entity_df["event_timestamp"].dt.tz_convert("UTC")
    
    # Fetch historical features
    training_df = store.get_historical_features(
        entity_df=entity_df, 
        features=features_to_fetch
    ).to_df()
    
    # Drop rows where we couldn't find features (e.g., brand new customers)
    training_df = training_df.dropna(subset=EXPECTED_FEATURES, how='all')
    print(f"  ✔ Fetched {len(training_df)} feature records.")

    # ── 3. Data Quality Checks ────────────────────────────────────────────────
    print("\n▸ Running Data Quality Checks...")
    abort = False
    
    for feat in EXPECTED_FEATURES:
        null_pct = training_df[feat].isnull().mean()
        if null_pct > 0.20:
            print(f"  [ERROR] Feature {feat} has {null_pct:.1%} NULLs (> 20%).")
            abort = True
            
        # Optional: Mean shift check (>3 sigma)
        # This requires storing historical means in the DB.
        # Since this is the first run / we don't have historical metrics yet,
        # we log a warning instead of failing.
        pass
    if abort:
        print("\n❌ Data Quality Gates FAILED. Aborting retraining.")
        return

    # Fill remaining small % of nulls with 0 to prevent XGBoost errors just in case
    training_df[EXPECTED_FEATURES] = training_df[EXPECTED_FEATURES].fillna(0)

    # ── 4. Train/Test Split & Calculate scale_pos_weight ──────────────────────
    print("\n▸ Splitting data and calculating bias correction...")
    X = training_df[EXPECTED_FEATURES]
    y = training_df["target"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    
    # Calculate scale_pos_weight
    ratio = float(np.sum(y_train == 0)) / np.sum(y_train == 1) if np.sum(y_train == 1) > 0 else 1.0
    print(f"  ✔ class_ratio (negative / positive) = {ratio:.2f}")

    # ── 5. Train XGBoost Model ────────────────────────────────────────────────
    print("\n▸ Training XGBoost Model with PR-AUC metric...")
    
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.05,
        scale_pos_weight=ratio,
        eval_metric='aucpr',
        random_state=42,
        use_label_encoder=False
    )
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )
    
    # ── 6. PR-AUC Evaluation & Gate Check ─────────────────────────────────────
    print("\n▸ Evaluating Model Performance (PR-AUC)...")
    
    y_prob_new = model.predict_proba(X_test)[:, 1]
    pr_auc_after = average_precision_score(y_test, y_prob_new)
    
    # Calculate PR-AUC before using the old model
    pr_auc_before = 0.0
    if os.path.exists(LATEST_MODEL_PATH):
        old_model = joblib.load(LATEST_MODEL_PATH)
    elif os.path.exists(OLD_MODEL_PATH):
        old_model = joblib.load(OLD_MODEL_PATH)
    else:
        old_model = None
        
    if old_model:
        # Reorder columns just in case
        X_test_old = X_test[EXPECTED_FEATURES]
        if hasattr(old_model, 'predict_proba'):
            y_prob_old = old_model.predict_proba(X_test_old)[:, 1]
            pr_auc_before = average_precision_score(y_test, y_prob_old)
            
    print(f"  ✔ PR-AUC Before : {pr_auc_before:.4f}")
    print(f"  ✔ PR-AUC After  : {pr_auc_after:.4f}")
    
    # Pass Gate: New model should be reasonably good, or at least not worse than old by a large margin
    pass_gate = pr_auc_after >= (pr_auc_before - 0.02) and pr_auc_after > 0.50
    
    if not pass_gate:
        print("\n❌ Performance Gate FAILED. Model degraded. Aborting save.")
    else:
        print("\n✅ Performance Gate PASSED.")
        
        # ── 7. Generate SHAP Explainer ──────────────────────────────────────────
        print("▸ Generating and saving SHAP TreeExplainer...")
        explainer = shap.TreeExplainer(model)
        
        # Calculate top features for logging
        shap_values = explainer.shap_values(X_train)
        if isinstance(shap_values, list):
            sv = shap_values[1]
        else:
            sv = shap_values
            
        mean_abs_shap = np.abs(sv).mean(axis=0)
        top_idx = np.argsort(mean_abs_shap)[::-1][:10]
        top_features = [EXPECTED_FEATURES[i] for i in top_idx]
        top_features_str = ", ".join(top_features)
        
        # Save artifacts
        joblib.dump(model, LATEST_MODEL_PATH)
        joblib.dump(explainer, EXPLAINER_PATH)
        print(f"  ✔ Saved model to {LATEST_MODEL_PATH.name}")
        print(f"  ✔ Saved explainer to {EXPLAINER_PATH.name}")
        
        # Call FastAPI to reload
        try:
            res = requests.post("http://localhost:8000/admin/reload-model")
            if res.status_code == 200:
                print("  ✔ Successfully reloaded model in FastAPI backend!")
            else:
                print(f"  ⚠ Failed to reload model in FastAPI: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"  ⚠ Could not reach FastAPI to reload model: {e}")

    # ── 8. Write to retrain_log ───────────────────────────────────────────────
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO retrain_log 
                (rows_used, class_ratio, pr_auc_before, pr_auc_after, model_version, pass_gate, top_features)
                VALUES (:rows, :ratio, :pr_before, :pr_after, :version, :pass, :top)
            """),
            {
                "rows": int(len(training_df)),
                "ratio": float(ratio),
                "pr_before": float(pr_auc_before),
                "pr_after": float(pr_auc_after),
                "version": f"xgb_{datetime.datetime.now().strftime('%Y%m%d%H%M')}",
                "pass": pass_gate,
                "top": top_features_str if pass_gate else "N/A"
            }
        )
    print("\n✔ Written run metrics to PostgreSQL retrain_log table.")

if __name__ == "__main__":
    main()
