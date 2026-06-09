# MLOps Weekly Retraining Pipeline Walkthrough

We've successfully established a production-ready weekly retraining architecture for the Pre-Delinquency Prediction Engine. The pipeline is designed to securely automatically retrain the XGBoost model while enforcing strict MLOps principles: avoiding bias, gating for performance, checking data quality, and logging outcomes.

Here is a summary of the completed components:

## 1. Advanced Target Definition via SQL
The script no longer relies on a simple default target. It dynamically classifies users into 4 risk tiers (`delinquency_risk_label`) based on the `payment_events` table in PostgreSQL:
- **`0`**: No failures
- **`1`**: Watch (Self-cured quickly)
- **`2`**: At-Risk (Positive Class)
- **`3`**: Critical (Positive Class)

The XGBoost model is trained specifically to distinguish between the healthy/watch customers and the at-risk/critical customers.

## 2. Robust Training with Bias Correction
> [!TIP]
> Highly imbalanced datasets (few delinquencies vs. many healthy customers) often cause models to optimize by always predicting "Healthy".

We resolved this bias by automatically calculating the ratio of negative to positive samples, passing it to XGBoost's `scale_pos_weight`, and evaluating the model iteratively using **PR-AUC (Precision-Recall Area Under Curve)**, which is significantly better suited for imbalance than standard ROC-AUC.

## 3. Data Quality Gates & Auditing
> [!IMPORTANT]
> The pipeline features a strict gating mechanism. If the data quality fails or the new model performs worse than the existing production model, the new weights are discarded and an alert is logged.

- **Data Quality**: The script checks if any historical feature has > 20% NULL values. If so, it aborts training.
- **Audit Table**: We created a `retrain_log` table in your PostgreSQL `delinquency_db`. 
- **SHAP Feature Tracking**: For every successful run, the top 10 most impactful features are calculated via SHAP and written to the database. Over time, you can query this log to see if a feature's importance suddenly drops, hinting at upstream data bugs.

## 4. Zero-Downtime Live Reload
When the model successfully passes the PR-AUC gate:
1. It saves `xgb_model_latest.joblib`.
2. It generates a new SHAP explainer bound to the *new* model and saves `shap_explainer.joblib`.
3. It makes a direct HTTP POST call to `http://localhost:8000/admin/reload-model`.

The FastAPI backend catches this request and hot-swaps the `.joblib` files in memory. This means your predictive engine instantly gets smarter without requiring a server restart or experiencing any downtime!

---

### Verifying the Setup
You can trigger the pipeline manually at any time to verify the logs:

```bash
source FastApi_Backend/delinquencyenv/bin/activate
python scripts/weekly_retrain.py
```

Then check the database:
```bash
psql -U rohit -d delinquency_db -c "SELECT run_timestamp, pr_auc_after, pass_gate FROM retrain_log;"
```
