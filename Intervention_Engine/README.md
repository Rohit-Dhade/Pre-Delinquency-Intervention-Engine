# Intervention Engine — Pre-Delinquency Banking System

A standalone **Node.js + Express** microservice that receives prediction data from the FastAPI ML backend and handles all intervention logic — risk tiering, offer selection, channel routing, and personalised email generation via **Mistral AI**.

---

## Architecture

```
FastAPI (PORT 8000)                    Intervention Engine (PORT 3001)
┌──────────────────┐                   ┌──────────────────────────────┐
│  /predict        │                   │  POST /intervention/trigger  │
│  XGBoost + SHAP  │──── prob > 0.20 ──│                              │
│  Feature Store   │    HTTP POST      │  1. Tier Router              │
│  PostgreSQL      │                   │  2. Offer Engine             │
└──────────────────┘                   │  3. Channel Router           │
                                       │  4. Mistral AI Message Gen   │
                                       │  5. Gmail SMTP Send          │
                                       │  6. Log to intervention_log  │
                                       └──────────────────────────────┘
```

## Prerequisites

- **Node.js 20+**
- **PostgreSQL** running with `delinquency_db` database
- **FastAPI backend** running on port 8000
- **Gmail App Password** (see setup below)
- **Mistral AI API key**

---

## Gmail App Password Setup

1. Go to [Google Account → Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled
3. Go to **App Passwords** (search "App Passwords" in account settings)
4. Select app: **Mail**, device: **Other** → name it "Intervention Engine"
5. Click **Generate** → copy the 16-character password
6. Paste it as `GMAIL_APP_PASSWORD` in your `.env` file

---

## Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.example .env

# 3. Edit .env with your credentials
#    DATABASE_URL, MISTRAL_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD

# 4. Start the service
node src/server.js
```

The service will:
1. Run database migrations (create `intervention_log` + `outcome_log`)
2. Start listening on PORT 3001

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:pass@localhost:5432/delinquency_db` |
| `MISTRAL_API_KEY` | Mistral AI API key | `a5l3JVHs...` |
| `GMAIL_USER` | Gmail address for sending | `you@gmail.com` |
| `GMAIL_APP_PASSWORD` | Gmail App Password (16 chars) | `xxxx xxxx xxxx xxxx` |
| `FASTAPI_BASE_URL` | FastAPI backend URL | `http://localhost:8000` |
| `MODEL_VERSION` | Current model version tag | `v1.0.0` |
| `BANK_NAME` | Bank name in emails | `FinTrust Bank` |
| `PORT` | Service port | `3001` |
| `NODE_ENV` | Environment | `development` or `production` |

---

## How FastAPI Calls This Service

Add this to your FastAPI `/predict` endpoint — after generating the prediction, if `prob > 0.20`:

```python
import httpx

async with httpx.AsyncClient() as client:
    await client.post(
        "http://localhost:3001/intervention/trigger",
        json={
            "customer_id": customer_id,
            "delinquency_prob": prob,
            "top_3_shap_reasons": shap_top3,
            "customer_features": {
                "emi_to_income_ratio": features["emi_to_income_ratio"],
                "customer_segment": features["customer_segment"],
                "geography": features["geography"]
            },
            "model_version": MODEL_VERSION,
            "dry_run": False
        },
        timeout=5.0
    )
```

---

## DryRun Testing

Set `"dry_run": true` in the trigger payload. In DryRun mode:
- Email is sent to **your own Gmail** (GMAIL_USER) instead of the customer
- Subject is prefixed with `[DRY RUN]`
- No data is written to `intervention_log`
- `intervention_id` is `null` in the response

---

## API Endpoints & curl Examples

### 1. Trigger Intervention

```bash
curl -X POST http://localhost:3001/intervention/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST_0001",
    "delinquency_prob": 0.75,
    "top_3_shap_reasons": [
      {
        "feature": "composite_stress_index",
        "feature_label": "Composite Stress Index",
        "feature_value": 0.82,
        "shap_value": 0.35,
        "direction": "increases risk"
      },
      {
        "feature": "salary_delay_days",
        "feature_label": "Salary Delay Days",
        "feature_value": 12,
        "shap_value": 0.22,
        "direction": "increases risk"
      },
      {
        "feature": "failed_autodebit_count",
        "feature_label": "Failed Autodebit Count",
        "feature_value": 3,
        "shap_value": 0.18,
        "direction": "increases risk"
      }
    ],
    "customer_features": {
      "emi_to_income_ratio": 0.55,
      "customer_segment": "salaried",
      "geography": "metro"
    },
    "model_version": "v1.0.0",
    "dry_run": true
  }'
```

### 2. Record Outcome

```bash
curl -X POST http://localhost:3001/intervention/outcome \
  -H "Content-Type: application/json" \
  -d '{
    "intervention_id": 1,
    "customer_id": "CUST_0001",
    "offer_accepted": true,
    "days_to_resolve": 7,
    "did_default_anyway": false
  }'
```

### 3. Get Customer History

```bash
curl http://localhost:3001/intervention/history/CUST_0001
```

### 4. Get Stats Dashboard

```bash
curl http://localhost:3001/intervention/stats
```

### 5. Health Check

```bash
curl http://localhost:3001/intervention/health
```

---

## Running Tests

```bash
npm test
```

---

## Project Structure

```
Intervention_Engine/
├── src/
│   ├── config/
│   │   ├── index.js          # Centralised env config
│   │   └── logger.js         # Winston logger
│   ├── db/
│   │   ├── pool.js           # pg.Pool singleton
│   │   ├── migrate.js        # Startup migration
│   │   └── queries.js        # All SQL (parameterised)
│   ├── services/
│   │   ├── tierRouter.js     # Risk tier classification
│   │   ├── offerEngine.js    # Offer selection rules
│   │   ├── channelRouter.js  # Gmail channel routing
│   │   └── messageGenerator.js # Mistral AI email gen
│   ├── email/
│   │   ├── templates.js      # Fallback email templates
│   │   ├── htmlWrapper.js    # HTML email wrapper
│   │   └── mailer.js         # Nodemailer Gmail SMTP
│   ├── utils/
│   │   └── shapTranslator.js # SHAP → plain English
│   ├── validation/
│   │   └── schemas.js        # Zod schemas
│   ├── middleware/
│   │   └── errorHandler.js   # Global error handler
│   ├── routes/
│   │   └── intervention.js   # All route handlers
│   └── server.js             # Express entry point
├── tests/
│   ├── tierRouter.test.js
│   ├── offerEngine.test.js
│   ├── channelRouter.test.js
│   ├── messageGenerator.test.js
│   └── intervention.routes.test.js
├── .env.example
├── jest.config.js
├── package.json
└── README.md
```

---

## Database Tables (Owned by This Service)

```sql
-- Created automatically on startup via migration
intervention_log  — logs every intervention trigger
outcome_log       — logs customer response to intervention
```

The service **reads** from the `customers` table (owned by FastAPI) and **writes** only to its own two tables.
