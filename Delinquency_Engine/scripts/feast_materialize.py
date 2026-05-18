"""
Script to apply Feast configurations and materialize data to the online store.

Usage:
    source FastApi_Backend/delinquencyenv/bin/activate
    python scripts/feast_materialize.py
"""

import os
import subprocess
from datetime import datetime, timedelta

def main():
    print("═" * 60)
    print("  Feast Apply & Materialize")
    print("═" * 60)

    # Path to the feast_repo directory
    repo_path = os.path.join(os.path.dirname(__file__), "..", "feast_repo")
    
    # ── 1. Feast Apply ────────────────────────────────────────────────────────
    feast_bin = os.path.join(os.path.dirname(__file__), "..", "FastApi_Backend", "delinquencyenv", "bin", "feast")

    print("▸ Running 'feast apply'...")
    try:
        subprocess.run([feast_bin, "apply"], cwd=repo_path, check=True)
        print("  ✔ Feast definitions applied to registry.")
    except subprocess.CalledProcessError as e:
        print(f"  ✖ Error running feast apply: {e}")
        return

    # ── 2. Feast Materialize ──────────────────────────────────────────────────
    # Materialize features from the last 2 days up to now
    start_date = (datetime.utcnow() - timedelta(days=2)).isoformat()
    end_date = datetime.utcnow().isoformat()
    
    print(f"\n▸ Running 'feast materialize {start_date} {end_date}'...")
    try:
        subprocess.run(
            [feast_bin, "materialize", start_date, end_date],
            cwd=repo_path,
            check=True
        )
        print("  ✔ Features materialized to online store.")
    except subprocess.CalledProcessError as e:
        print(f"  ✖ Error running feast materialize: {e}")
        return

    print("\n✔ Feast setup and materialization complete!")

if __name__ == "__main__":
    main()
