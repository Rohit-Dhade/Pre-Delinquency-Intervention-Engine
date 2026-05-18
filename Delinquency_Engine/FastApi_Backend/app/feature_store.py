import os
import pathlib
import pandas as pd
from feast import FeatureStore

# Path to the feast_repo directory
REPO_PATH = pathlib.Path(__file__).resolve().parent.parent.parent / "feast_repo"

# Initialize the FeatureStore object
# (This connects to the registry and the online store)
store = FeatureStore(repo_path=str(REPO_PATH))

# We need the list of expected features so we can request them
# The names should match what is stored in the feature view
# Since all model features are under "customer_features_view", we construct the feast keys:
from app.utils import EXPECTED_FEATURES

FEAST_FEATURES = [f"customer_features_view:{feat}" for feat in EXPECTED_FEATURES]

def get_customer_features(customer_id: str) -> pd.DataFrame:
    """
    Fetch the latest features for a given customer from the Feast online store
    and return them as a single-row pandas DataFrame formatted for the model.
    """
    
    # 1. Query the online store
    entity_rows = [{"customer_id": customer_id}]
    feature_vector = store.get_online_features(
        features=FEAST_FEATURES,
        entity_rows=entity_rows,
    ).to_df()
    
    # Check if the customer was found (Feast returns None/NaN if not found)
    # We can check if a core feature like credit_score is null
    if feature_vector.empty or pd.isna(feature_vector["credit_score"].iloc[0]):
        return pd.DataFrame() # Empty dataframe means customer not found
        
    # 2. Format the dataframe for the model
    # The dataframe returned by Feast contains columns like 'credit_score'
    # as well as the join key 'customer_id'.
    # We just need to extract the expected features in the right order.
    df_model = feature_vector[EXPECTED_FEATURES].copy()
    
    # Ensure float types
    df_model = df_model.astype(float)
    
    # Fill any missing values with 0.0 just in case
    df_model.fillna(0.0, inplace=True)
    
    return df_model
