"""
Simulate live real-world traffic by inserting new transactions and payment events.

Usage:
    source FastApi_Backend/delinquencyenv/bin/activate
    python scripts/simulate_live_traffic.py
"""

import os
import random
import time
from datetime import datetime, date, timedelta

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

# Simulation Settings
ITERATIONS = 50           # Fixed number of iterations to run
MIN_SLEEP_SECONDS = 280    # Minimum wait time to mimic slow real-world traffic
MAX_SLEEP_SECONDS = 600   # Maximum wait time
MAX_TXNS_PER_CYCLE = 5    # Max number of transactions generated per cycle

# Data Reference
CHANNELS = ["UPI", "ATM", "NEFT", "POS", "IMPS"]
TXN_TYPES = ["credit", "debit"]
MERCHANT_CATEGORIES = [
    "salary", "grocery", "utility", "dining", "entertainment",
    "travel", "gambling", "lending_app", "fuel", "healthcare",
    "education", "rent", "insurance", "ecommerce", "other",
]
PAYMENT_EVENT_TYPES = ["EMI", "autodebit", "utility"]

rng = np.random.default_rng()

def get_all_customers(engine):
    with engine.connect() as conn:
        result = conn.execute(text("SELECT customer_id, segment, credit_score FROM customers"))
        return pd.DataFrame(result.fetchall(), columns=result.keys())

def insert_transactions(engine, customers_df, num_txns):
    rows = []
    sampled_customers = customers_df.sample(num_txns, replace=True)
    
    for _, cust in sampled_customers.iterrows():
        txn_type = random.choices(TXN_TYPES, weights=[0.40, 0.60])[0]
        channel = random.choices(CHANNELS, weights=[0.40, 0.10, 0.10, 0.20, 0.20])[0]
        
        if txn_type == "credit":
            cat = random.choices(["salary", "other", "insurance", "rent"], weights=[0.50, 0.30, 0.05, 0.15])[0]
        else:
            cat = random.choices(MERCHANT_CATEGORIES, weights=[0.02, 0.25, 0.10, 0.15, 0.05, 0.05, 0.03, 0.05, 0.08, 0.05, 0.02, 0.05, 0.02, 0.10, 0.03])[0]

        if cat == "salary":
            amt = round(rng.normal(50000 if cust['segment'] == "salaried" else 35000, 15000), 2)
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

        if channel == "ATM":
            txn_type = "debit"
            cat = random.choice(["other", "fuel", "grocery"])

        rows.append({
            "customer_id": cust['customer_id'],
            "txn_type": txn_type,
            "amount": amt,
            "channel": channel,
            "merchant_category": cat,
            "txn_timestamp": datetime.now()
        })

    if rows:
        df = pd.DataFrame(rows)
        df.to_sql("transactions", engine, if_exists="append", index=False)
        for _, row in df.iterrows():
            print(f"  [TXN] {row['customer_id']} -> {row['txn_type'].upper()} \u20b9{row['amount']} via {row['channel']} ({row['merchant_category']})")

def insert_payment_events(engine, customers_df):
    cust = customers_df.sample(1).iloc[0]
    
    # Simulate a payment event that is due today
    event_type = random.choice(PAYMENT_EVENT_TYPES)
    amt = round(rng.normal(5000, 2000), 2)
    amt = max(500, amt)
    
    cs = cust['credit_score']
    fail_prob = np.clip(0.5 - (cs - 300) / 1200, 0.02, 0.40)
    
    if random.random() < fail_prob:
        status = "failed"
        paid_date = None
    else:
        status = "success"
        paid_date = date.today()
        
    row = {
        "customer_id": cust['customer_id'],
        "event_type": event_type,
        "status": status,
        "due_date": date.today(),
        "paid_date": paid_date,
        "amount": round(amt, 2)
    }
    
    df = pd.DataFrame([row])
    df.to_sql("payment_events", engine, if_exists="append", index=False)
    
    status_str = "SUCCESS" if status == "success" else "FAILED"
    print(f"  [PAYMENT] {row['customer_id']} -> {event_type} of \u20b9{row['amount']} {status_str}")


def main():
    print("═" * 60)
    print(f"  Live Traffic Simulation Started (Iter: {ITERATIONS})")
    print("═" * 60)
    
    engine = create_engine(DATABASE_URL)
    
    try:
        customers_df = get_all_customers(engine)
        print(f"▸ Loaded {len(customers_df)} customers from DB.")
    except Exception as e:
        print(f"✖ Error connecting to DB: {e}")
        return

    for i in range(1, ITERATIONS + 1):
        print(f"\n[Cycle {i}/{ITERATIONS}] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 1. Generate Transactions
        num_txns = random.randint(1, MAX_TXNS_PER_CYCLE)
        try:
            insert_transactions(engine, customers_df, num_txns)
        except Exception as e:
            print(f"  ✖ Error inserting transaction: {e}")
            
        # 2. Generate Payment Events (20% chance per cycle to happen)
        if random.random() < 0.20:
            try:
                insert_payment_events(engine, customers_df)
            except Exception as e:
                print(f"  ✖ Error inserting payment event: {e}")

        if i < ITERATIONS:
            sleep_time = random.randint(MIN_SLEEP_SECONDS, MAX_SLEEP_SECONDS)
            print(f"  ... waiting {sleep_time} seconds before next event ...")
            time.sleep(sleep_time)
            
    print("\n✔ Simulation complete!")

if __name__ == "__main__":
    main()
