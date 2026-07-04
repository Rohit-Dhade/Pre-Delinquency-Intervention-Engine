/**
 * Auth API — thin wrappers around /auth/* endpoints.
 * Exact request/response shapes from backend Pydantic models.
 */
import { fastApi } from './client';

/**
 * POST /auth/login
 * @param {{ email: string, password: string }} creds
 * @returns {{ access_token, token_type, expires_in, employee: EmployeePublic }}
 */
export async function login(creds) {
  const { data } = await fastApi.post('/auth/login', creds);
  return data;
}

/**
 * POST /auth/logout
 */
export async function logout() {
  const { data } = await fastApi.post('/auth/logout');
  return data;
}

/**
 * POST /auth/refresh
 * @returns {{ access_token, token_type, expires_in }}
 */
export async function refresh() {
  const { data } = await fastApi.post('/auth/refresh');
  return data;
}

/**
 * GET /auth/me
 * @returns {EmployeePublic} { employee_id, full_name, email, role, department, is_active, created_at, last_login }
 */
export async function getMe() {
  const { data } = await fastApi.get('/auth/me');
  return data;
}

/**
 * POST /auth/reset-password/request
 * @param {{ email: string }} body
 * @returns {{ message: string }}
 */
export async function resetPasswordRequest(body) {
  const { data } = await fastApi.post('/auth/reset-password/request', body);
  return data;
}

/**
 * POST /auth/reset-password/confirm
 * @param {{ token: string, new_password: string }} body
 * @returns {{ message: string }}
 */
export async function resetPasswordConfirm(body) {
  const { data } = await fastApi.post('/auth/reset-password/confirm', body);
  return data;
}

/**
 * GET /auth/employees (admin only)
 * @returns {EmployeePublic[]}
 */
export async function listEmployees() {
  const { data } = await fastApi.get('/auth/employees');
  return data;
}

/**
 * POST /auth/create-employee (admin only)
 * @param {{ full_name, email, role, department?, password }} body
 * @returns {EmployeePublic}
 */
export async function createEmployee(body) {
  const { data } = await fastApi.post('/auth/create-employee', body);
  return data;
}

/**
 * POST /auth/deactivate-employee (admin only)
 * @param {{ employee_id: string }} body  (pattern: ^EMP_\d{3,}$)
 * @returns {{ message: string }}
 */
export async function deactivateEmployee(body) {
  const { data } = await fastApi.post('/auth/deactivate-employee', body);
  return data;
}

/**
 * GET /auth/audit-log (admin only)
 * @param {{ employee_id?, action?, from_date?, to_date?, limit? }} params
 * @returns {AuditLogEntry[]}
 */
export async function getAuditLog(params = {}) {
  const { data } = await fastApi.get('/auth/audit-log', { params });
  return data;
}
