"""
Generate synthetic data for the Pre-Delinquency Engine and load into PostgreSQL.

Generates:
  - 2,000 customers
  - ~70,000 transactions
  - ~30,000 payment events

Usage:
    source delinquencyenv/bin/activate
    python scripts/generate_synthetic_data.py
"""

import os
import random
import math
from datetime import datetime, timedelta, date

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

# ── Config ────────────────────────────────────────────────────────────────────
DB_USER = os.getenv("POSTGRES_USER", "rohit")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "@sy2026")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "delinquency_db")
import urllib.parse
DB_PASS_ENCODED = urllib.parse.quote_plus(DB_PASS)
DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASS_ENCODED}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

NUM_CUSTOMERS = 2_000
TARGET_TRANSACTIONS = 70_000
TARGET_PAYMENT_EVENTS = 30_000

# Date range: 6 months of history
END_DATE = date(2026, 5, 15)
START_DATE = END_DATE - timedelta(days=180)

# ── Helpers ───────────────────────────────────────────────────────────────────
SEGMENTS = ["salaried", "self_employed"]
GEOGRAPHIES = ["urban", "tier2", "rural"]
CHANNELS = ["UPI", "ATM", "NEFT", "POS", "IMPS"]
TXN_TYPES = ["credit", "debit"]
MERCHANT_CATEGORIES = [
    "salary", "grocery", "utility", "dining", "entertainment",
    "travel", "gambling", "lending_app", "fuel", "healthcare",
    "education", "rent", "insurance", "ecommerce", "other",
]
PAYMENT_EVENT_TYPES = ["EMI", "autodebit", "utility"]
PAYMENT_STATUSES = ["success", "failed"]

FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh",
    "Ayaan", "Krishna", "Ishaan", "Ananya", "Diya", "Priya", "Saanvi",
    "Aanya", "Isha", "Kavya", "Mira", "Riya", "Tara", "Rohit", "Amit",
    "Suresh", "Neha", "Pooja", "Rahul", "Deepak", "Sneha", "Manish",
    "Swati", "Vikram", "Meera", "Akash", "Nisha", "Raj", "Simran",
    "Karan", "Anjali", "Gaurav", "Divya",
]
LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Gupta", "Singh", "Kumar", "Joshi",
    "Reddy", "Nair", "Iyer", "Das", "Bose", "Mehta", "Chopra",
    "Kapoor", "Malhotra", "Rao", "Pillai", "Desai", "Shah",
]

rng = np.random.default_rng(42)
random.seed(42)


def random_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=int(rng.integers(0, max(delta, 1))))


def random_datetime(start: date, end: date) -> datetime:
    d = random_date(start, end)
    return datetime(d.year, d.month, d.day,
                    int(rng.integers(6, 23)), int(rng.integers(0, 60)), int(rng.integers(0, 60)))


# ══════════════════════════════════════════════════════════════════════════════
# 1. Generate Customers
# ══════════════════════════════════════════════════════════════════════════════
def generate_customers(n: int) -> pd.DataFrame:
    print(f"▸ Generating {n} customers...")
    rows = []
    for i in range(1, n + 1):
        cid = f"CUST_{i:04d}"
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        dob = random_date(date(1965, 1, 1), date(2000, 12, 31))
        segment = random.choices(SEGMENTS, weights=[0.65, 0.35])[0]
        geography = random.choices(GEOGRAPHIES, weights=[0.45, 0.35, 0.20])[0]
        credit_score = int(np.clip(rng.normal(700, 80), 300, 900))
        created_at = random_datetime(date(2020, 1, 1), START_DATE)
        
        phone_number = f"+91{int(rng.integers(6000000000, 10000000000))}"
        email = f"{name.lower().replace(' ', '.')}@example.com"
        account_number = f"{int(rng.integers(10000000000, 100000000000))}"
        ifsc_code = f"HDFC0{int(rng.integers(100000, 1000000))}"
        
        if cid == "CUST_0001":
            email = "rohitdhade99@gmail.com"
        elif cid == "CUST_0002":
            email = "kartikbhangale20@gmail.com"
        elif cid == "CUST_0003":
            email = "bhaveshgirase27@gmail.com"
            
        rows.append({
            "customer_id": cid,
            "name": name,
            "dob": dob,
            "segment": segment,
            "geography": geography,
            "credit_score": credit_score,
            "phone_number": phone_number,
            "email": email,
            "account_number": account_number,
            "ifsc_code": ifsc_code,
            "created_at": created_at,
        })
    return pd.DataFrame(rows)


