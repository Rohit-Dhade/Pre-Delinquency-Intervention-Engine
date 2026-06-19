"""
Employee Authentication & Authorisation Package
for the Pre-Delinquency Intervention Engine.
"""

import os
from dotenv import load_dotenv

# Load .env from Employee_Authentication root
_env_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
)
load_dotenv(_env_path, override=False)
