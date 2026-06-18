# 🏦 Pre-Delinquency Intervention Engine

A production-grade, end-to-end machine learning system for **predicting and preventing loan delinquency** in retail banking. The platform detects at-risk customers before they miss payments and automatically delivers personalised relief offers via email — powered by XGBoost, SHAP explainability, Feast feature store, and Mistral AI.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [Service 1 — Delinquency Engine (Python/FastAPI)](#service-1--delinquency-engine-pythonfastapi)
  - [ML Pipeline](#ml-pipeline)
  - [Feature Store (Feast)](#feature-store-feast)
  - [API Endpoints](#delinquency-engine-api-endpoints)
  - [Weekly Retraining Pipeline](#weekly-retraining-pipeline)
  - [Traffic Simulation](#traffic-simulation)
- [Service 2 — Intervention Engine (Node.js/Express)](#service-2--intervention-engine-nodejsexpress)
  - [Business Logic](#business-logic)
  - [API Endpoints](#intervention-engine-api-endpoints)
  - [Email Generation](#email-generation)
- [How They Connect](#how-they-connect)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Author](#author)

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           Pre-Delinquency Platform                               │
│                                                                                  │
│  ┌─────────────────────────────────────┐    ┌──────────────────────────────────┐ │
│  │    Delinquency Engine (PORT 8000)   │    │  Intervention Engine (PORT 3001) │ │
│  │              FastAPI                │    │          Express.js              │ │
│  │                                     │    │                                  │ │
│  │  ┌───────────┐  ┌───────────────┐   │    │  ┌────────────┐  ┌───────────┐  │ │
│  │  │  XGBoost  │  │  Feast Online │   │    │  │Tier Router │  │  Offer    │  │ │
│  │  │   Model   │  │    Store      │   │    │  │            │  │  Engine   │  │ │
│  │  └─────┬─────┘  └───────┬───────┘   │    │  └──────┬─────┘  └─────┬─────┘  │ │
│  │        │                │           │    │         │              │        │ │
│  │  ┌─────┴─────┐  ┌───────┴───────┐   │    │  ┌──────┴─────┐  ┌─────┴─────┐  │ │
│  │  │   SHAP    │  │  Mistral AI   │   │    │  │  Channel   │  │  Mistral  │  │ │
│  │  │ Explainer │  │  (Explain)    │   │    │  │  Router    │  │  AI (Gen) │  │ │
│  │  └───────────┘  └───────────────┘   │    │  └────────────┘  └───────────┘  │ │
│  │                                     │    │                                  │ │
│  │  POST /predict ──── prob > 0.20 ────│───▶│  POST /intervention/trigger      │ │
│  │  GET  /predict/:id  (auto-call)     │    │  → Tier → Offer → Email → Log   │ │
│  └──────────────────┬──────────────────┘    └──────────────┬───────────────────┘ │
│                     │                                      │                     │
│            ┌────────┴──────────────────────────────────────┴──────┐               │
│            │             PostgreSQL (Docker — PORT 5432)          │               │
│            │  customers │ transactions │ payment_events │         │               │
│            │  customer_features │ retrain_log │                   │               │
│            │  intervention_log │ outcome_log │                   │               │
│            └─────────────────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Delinquency/
├── Delinquency_Engine/              # Python ML & Prediction Service
│   ├── FastApi_Backend/
│   │   ├── main.py                  # FastAPI app — prediction + proxy routes
│   │   ├── app/
│   │   │   ├── schemas.py           # Pydantic request models
│   │   │   ├── utils.py             # DataFrame builder + SHAP explainer
│   │   │   ├── llm_response.py      # Mistral AI explanation generator
│   │   │   └── feature_store.py     # Feast online feature retrieval
│   │   ├── xgb_model_latest.joblib  # Trained XGBoost model (latest)
│   │   ├── shap_explainer.joblib    # Pre-computed SHAP TreeExplainer
│   │   └── model_feature_names.joblib
│   ├── feast_repo/
│   │   ├── feature_store.yaml       # Feast configuration
│   │   ├── features.py              # Entity + FeatureView definitions
│   │   └── data/
│   │       └── customer_features.parquet
│   ├── scripts/
│   │   ├── ddl.sql                  # Full database schema (7 tables)
│   │   ├── setup_postgres.sh        # One-command DB setup
│   │   ├── generate_synthetic_data.py  # 2,000 customers + transactions
│   │   ├── feature_sql.sql          # 30+ engineered feature queries
│   │   ├── run_feature_sql.py       # Feature SQL → Parquet exporter
│   │   ├── feast_materialize.py     # Feast offline → online materialization
│   │   ├── simulate_live_traffic.py # Continuous synthetic traffic generator
│   │   └── weekly_retrain.py        # Full retraining pipeline
│   ├── airflow/dags/
│   │   └── delinquency_feature_pipeline.py  # Daily Airflow DAG
│   ├── dockerfile                   # Production Docker image
│   └── requirements.txt             # Python dependencies (96 packages)
│
├── Intervention_Engine/             # Node.js Intervention Microservice
│   ├── src/
│   │   ├── server.js                # Express bootstrap + graceful shutdown
│   │   ├── config/
│   │   │   ├── index.js             # Centralised env config
│   │   │   └── logger.js            # Winston file + console logging
│   │   ├── db/
│   │   │   ├── pool.js              # PostgreSQL connection pool
│   │   │   ├── migrate.js           # Auto-migration on startup
│   │   │   └── queries.js           # All parameterised SQL queries
│   │   ├── services/
│   │   │   ├── tierRouter.js        # Risk tier classification
│   │   │   ├── offerEngine.js       # Relief product selection
│   │   │   ├── channelRouter.js     # Email priority + scheduling
│   │   │   └── messageGenerator.js  # Mistral AI email generation
│   │   ├── email/
│   │   │   ├── mailer.js            # Nodemailer SMTP transport
│   │   │   ├── htmlWrapper.js       # Responsive HTML email template
│   │   │   └── templates.js         # Fallback email templates
│   │   ├── validation/
│   │   │   └── schemas.js           # Zod request validation
│   │   ├── middleware/
│   │   │   └── errorHandler.js      # Global error handler
│   │   ├── utils/
│   │   │   └── shapTranslator.js    # SHAP → plain English translator
│   │   └── routes/
│   │       └── intervention.js      # All route handlers
│   ├── tests/                       # 42 Jest + Supertest tests
│   │   ├── tierRouter.test.js
│   │   ├── offerEngine.test.js
│   │   ├── channelRouter.test.js
│   │   ├── messageGenerator.test.js
│   │   └── intervention.routes.test.js
│   ├── package.json
│   └── .env_example
│
└── README.md                        # ← You are here
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **ML Model** | XGBoost 3.2 | Binary delinquency classification |
| **Explainability** | SHAP (TreeExplainer) | Feature contribution analysis |
| **Feature Store** | Feast 0.63 | Offline + Online feature serving with TTL |
| **Prediction API** | FastAPI + Uvicorn | Async REST API for predictions |
| **Intervention API** | Express.js 5 | Risk tiering + automated outreach |
| **Database** | PostgreSQL 16 (Docker) | Source of truth for all data |
| **AI Email Gen** | Mistral AI (Large + Small) | Personalised, empathetic communication |
| **Email Delivery** | Nodemailer (Gmail SMTP) | SMTP mail transport |
| **Orchestration** | Apache Airflow | Daily feature pipeline DAG |
| **Validation** | Pydantic (Python), Zod (Node.js) | Request schema validation |
| **Testing** | Jest + Supertest | 42 unit + integration tests |
| **Containerisation** | Docker | PostgreSQL + FastAPI deployment |

---

## Database Schema

The system uses **7 PostgreSQL tables** across two services:

### Owned by Delinquency Engine (FastAPI)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `customers` | Customer demographics | `customer_id`, `name`, `email`, `segment`, `geography`, `credit_score` |
| `transactions` | Banking transactions | `customer_id`, `txn_type`, `amount`, `channel`, `merchant_category` |
| `payment_events` | EMI/autodebit/utility payments | `customer_id`, `event_type`, `status`, `due_date`, `paid_date` |
| `customer_features` | 30+ engineered ML features | All model input features, `feature_date`, `event_timestamp` |
| `retrain_log` | Weekly retraining audit trail | `pr_auc_before`, `pr_auc_after`, `pass_gate`, `top_features` |

### Owned by Intervention Engine (Node.js)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `intervention_log` | Every intervention action taken | `customer_id`, `risk_tier`, `offer_type`, `message_sent`, `email_delivered` |
| `outcome_log` | Customer responses to interventions | `intervention_id` (FK), `offer_accepted`, `days_to_resolve`, `did_default_anyway` |

---

## Service 1 — Delinquency Engine (Python/FastAPI)

### ML Pipeline

```
Raw Data (PostgreSQL)
    │
    ▼
Feature Engineering (30+ SQL-computed features)
    │
    ▼
Feast Feature Store (Parquet → Online Store)
    │
    ▼
XGBoost Binary Classifier
    │
    ├── Prediction (delinquency / no_delinquency)
    ├── Probabilities (0.0 – 1.0)
    └── SHAP Top 3 Reasons
            │
            ▼
        Mistral AI → Human-Readable Explanations
```

**Model Features (30 total):**

- **Credit & Loan**: `credit_score`, `emi_to_income_ratio`, `emi_credit_stress`
- **Payment Behavior**: `missed_payments_last_6m`, `failed_autodebit_count`, `payment_failure_severity`
- **Income Signals**: `salary_delay_days`, `income_drop_pct`, `savings_decline_pct`
- **Spending Behavior**: `credit_utilization_ratio`, `discretionary_spend_drop_pct`, `gambling_spend_increase_pct`
- **ATM/UPI Signals**: `atm_withdrawal_increase_pct`, `upi_lending_app_txn_count`
- **Composite Risk**: `composite_stress_index`, `behavioral_risk_score`, `liquidity_stress`, `risk_momentum_score`
- **Temporal**: `month`, `quarter`, `month_sin`, `month_cos`
- **Categorical (One-Hot)**: `customer_segment_*`, `geography_*`, `risk_cohort_*`

### Feature Store (Feast)

The Feast feature store provides point-in-time correct feature retrieval:

- **Offline Store**: Parquet files generated by `run_feature_sql.py` executing `feature_sql.sql`
- **Online Store**: SQLite-backed online store materialized via `feast_materialize.py`
- **Entity**: `customer_id` (join key)
- **TTL**: 2 days — features older than 2 days are considered stale
- **Pipeline**: Automated daily via Airflow DAG (`delinquency_feature_pipeline.py`)

### Delinquency Engine API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service health status |
| `/predict/{customer_id}` | GET | Predict using Feast online features → auto-triggers intervention if prob > 0.20 |
| `/predict` | POST | Predict from raw feature payload → auto-triggers intervention if prob > 0.20 |
| `/admin/reload-model` | POST | Hot-reload model artifacts after retraining |
| `/simulation/status` | GET | Check background traffic simulation status |
| `/simulation/start` | POST | Start the traffic simulation loop |
| `/simulation/stop` | POST | Stop the traffic simulation loop |
| `/intervention/outcome` | POST | Proxy → Intervention Engine |
| `/intervention/stats` | GET | Proxy → Intervention Engine |
| `/intervention/history/{id}` | GET | Proxy → Intervention Engine |
| `/intervention/health` | GET | Proxy → Intervention Engine |

### Weekly Retraining Pipeline

The `weekly_retrain.py` script runs the full retraining lifecycle:

1. **Label Generation** — Computes `delinquency_risk_label` from `payment_events` (missed EMIs, failed autodebits)
2. **Feast Historical Fetch** — Retrieves point-in-time features for all labelled customers
3. **Data Quality Gates** — Aborts if any feature has > 20% NULL values
4. **Class Imbalance Correction** — Calculates `scale_pos_weight` for XGBoost
5. **Model Training** — XGBoost with `eval_metric='aucpr'`, 200 estimators, max_depth=5
6. **Performance Gate** — New model must achieve PR-AUC ≥ 0.50 and not regress > 0.02 from baseline
7. **SHAP Explainer** — Regenerates `TreeExplainer` and identifies top 10 features
8. **Hot Reload** — Calls `POST /admin/reload-model` to update the live API without downtime
9. **Audit Logging** — Writes metrics to `retrain_log` table

### Traffic Simulation

On server startup, a continuous background loop automatically runs the full data pipeline:

```
simulate_live_traffic.py → run_feature_sql.py → feast_materialize.py
         │                        │                       │
    Insert synthetic         Compute 30+            Materialize to
    transactions &           engineered              Feast online
    payment events           features                store
```

- **Interval**: Configurable via `SIMULATION_INTERVAL_SECONDS` (default: 300s)
- **Non-blocking**: Runs in a thread pool via `asyncio.to_thread()` — predictions never blocked
- **Controllable**: Start/stop via `/simulation/start` and `/simulation/stop`

---

## Service 2 — Intervention Engine (Node.js/Express)

### Business Logic

When `POST /intervention/trigger` is called with a delinquency probability > 0.20, the engine executes this pipeline:

```
Input: customer_id, delinquency_prob, SHAP reasons, customer_features
  │
  ├── 1. Tier Router ──────────── Classify risk level
  │     > 0.70 → CRITICAL    0.40–0.70 → MODERATE
  │     0.20–0.40 → WATCH    < 0.20 → STABLE (no action)
  │
  ├── 2. Offer Engine ─────────── Select relief product
  │     Critical + high EMI → Loan Restructuring
  │     Critical + low EMI  → Payment Holiday
  │     Moderate + salaried → EMI Deferral (1 month)
  │     Watch (any)         → Financial Wellness Check
  │
  ├── 3. Channel Router ───────── Set email priority + timing
  │     Critical → Urgent priority, RM-style email
  │     Moderate → High priority, offer email
  │     Watch    → Normal priority, wellness check
  │     + Escalation if customer previously ignored offers
  │
  ├── 4. Message Generator ────── Generate personalised email
  │     Mistral AI → empathetic, non-threatening tone
  │     Fallback → pre-written tier-specific templates
  │
  ├── 5. Email Dispatch ───────── Send via Gmail SMTP
  │     Dry run → sends to admin email with [DRY RUN] prefix
  │
  └── 6. Database Log ─────────── Write to intervention_log
```

### Intervention Engine API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/intervention/trigger` | POST | Execute the full intervention pipeline |
| `/intervention/outcome` | POST | Record customer response (accepted/ignored) |
| `/intervention/history/:customer_id` | GET | Last 6 interventions for a customer |
| `/intervention/stats` | GET | Aggregated metrics: acceptance rates, recovery rates, email delivery, false positives |
| `/intervention/health` | GET | Health probes: PostgreSQL, Mistral AI, Gmail SMTP, FastAPI |

### Email Generation

The `messageGenerator` uses **Mistral AI (mistral-large-latest)** with a carefully crafted system prompt:

- **Tone**: Empathetic, warm, non-threatening — never mentions scores, models, or algorithms
- **Content**: Includes translated SHAP reasons in plain English and the selected relief offer
- **Fallback**: If Mistral API fails, uses pre-written tier-specific templates
- **Format**: Wrapped in a responsive HTML email with the bank's branding

---

## How They Connect

```
Customer makes a transaction
        │
        ▼
simulate_live_traffic.py inserts into PostgreSQL
        │
        ▼
run_feature_sql.py computes 30+ features → Parquet
        │
        ▼
feast_materialize.py → Feast online store
        │
        ▼
GET /predict/CUST_0004 (FastAPI)
  ├── Feast fetches features for customer
  ├── XGBoost predicts delinquency probability
  ├── SHAP explains top 3 contributing factors
  ├── Mistral AI generates human-readable explanations
  │
  └── if prob > 0.20:
        │
        ▼
      httpx POST → localhost:3001/intervention/trigger
        │
        ▼
      Intervention Engine
      ├── Tier: CRITICAL (prob=0.85)
      ├── Offer: Loan Restructuring (30 days)
      ├── Channel: Urgent priority, RM-style email
      ├── Mistral AI generates personalised email
      ├── Nodemailer sends via Gmail SMTP
      └── Logged to intervention_log in PostgreSQL
```

---

## Getting Started

### Prerequisites

- **Docker** (for PostgreSQL 16)
- **Python 3.12+**
- **Node.js 20+**
- **Gmail App Password** ([create one here](https://myaccount.google.com/apppasswords))
- **Mistral AI API Key** ([get one here](https://console.mistral.ai/))

### 1. Start PostgreSQL

```bash
# Option A: Docker (recommended)
docker run -d --name db-db-1 \
  -e POSTGRES_USER=rohit \
  -e POSTGRES_PASSWORD=@sy2026 \
  -e POSTGRES_DB=delinquency_db \
  -p 5432:5432 \
  postgres:16

# Option B: Local PostgreSQL
sudo bash Delinquency_Engine/scripts/setup_postgres.sh
```

### 2. Set Up the Delinquency Engine

```bash
cd Delinquency_Engine/FastApi_Backend

# Create virtual environment
python3 -m venv delinquencyenv
source delinquencyenv/bin/activate

# Install dependencies
pip install -r ../requirements.txt

# Create .env
echo 'MISTRAL_API_KEY=your_key_here' > .env

# Initialize database schema
PGPASSWORD='@sy2026' psql -h localhost -U rohit -d delinquency_db -f ../scripts/ddl.sql

# Generate synthetic data (2,000 customers)
python ../scripts/generate_synthetic_data.py

# Compute features and materialise to Feast
python ../scripts/run_feature_sql.py
python ../scripts/feast_materialize.py

# Start the API
uvicorn main:app --reload --port 8000
```

### 3. Set Up the Intervention Engine

```bash
cd Intervention_Engine

# Install dependencies
npm install

# Configure environment
cp .env_example .env
# Edit .env with your actual credentials

# Start the server
node src/server.js
```

### 4. Test End-to-End

```bash
# Predict for a customer (will auto-trigger intervention if prob > 0.20)
curl http://localhost:8000/predict/CUST_0004

# Check intervention stats
curl http://localhost:8000/intervention/stats

# Check intervention health
curl http://localhost:8000/intervention/health
```

---

## Environment Variables

### Delinquency Engine (`FastApi_Backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `MISTRAL_API_KEY` | — | Mistral AI API key for SHAP explanations |
| `INTERVENTION_SERVICE_URL` | `http://localhost:3001` | Intervention Engine URL |
| `MODEL_VERSION` | `v1.0.0` | Model version string sent to Intervention Engine |
| `SIMULATION_INTERVAL_SECONDS` | `300` | Seconds between traffic simulation cycles |
| `POSTGRES_USER` | `rohit` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `@sy2026` | PostgreSQL password |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DB` | `delinquency_db` | PostgreSQL database name |

### Intervention Engine (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `MISTRAL_API_KEY` | — | Mistral AI API key for email generation |
| `GMAIL_USER` | — | Gmail address for sending emails |
| `GMAIL_APP_PASSWORD` | — | Gmail App Password (16 chars) |
| `FASTAPI_BASE_URL` | `http://localhost:8000` | FastAPI backend URL (for health checks) |
| `PORT` | `3001` | Express server port |
| `NODE_ENV` | `development` | Environment mode |
| `MODEL_VERSION` | `v1.0.0` | Model version tag for logs |
| `BANK_NAME` | `FinTrust Bank` | Bank name used in emails |

---

## Testing

### Intervention Engine (42 Tests)

```bash
cd Intervention_Engine
npm test
```

```
Test Suites: 5 passed, 5 total
Tests:       42 passed, 42 total

  ✓ tierRouter (7 tests) — boundary thresholds, urgency scores
  ✓ offerEngine (9 tests) — segment × tier × EMI matrix
  ✓ channelRouter (10 tests) — priority escalation, scheduling, follow-ups
  ✓ messageGenerator (8 tests) — Mistral parsing, fallback, SHAP translation
  ✓ intervention.routes (8 tests) — trigger, outcome, history, stats, health
```

### Manual API Testing

```bash
# Trigger intervention (dry run — sends to your email)
curl -X POST http://localhost:3001/intervention/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST_0004",
    "delinquency_prob": 0.85,
    "top_3_shap_reasons": [{
      "feature": "composite_stress_index",
      "feature_label": "Composite Stress Index",
      "feature_value": 0.82,
      "shap_value": 0.35,
      "direction": "increases risk"
    }],
    "customer_features": {
      "emi_to_income_ratio": 0.55,
      "customer_segment": "salaried",
      "geography": "urban"
    },
    "model_version": "v1.0.0",
    "dry_run": true
  }'
```

---

## Author

**Rohit Dhade**
