
import { fastApi } from './client';

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
