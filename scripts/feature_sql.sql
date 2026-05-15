-- ══════════════════════════════════════════════════════════════════════════════
-- Feature SQL: Compute customer_features from source tables
-- Produces one row per customer per day (feature_date = CURRENT_DATE)
--
-- Run with:  psql -U rohit -d delinquency_db -f scripts/feature_sql.sql
-- Or via:    python scripts/run_feature_sql.py
-- ══════════════════════════════════════════════════════════════════════════════

DELETE FROM customer_features WHERE feature_date = CURRENT_DATE;

INSERT INTO customer_features (
    customer_id, feature_date,
    credit_score, emi_to_income_ratio,
    salary_delay_days, savings_decline_pct, income_drop_pct,
    credit_utilization_ratio,
    failed_autodebit_count, missed_payments_last_6m, utility_payment_delay_days,
    discretionary_spend_drop_pct, gambling_spend_increase_pct,
    balance_volatility_30d,
    atm_withdrawal_increase_pct, atm_withdrawal_count_30d,
    upi_lending_app_txn_count,
    recent_failed_autodebit_flag, savings_decline_trend,
    risk_momentum_score, emi_credit_stress, liquidity_stress,
    payment_failure_severity, behavioral_risk_score,
    volatility_liquidity_risk, composite_stress_index,
    month, quarter, month_sin, month_cos,
    customer_segment_salaried, customer_segment_self_employed,
    geography_rural, geography_tier2,
    risk_cohort_moderate, risk_cohort_stable,
    event_timestamp
)
WITH

-- ── Monthly income (salary credits) ─────────────────────────────────────────
salary AS (
    SELECT
        customer_id,
        -- Average salary amount
        AVG(amount) AS avg_salary,
        -- Salary delay: avg days from 1st of month to salary credit
        AVG(EXTRACT(DAY FROM txn_timestamp) - 1) AS salary_delay_days,
        -- Previous month salary for income drop calculation
        AVG(CASE WHEN txn_timestamp >= CURRENT_DATE - INTERVAL '60 days'
                  AND txn_timestamp < CURRENT_DATE - INTERVAL '30 days'
             THEN amount END) AS prev_month_salary,
        AVG(CASE WHEN txn_timestamp >= CURRENT_DATE - INTERVAL '30 days'
             THEN amount END) AS curr_month_salary
    FROM transactions
    WHERE merchant_category = 'salary'
      AND txn_type = 'credit'
      AND txn_timestamp >= CURRENT_DATE - INTERVAL '180 days'
    GROUP BY customer_id
),

-- ── Savings (total credits vs total debits as proxy) ─────────────────────────
savings AS (
    SELECT
        customer_id,
        -- Savings in recent 30d vs previous 30d
        SUM(CASE WHEN txn_type = 'credit' AND txn_timestamp >= CURRENT_DATE - INTERVAL '30 days'
             THEN amount ELSE 0 END)
        - SUM(CASE WHEN txn_type = 'debit' AND txn_timestamp >= CURRENT_DATE - INTERVAL '30 days'
              THEN amount ELSE 0 END) AS savings_recent,
        SUM(CASE WHEN txn_type = 'credit' AND txn_timestamp >= CURRENT_DATE - INTERVAL '60 days'
                  AND txn_timestamp < CURRENT_DATE - INTERVAL '30 days'
             THEN amount ELSE 0 END)
        - SUM(CASE WHEN txn_type = 'debit' AND txn_timestamp >= CURRENT_DATE - INTERVAL '60 days'
                   AND txn_timestamp < CURRENT_DATE - INTERVAL '30 days'
              THEN amount ELSE 0 END) AS savings_prev
    FROM transactions
    WHERE txn_timestamp >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY customer_id
),

