-- ══════════════════════════════════════════════════════════════════════════════
-- Pre-Delinquency Engine — Source Tables DDL
-- Database: delinquency_db
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Customers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    customer_id     VARCHAR(20) PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    dob             DATE,
    segment         VARCHAR(30)  NOT NULL,         -- salaried / self_employed
    geography       VARCHAR(20)  NOT NULL,         -- rural / tier2 / urban
    credit_score    INTEGER      NOT NULL,         -- 300–900
    phone_number    VARCHAR(20),
    email           VARCHAR(100),
    account_number  VARCHAR(20),
    ifsc_code       VARCHAR(20),
    created_at      TIMESTAMP    DEFAULT NOW()
);

-- ── 2. Transactions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    txn_id              SERIAL PRIMARY KEY,
    customer_id         VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
    txn_type            VARCHAR(20)  NOT NULL,     -- credit / debit
    amount              NUMERIC(12,2) NOT NULL,
    channel             VARCHAR(20)  NOT NULL,     -- UPI / ATM / NEFT / POS / IMPS
    merchant_category   VARCHAR(50),               -- grocery / gambling / lending_app / utility / salary / ...
    txn_timestamp       TIMESTAMP NOT NULL
);

-- ── 3. Payment Events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_events (
    event_id        SERIAL PRIMARY KEY,
    customer_id     VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
    event_type      VARCHAR(30)  NOT NULL,         -- EMI / autodebit / utility
    status          VARCHAR(10)  NOT NULL,         -- success / failed
    due_date        DATE         NOT NULL,
    paid_date       DATE,                          -- NULL if not yet paid
    amount          NUMERIC(12,2) NOT NULL
);

-- ── 4. Customer Features (populated by feature SQL) ──────────────────────────
CREATE TABLE IF NOT EXISTS customer_features (
    customer_id                     VARCHAR(20) NOT NULL,
    feature_date                    DATE        NOT NULL,

    -- Static / demographic
    credit_score                    FLOAT,
    emi_to_income_ratio             FLOAT,

    -- Salary / income signals
    salary_delay_days               FLOAT,
    savings_decline_pct             FLOAT,
    income_drop_pct                 FLOAT,

    -- Payment behavior
    credit_utilization_ratio        FLOAT,
    failed_autodebit_count          FLOAT,
    missed_payments_last_6m         FLOAT,
    utility_payment_delay_days      FLOAT,

    -- Spending behavior
    discretionary_spend_drop_pct    FLOAT,
    gambling_spend_increase_pct     FLOAT,

    -- ATM / UPI signals
    balance_volatility_30d          FLOAT,
    atm_withdrawal_increase_pct     FLOAT,
    atm_withdrawal_count_30d        FLOAT,
    upi_lending_app_txn_count       FLOAT,

    -- Derived flags & trends
    recent_failed_autodebit_flag    FLOAT,
    savings_decline_trend           FLOAT,

    -- Composite risk scores
    risk_momentum_score             FLOAT,
    emi_credit_stress               FLOAT,
    liquidity_stress                FLOAT,
    payment_failure_severity        FLOAT,
    behavioral_risk_score           FLOAT,
    volatility_liquidity_risk       FLOAT,
    composite_stress_index          FLOAT,

    -- Temporal
    month                           FLOAT,
    quarter                         FLOAT,
    month_sin                       FLOAT,
    month_cos                       FLOAT,

    -- One-hot encoded categoricals
    customer_segment_salaried       FLOAT,
    customer_segment_self_employed   FLOAT,
    geography_rural                 FLOAT,
    geography_tier2                 FLOAT,
    risk_cohort_moderate            FLOAT,
    risk_cohort_stable              FLOAT,

    -- Metadata
    event_timestamp                 TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at                      TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (customer_id, feature_date)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_txn_customer     ON transactions(customer_id, txn_timestamp);
CREATE INDEX IF NOT EXISTS idx_txn_channel      ON transactions(channel);
CREATE INDEX IF NOT EXISTS idx_txn_category     ON transactions(merchant_category);
CREATE INDEX IF NOT EXISTS idx_pe_customer      ON payment_events(customer_id, due_date);
CREATE INDEX IF NOT EXISTS idx_pe_status        ON payment_events(status);
CREATE INDEX IF NOT EXISTS idx_cf_customer_date ON customer_features(customer_id, feature_date);
