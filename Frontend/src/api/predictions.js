/**
 * Prediction API — wraps GET /predict/{customer_id}
 *
 * Response shape (from FastAPI main.py):
 * {
 *   customer_id: string,
 *   prediction: number (0|1),
 *   label: "delinquency" | "no_delinquency",
 *   probabilities: { no_delinquency: float, delinquency: float },
 *   explanation: {
 *     method: string,
 *     base_value: float,
 *     top_3_reasons: [{ feature, feature_label, feature_value, shap_value, direction }]
 *   },
 *   all_feature_contributions: [{ feature, feature_label, feature_value, shap_value, direction }]
 * }
 */
import { fastApi } from './client';

/**
 * GET /predict/{customerId}
 * Fetches features from Feast and returns prediction + SHAP explanations.
 */
export async function predictCustomer(customerId) {
  const { data } = await fastApi.get(`/predict/${customerId}`);
  return data;
}