-- ── Payment failures ─────────────────────────────────────────────────────────
payment_stats AS (
    SELECT
        customer_id,
        -- Failed autodebit count (last 180 days)
        COUNT(*) FILTER (WHERE event_type = 'autodebit' AND status = 'failed') AS failed_autodebit_count,
        -- Missed payments in last 6 months (any type)
        COUNT(*) FILTER (WHERE status = 'failed') AS missed_payments_last_6m,
        -- Total payments for severity calc
        COUNT(*) AS total_payments,
        -- Recent failed autodebit (last 30 days)
        COUNT(*) FILTER (WHERE event_type = 'autodebit'
                           AND status = 'failed'
                           AND due_date >= CURRENT_DATE - INTERVAL '30 days') AS recent_failed_autodebit,
        -- Utility payment delay
        AVG(CASE WHEN event_type = 'utility' AND status = 'success' AND paid_date IS NOT NULL
             THEN GREATEST(0, paid_date - due_date) END) AS utility_payment_delay_days,
        -- EMI amounts for emi_to_income_ratio
        AVG(CASE WHEN event_type = 'EMI' THEN amount END) AS avg_emi_amount
    FROM payment_events
    WHERE due_date >= CURRENT_DATE - INTERVAL '180 days'
    GROUP BY customer_id
),

-- ── Spending patterns ────────────────────────────────────────────────────────
spending AS (
    SELECT
        customer_id,
        -- Discretionary spending (dining + entertainment + travel) - compare 30d vs prev 30d
        SUM(CASE WHEN merchant_category IN ('dining','entertainment','travel')
                  AND txn_timestamp >= CURRENT_DATE - INTERVAL '30 days'
             THEN amount ELSE 0 END) AS disc_spend_recent,
        SUM(CASE WHEN merchant_category IN ('dining','entertainment','travel')
                  AND txn_timestamp >= CURRENT_DATE - INTERVAL '60 days'
                  AND txn_timestamp < CURRENT_DATE - INTERVAL '30 days'
             THEN amount ELSE 0 END) AS disc_spend_prev,
        -- Gambling spend
        SUM(CASE WHEN merchant_category = 'gambling'
                  AND txn_timestamp >= CURRENT_DATE - INTERVAL '30 days'
             THEN amount ELSE 0 END) AS gambling_recent,
        SUM(CASE WHEN merchant_category = 'gambling'
                  AND txn_timestamp >= CURRENT_DATE - INTERVAL '60 days'
                  AND txn_timestamp < CURRENT_DATE - INTERVAL '30 days'
             THEN amount ELSE 0 END) AS gambling_prev,
        -- Total debit for credit utilization proxy
        SUM(CASE WHEN txn_type = 'debit'
                  AND txn_timestamp >= CURRENT_DATE - INTERVAL '30 days'
             THEN amount ELSE 0 END) AS total_debit_30d,
        SUM(CASE WHEN txn_type = 'credit'
                  AND txn_timestamp >= CURRENT_DATE - INTERVAL '30 days'
             THEN amount ELSE 0 END) AS total_credit_30d
    FROM transactions
    WHERE txn_timestamp >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY customer_id
),

-- ── ATM & UPI signals ────────────────────────────────────────────────────────
atm_upi AS (
    SELECT
        customer_id,
        -- ATM withdrawals in last 30 days
        COUNT(*) FILTER (WHERE channel = 'ATM'
                           AND txn_timestamp >= CURRENT_DATE - INTERVAL '30 days') AS atm_count_30d,
        -- ATM withdrawals in prev 30 days
        COUNT(*) FILTER (WHERE channel = 'ATM'
                           AND txn_timestamp >= CURRENT_DATE - INTERVAL '60 days'
                           AND txn_timestamp < CURRENT_DATE - INTERVAL '30 days') AS atm_count_prev,
        -- UPI lending app transactions
        COUNT(*) FILTER (WHERE merchant_category = 'lending_app'
                           AND txn_timestamp >= CURRENT_DATE - INTERVAL '30 days') AS upi_lending_count
    FROM transactions
    WHERE txn_timestamp >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY customer_id
),

-- ── Balance volatility ───────────────────────────────────────────────────────
daily_balances AS (
    SELECT
        customer_id,
        DATE(txn_timestamp) AS txn_date,
        SUM(CASE WHEN txn_type = 'credit' THEN amount ELSE -amount END) AS daily_net
    FROM transactions
    WHERE txn_timestamp >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY customer_id, DATE(txn_timestamp)
),
volatility AS (
    SELECT
        customer_id,
        COALESCE(STDDEV(daily_net), 0) AS balance_volatility_30d
    FROM daily_balances
    GROUP BY customer_id
)

