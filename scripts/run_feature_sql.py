"""
Execute the feature SQL against PostgreSQL to populate customer_features,
then export the result to Parquet for Feast.

Usage:
    source delinquencyenv/bin/activate
    python scripts/run_feature_sql.py
"""

import os
import pathlib

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

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
FEATURE_SQL_PATH = PROJECT_ROOT / "scripts" / "feature_sql.sql"
PARQUET_OUTPUT = PROJECT_ROOT / "feast_repo" / "data" / "customer_features.parquet"


def main():
    print("═" * 60)
    print("  Feature SQL Runner")
    print("═" * 60)

    engine = create_engine(DATABASE_URL)

    # ── Execute feature SQL ───────────────────────────────────────────────
    print(f"▸ Reading SQL from {FEATURE_SQL_PATH}...")
    sql = FEATURE_SQL_PATH.read_text()

    print("▸ Executing feature SQL...")
    with engine.begin() as conn:
        conn.execute(text(sql))

    # ── Verify ────────────────────────────────────────────────────────────
    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM customer_features")).scalar()
        print(f"  ✔ customer_features: {count:,} rows")

        # Quick sanity check
        sample = conn.execute(text(
            "SELECT customer_id, credit_score, emi_to_income_ratio, "
            "composite_stress_index, failed_autodebit_count "
            "FROM customer_features ORDER BY composite_stress_index DESC LIMIT 5"
        ))
        print("\n  Top 5 by composite_stress_index:")
        for row in sample:
            print(f"    {row[0]}: credit={row[1]:.0f}, emi_ratio={row[2]:.3f}, "
                  f"stress={row[3]:.4f}, failed_ad={row[4]:.0f}")

    # ── Export to Parquet for Feast ────────────────────────────────────────
    print(f"\n▸ Exporting to Parquet: {PARQUET_OUTPUT}...")
    PARQUET_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    df = pd.read_sql("SELECT * FROM customer_features", engine)

    # Ensure event_timestamp is timezone-aware (Feast requires it)
    if df["event_timestamp"].dt.tz is None:
        df["event_timestamp"] = df["event_timestamp"].dt.tz_localize("UTC")

    df.to_parquet(PARQUET_OUTPUT, index=False)
    print(f"  ✔ Exported {len(df):,} rows to {PARQUET_OUTPUT.name}")

    # Show schema summary
    print(f"\n  Columns ({len(df.columns)}):")
    for col in df.columns:
        print(f"    {col}: {df[col].dtype}")

    print("\n✔ Feature pipeline complete!")


if __name__ == "__main__":
    main()
