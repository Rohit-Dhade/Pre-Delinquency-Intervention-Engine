from datetime import datetime, timedelta
import os
import pathlib
from airflow import DAG
from airflow.operators.bash import BashOperator

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
PYTHON_BIN = str(PROJECT_ROOT / "FastApi_Backend" / "delinquencyenv" / "bin" / "python")
SCRIPTS_DIR = str(PROJECT_ROOT / "scripts")

default_args = {
    'owner': 'rohit',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'delinquency_feature_pipeline',
    default_args=default_args,
    description='Daily pipeline: feature SQL -> Feast Parquet -> Feast Materialize',
    schedule_interval=timedelta(days=1),
    start_date=datetime(2026, 5, 14),
    catchup=False,
    tags=['delinquency', 'feast'],
) as dag:

    # 1. Run Feature SQL & Export to Parquet
    run_feature_sql = BashOperator(
        task_id='run_feature_sql',
        bash_command=f"cd {PROJECT_ROOT} && {PYTHON_BIN} {SCRIPTS_DIR}/run_feature_sql.py",
    )

    # 2. Materialize Feast Online Store
    feast_materialize = BashOperator(
        task_id='feast_materialize',
        bash_command=f"cd {PROJECT_ROOT} && {PYTHON_BIN} {SCRIPTS_DIR}/feast_materialize.py",
    )

    # Define execution order
    run_feature_sql >> feast_materialize
