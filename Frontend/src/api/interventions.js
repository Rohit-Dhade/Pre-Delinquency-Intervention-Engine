/**
 * Intervention API — wraps /intervention/* proxy endpoints on FastAPI.
 *
 * All calls go through FastAPI (port 8000) which proxies to Node.js.
 * This keeps auth handling on one gateway.
 */
import { fastApi } from './client';

/**
 * POST /intervention/trigger  (proxied from FastAPI → Node.js)
 * Not called directly from frontend for predictions;
 * called manually when RM/admin clicks "Trigger Intervention".
 *
 * Request (Zod triggerSchema):
 * { customer_id, delinquency_prob, top_3_shap_reasons, customer_features, model_version, dry_run }
 *
 * Response:
 * { customer_id, intervention_id, risk_tier, urgency_score, tier_label,
 *   offer: { offer_type, offer_description, validity_days, escalation_path },
 *   channel: { channel, email_type, priority, best_time_to_send, follow_up_in_days },
 *   message: { subject, body, word_count, tone, email_type },
 *   email_sent, email_delivered, dry_run, model_version, triggered_at }
 */
export async function triggerIntervention(payload) {
  const { data } = await fastApi.post('/intervention/trigger', payload);
  return data;
}

/**
 * GET /intervention/history/{customerId}
 * Returns last 6 interventions with outcome data.
 *
 * Each row: { id, customer_id, risk_tier, delinquency_prob, offer_type,
 *   channel, email_type, message_sent, email_subject, model_version,
 *   dry_run, triggered_at, email_delivered,
 *   offer_accepted, days_to_resolve, did_default_anyway }
 */
export async function getInterventionHistory(customerId) {
  const { data } = await fastApi.get(`/intervention/history/${customerId}`);
  return data;
}

/**
 * GET /intervention/stats
 * Returns aggregated intervention metrics (last 7 days).
 *
 * {
 *   offer_acceptance_rate: { by_tier: {...}, by_offer_type: {...} },
 *   recovery_rate: { by_offer_type: {...} },
 *   email_delivery_rate: float,
 *   false_positive_rate: float,
 *   total_interventions_this_week: number,
 *   tier_distribution: { critical, moderate, watch, stable }
 * }
 */
export async function getInterventionStats() {
  const { data } = await fastApi.get('/intervention/stats');
  return data;
}

/**
 * POST /intervention/outcome
 * Records customer response to an intervention.
 * { intervention_id, customer_id, offer_accepted, days_to_resolve, did_default_anyway }
 */
export async function recordOutcome(payload) {
  const { data } = await fastApi.post('/intervention/outcome', payload);
  return data;
}