-- ══════════════════════════════════════════════════════════════════════════════
-- Final SELECT: assemble all features
-- ══════════════════════════════════════════════════════════════════════════════
SELECT
    c.customer_id,
    CURRENT_DATE AS feature_date,

    -- ── Static / demographic ──────────────────────────────────────────────
    c.credit_score::FLOAT,

    -- EMI-to-income ratio
    COALESCE(
        CASE WHEN COALESCE(sal.avg_salary, 0) > 0
             THEN LEAST(ps.avg_emi_amount / sal.avg_salary, 1.0)
             ELSE 0.5 END,
        0.0
    ) AS emi_to_income_ratio,

    -- ── Salary / income signals ───────────────────────────────────────────
    COALESCE(sal.salary_delay_days, 0) AS salary_delay_days,

    -- Savings decline pct
    COALESCE(
        CASE WHEN COALESCE(sav.savings_prev, 0) != 0
             THEN GREATEST(0, (sav.savings_prev - sav.savings_recent) / ABS(sav.savings_prev) * 100)
             ELSE 0 END,
        0
    ) AS savings_decline_pct,

    -- Income drop pct
    COALESCE(
        CASE WHEN COALESCE(sal.prev_month_salary, 0) > 0
             THEN GREATEST(0, (sal.prev_month_salary - sal.curr_month_salary) / sal.prev_month_salary * 100)
             ELSE 0 END,
        0
    ) AS income_drop_pct,

    -- ── Credit utilization ────────────────────────────────────────────────
    COALESCE(
        CASE WHEN COALESCE(sp.total_credit_30d, 0) > 0
             THEN LEAST(sp.total_debit_30d / sp.total_credit_30d, 1.5)
             ELSE 0.5 END,
        0.0
    ) AS credit_utilization_ratio,

    -- ── Payment behavior ──────────────────────────────────────────────────
    COALESCE(ps.failed_autodebit_count, 0)::FLOAT AS failed_autodebit_count,
    COALESCE(ps.missed_payments_last_6m, 0)::FLOAT AS missed_payments_last_6m,
    COALESCE(ps.utility_payment_delay_days, 0) AS utility_payment_delay_days,

    -- ── Spending behavior ─────────────────────────────────────────────────
    COALESCE(
        CASE WHEN COALESCE(sp.disc_spend_prev, 0) > 0
             THEN GREATEST(0, (sp.disc_spend_prev - sp.disc_spend_recent) / sp.disc_spend_prev * 100)
             ELSE 0 END,
        0
    ) AS discretionary_spend_drop_pct,

    COALESCE(
        CASE WHEN COALESCE(sp.gambling_prev, 0) > 0
             THEN GREATEST(0, (sp.gambling_recent - sp.gambling_prev) / sp.gambling_prev * 100)
             ELSE CASE WHEN COALESCE(sp.gambling_recent, 0) > 0 THEN 100 ELSE 0 END
        END,
        0
    ) AS gambling_spend_increase_pct,

    -- ── Volatility / ATM / UPI ────────────────────────────────────────────
    COALESCE(v.balance_volatility_30d, 0) AS balance_volatility_30d,

    COALESCE(
        CASE WHEN COALESCE(au.atm_count_prev, 0) > 0
             THEN (au.atm_count_30d - au.atm_count_prev)::FLOAT / au.atm_count_prev * 100
             ELSE CASE WHEN COALESCE(au.atm_count_30d, 0) > 0 THEN 100 ELSE 0 END
        END,
        0
    ) AS atm_withdrawal_increase_pct,

    COALESCE(au.atm_count_30d, 0)::FLOAT AS atm_withdrawal_count_30d,
    COALESCE(au.upi_lending_count, 0)::FLOAT AS upi_lending_app_txn_count,

    -- ── Derived flags ─────────────────────────────────────────────────────
    CASE WHEN COALESCE(ps.recent_failed_autodebit, 0) > 0 THEN 1.0 ELSE 0.0 END AS recent_failed_autodebit_flag,

    -- Savings decline trend: -1 (falling), 0 (stable), 1 (rising)
    COALESCE(
        CASE WHEN sav.savings_recent < sav.savings_prev * 0.9 THEN -1.0
             WHEN sav.savings_recent > sav.savings_prev * 1.1 THEN 1.0
             ELSE 0.0 END,
        0.0
    ) AS savings_decline_trend,

    -- ══════════════════════════════════════════════════════════════════════
    -- Composite risk scores (derived from the above)
    -- ══════════════════════════════════════════════════════════════════════

    -- risk_momentum_score: weighted sum of failure rate + income drop + savings decline
    (
        COALESCE(ps.missed_payments_last_6m, 0)::FLOAT * 0.3
      + COALESCE(
            CASE WHEN COALESCE(sal.prev_month_salary, 0) > 0
                 THEN GREATEST(0, (sal.prev_month_salary - sal.curr_month_salary) / sal.prev_month_salary)
                 ELSE 0 END, 0) * 0.4
      + COALESCE(
            CASE WHEN COALESCE(sav.savings_prev, 0) != 0
                 THEN GREATEST(0, (sav.savings_prev - sav.savings_recent) / ABS(sav.savings_prev))
                 ELSE 0 END, 0) * 0.3
    ) AS risk_momentum_score,

    -- emi_credit_stress: emi_ratio × credit_utilization
    COALESCE(
        CASE WHEN COALESCE(sal.avg_salary, 0) > 0
             THEN LEAST(ps.avg_emi_amount / sal.avg_salary, 1.0)
             ELSE 0.5 END, 0)
    * COALESCE(
        CASE WHEN COALESCE(sp.total_credit_30d, 0) > 0
             THEN LEAST(sp.total_debit_30d / sp.total_credit_30d, 1.5)
             ELSE 0.5 END, 0)
    AS emi_credit_stress,

    -- liquidity_stress: (debit - credit) / credit in last 30d
    COALESCE(
        CASE WHEN COALESCE(sp.total_credit_30d, 0) > 0
             THEN GREATEST(0, (sp.total_debit_30d - sp.total_credit_30d) / sp.total_credit_30d)
             ELSE 0 END,
        0
    ) AS liquidity_stress,

    -- payment_failure_severity: failed_count / total_count
    COALESCE(
        CASE WHEN COALESCE(ps.total_payments, 0) > 0
             THEN ps.missed_payments_last_6m::FLOAT / ps.total_payments
             ELSE 0 END,
        0
    ) AS payment_failure_severity,

    -- behavioral_risk_score: gambling + atm + lending_app weighted
    (
        COALESCE(
            CASE WHEN COALESCE(sp.gambling_prev, 0) > 0
                 THEN LEAST((sp.gambling_recent - sp.gambling_prev) / sp.gambling_prev, 2)
                 ELSE CASE WHEN COALESCE(sp.gambling_recent, 0) > 0 THEN 1 ELSE 0 END
            END, 0) * 0.4
      + COALESCE(
            CASE WHEN COALESCE(au.atm_count_prev, 0) > 0
                 THEN LEAST((au.atm_count_30d - au.atm_count_prev)::FLOAT / au.atm_count_prev, 2)
                 ELSE CASE WHEN COALESCE(au.atm_count_30d, 0) > 0 THEN 1 ELSE 0 END
            END, 0) * 0.3
      + LEAST(COALESCE(au.upi_lending_count, 0)::FLOAT / 5.0, 1.0) * 0.3
    ) AS behavioral_risk_score,

    -- volatility_liquidity_risk: volatility × liquidity stress
    COALESCE(v.balance_volatility_30d, 0) / GREATEST(COALESCE(sal.avg_salary, 30000), 1)
    * COALESCE(
        CASE WHEN COALESCE(sp.total_credit_30d, 0) > 0
             THEN GREATEST(0, (sp.total_debit_30d - sp.total_credit_30d) / sp.total_credit_30d)
             ELSE 0 END, 0)
    AS volatility_liquidity_risk,

    -- composite_stress_index: master score
    (
        -- 20% payment failures
        COALESCE(CASE WHEN COALESCE(ps.total_payments, 0) > 0
                      THEN ps.missed_payments_last_6m::FLOAT / ps.total_payments
                      ELSE 0 END, 0) * 0.20
        -- 20% emi stress
      + COALESCE(
            CASE WHEN COALESCE(sal.avg_salary, 0) > 0
                 THEN LEAST(ps.avg_emi_amount / sal.avg_salary, 1.0) ELSE 0.5 END, 0)
        * COALESCE(
            CASE WHEN COALESCE(sp.total_credit_30d, 0) > 0
                 THEN LEAST(sp.total_debit_30d / sp.total_credit_30d, 1.5) ELSE 0.5 END, 0)
        * 0.20
        -- 15% income drop
      + COALESCE(
            CASE WHEN COALESCE(sal.prev_month_salary, 0) > 0
                 THEN GREATEST(0, (sal.prev_month_salary - sal.curr_month_salary) / sal.prev_month_salary)
                 ELSE 0 END, 0) * 0.15
        -- 15% savings decline
      + COALESCE(
            CASE WHEN COALESCE(sav.savings_prev, 0) != 0
                 THEN GREATEST(0, (sav.savings_prev - sav.savings_recent) / ABS(sav.savings_prev))
                 ELSE 0 END, 0) * 0.15
        -- 15% behavioral
      + (COALESCE(
            CASE WHEN COALESCE(sp.gambling_prev, 0) > 0
                 THEN LEAST((sp.gambling_recent - sp.gambling_prev) / sp.gambling_prev, 2)
                 ELSE CASE WHEN COALESCE(sp.gambling_recent, 0) > 0 THEN 1 ELSE 0 END
            END, 0) * 0.4
        + LEAST(COALESCE(au.upi_lending_count, 0)::FLOAT / 5.0, 1.0) * 0.6) * 0.15
        -- 15% credit score normalized (inverted: low score = high stress)
      + (1.0 - (c.credit_score - 300.0) / 600.0) * 0.15
    ) AS composite_stress_index,

    -- ── Temporal features ─────────────────────────────────────────────────
    EXTRACT(MONTH FROM CURRENT_DATE)::FLOAT AS month,
    EXTRACT(QUARTER FROM CURRENT_DATE)::FLOAT AS quarter,
    SIN(2 * PI() * EXTRACT(MONTH FROM CURRENT_DATE) / 12.0) AS month_sin,
    COS(2 * PI() * EXTRACT(MONTH FROM CURRENT_DATE) / 12.0) AS month_cos,

    -- ── One-hot encoded categoricals ──────────────────────────────────────
    CASE WHEN c.segment = 'salaried' THEN 1.0 ELSE 0.0 END AS customer_segment_salaried,
    CASE WHEN c.segment = 'self_employed' THEN 1.0 ELSE 0.0 END AS customer_segment_self_employed,
    CASE WHEN c.geography = 'rural' THEN 1.0 ELSE 0.0 END AS geography_rural,
    CASE WHEN c.geography = 'tier2' THEN 1.0 ELSE 0.0 END AS geography_tier2,

    -- Risk cohort (derived from credit score bands)
    CASE WHEN c.credit_score BETWEEN 550 AND 700 THEN 1.0 ELSE 0.0 END AS risk_cohort_moderate,
    CASE WHEN c.credit_score > 700 THEN 1.0 ELSE 0.0 END AS risk_cohort_stable,

    -- Metadata
    NOW() AS event_timestamp

FROM customers c
LEFT JOIN salary sal ON c.customer_id = sal.customer_id
LEFT JOIN savings sav ON c.customer_id = sav.customer_id
LEFT JOIN payment_stats ps ON c.customer_id = ps.customer_id
LEFT JOIN spending sp ON c.customer_id = sp.customer_id
LEFT JOIN atm_upi au ON c.customer_id = au.customer_id
LEFT JOIN volatility v ON c.customer_id = v.customer_id;
