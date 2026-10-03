
import { fastApi } from './client';

/**
 * GET /customers/at-risk
 * Returns at-risk customers sorted by delinquency probability (highest first).
 * Response: { customers: [...], total, limit, offset }
 */
export async function getAtRiskCustomers({ limit = 50, offset = 0, minProb = 0.20 } = {}) {
  const { data } = await fastApi.get('/customers/at-risk', {
    params: { limit, offset, min_prob: minProb },
  });
  return data;
}

/**
 * Search customers by customer_id, name, or account_number.
 * Returns up to 20 matching rows.
 *
 * Each row: { customer_id, name, account_number, segment, geography,
 *             credit_score, email, phone_number }
 */
export async function searchCustomers(query) {
  const { data } = await fastApi.get('/customers/search', {
    params: { q: query },
  });
  return data;
}

/**
 * GET /customers/{customerId}
 * Returns full customer profile.
 */
export async function getCustomerProfile(customerId) {
  const { data } = await fastApi.get(`/customers/${customerId}`);
  return data;
}