# ══════════════════════════════════════════════════════════════════════════════
# 2. Generate Transactions
# ══════════════════════════════════════════════════════════════════════════════
def generate_transactions(customers_df: pd.DataFrame, target: int) -> pd.DataFrame:
    print(f"▸ Generating ~{target} transactions...")
    customer_ids = customers_df["customer_id"].tolist()
    n_customers = len(customer_ids)

    # Assign each customer a transaction-frequency factor (some are more active)
    activity_factors = rng.exponential(1.0, size=n_customers)
    activity_factors = activity_factors / activity_factors.sum() * target

    rows = []
    for idx, cid in enumerate(customer_ids):
        n_txns = max(5, int(activity_factors[idx]))
        segment = customers_df.iloc[idx]["segment"]

        for _ in range(n_txns):
            txn_type = random.choices(TXN_TYPES, weights=[0.40, 0.60])[0]
            channel = random.choices(CHANNELS, weights=[0.35, 0.15, 0.20, 0.20, 0.10])[0]

            # Merchant category depends on txn type
            if txn_type == "credit":
                cat = random.choices(
                    ["salary", "other", "insurance", "rent"],
                    weights=[0.70, 0.15, 0.05, 0.10]
                )[0]
            else:
                cat = random.choices(
                    MERCHANT_CATEGORIES,
                    weights=[0.02, 0.20, 0.15, 0.12, 0.10,
                             0.05, 0.03, 0.03, 0.08, 0.05,
                             0.03, 0.02, 0.02, 0.08, 0.02]
                )[0]

            # Amount ranges based on category
            if cat == "salary":
                amt = round(rng.normal(50000 if segment == "salaried" else 35000, 15000), 2)
                amt = max(10000, amt)
            elif cat in ("gambling", "lending_app"):
                amt = round(rng.exponential(3000), 2)
            elif cat in ("rent", "insurance"):
                amt = round(rng.normal(15000, 5000), 2)
            elif cat == "utility":
                amt = round(rng.normal(2000, 800), 2)
            else:
                amt = round(rng.exponential(1500), 2)

            amt = round(max(10, amt), 2)

            # Force ATM channel for ATM withdrawals
            if channel == "ATM":
                txn_type = "debit"
                cat = random.choice(["other", "fuel", "grocery"])

            ts = random_datetime(START_DATE, END_DATE)
            rows.append({
                "customer_id": cid,
                "txn_type": txn_type,
                "amount": amt,
                "channel": channel,
                "merchant_category": cat,
                "txn_timestamp": ts,
            })

    # Trim or pad to hit target
    if len(rows) > target:
        rows = random.sample(rows, target)

    return pd.DataFrame(rows)


# ══════════════════════════════════════════════════════════════════════════════
# 3. Generate Payment Events
# ══════════════════════════════════════════════════════════════════════════════
def generate_payment_events(customers_df: pd.DataFrame, target: int) -> pd.DataFrame:
    print(f"▸ Generating ~{target} payment events...")
    customer_ids = customers_df["customer_id"].tolist()
    n_customers = len(customer_ids)
    credit_scores = customers_df.set_index("customer_id")["credit_score"].to_dict()

    events_per_customer = max(1, target // n_customers)
    rows = []

    for cid in customer_ids:
        cs = credit_scores[cid]
        # Lower credit score → higher failure probability
        fail_prob = np.clip(0.5 - (cs - 300) / 1200, 0.02, 0.40)

        n_events = rng.poisson(events_per_customer)
        n_events = max(3, min(n_events, events_per_customer * 3))

        for _ in range(n_events):
            event_type = random.choices(
                PAYMENT_EVENT_TYPES, weights=[0.45, 0.35, 0.20]
            )[0]

            due = random_date(START_DATE, END_DATE)

            if random.random() < fail_prob:
                status = "failed"
                paid_date = None
            else:
                status = "success"
                # Paid on or slightly after due date
                delay = max(0, int(rng.exponential(3)))
                paid_date = due + timedelta(days=delay)

            if event_type == "EMI":
                amt = round(rng.normal(12000, 5000), 2)
            elif event_type == "autodebit":
                amt = round(rng.normal(5000, 2000), 2)
            else:
                amt = round(rng.normal(2000, 800), 2)
            amt = round(max(100, amt), 2)

            rows.append({
                "customer_id": cid,
                "event_type": event_type,
                "status": status,
                "due_date": due,
                "paid_date": paid_date,
                "amount": amt,
            })

    if len(rows) > target:
        rows = random.sample(rows, target)

    return pd.DataFrame(rows)


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════
def main():
    print("═" * 60)
    print("  Pre-Delinquency Engine — Synthetic Data Generator")
    print("═" * 60)
    print(f"  Database : {DB_NAME}")
    print(f"  User     : {DB_USER}")
    print(f"  Target   : {NUM_CUSTOMERS} customers, {TARGET_TRANSACTIONS} txns, {TARGET_PAYMENT_EVENTS} events")
    print()

    # Generate DataFrames
    customers_df = generate_customers(NUM_CUSTOMERS)
    txns_df = generate_transactions(customers_df, TARGET_TRANSACTIONS)
    events_df = generate_payment_events(customers_df, TARGET_PAYMENT_EVENTS)

    print(f"\n  Generated: {len(customers_df)} customers, {len(txns_df)} transactions, {len(events_df)} payment events")

    # Connect and load
    print(f"\n▸ Connecting to {DATABASE_URL.split('@')[1]}...")
    engine = create_engine(DATABASE_URL)

    with engine.begin() as conn:
        # Truncate existing data (idempotent re-runs)
        print("▸ Clearing existing data...")
        conn.execute(text("TRUNCATE customer_features, payment_events, transactions, customers CASCADE"))

    print("▸ Loading customers...")
    customers_df.to_sql("customers", engine, if_exists="append", index=False, method="multi")

    print("▸ Loading transactions (this may take a moment)...")
    txns_df.to_sql("transactions", engine, if_exists="append", index=False,
                   method="multi", chunksize=5000)

    print("▸ Loading payment events...")
    events_df.to_sql("payment_events", engine, if_exists="append", index=False,
                     method="multi", chunksize=5000)

    # Verify
    with engine.connect() as conn:
        for tbl in ["customers", "transactions", "payment_events"]:
            count = conn.execute(text(f"SELECT COUNT(*) FROM {tbl}")).scalar()
            print(f"  ✔ {tbl}: {count:,} rows")

    print("\n✔ Synthetic data loaded successfully!")


if __name__ == "__main__":
    main()
