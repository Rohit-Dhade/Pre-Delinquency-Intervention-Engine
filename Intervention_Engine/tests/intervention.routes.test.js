// tests/intervention.routes.test.js — Supertest integration tests
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';

// Mock all external dependencies
const mockQuery = jest.fn();
const mockEnd = jest.fn();
jest.unstable_mockModule('../src/db/pool.js', () => ({ default: { query: mockQuery, end: mockEnd } }));
jest.unstable_mockModule('../src/db/migrate.js', () => ({ migrate: jest.fn(), default: jest.fn() }));
jest.unstable_mockModule('../src/email/mailer.js', () => ({
  sendEmail: jest.fn().mockResolvedValue({ sent: true, delivered: true }),
  verifySmtp: jest.fn().mockResolvedValue(true),
  closeTransporter: jest.fn(),
  default: { sendEmail: jest.fn(), verifySmtp: jest.fn(), closeTransporter: jest.fn() },
}));

const mockComplete = jest.fn();
jest.unstable_mockModule('@mistralai/mistralai', () => ({
  Mistral: jest.fn().mockImplementation(() => ({
    chat: { complete: mockComplete },
    models: { list: jest.fn().mockResolvedValue({}) },
  })),
}));

jest.unstable_mockModule('axios', () => ({
  default: { get: jest.fn().mockResolvedValue({ status: 200 }) },
}));

// Import after mocks
const supertest = (await import('supertest')).default;
const express = (await import('express')).default;
const interventionRoutes = (await import('../src/routes/intervention.js')).default;
const { errorHandler } = await import('../src/middleware/errorHandler.js');

let app;
let request;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/intervention', interventionRoutes);
  app.use(errorHandler);
  request = supertest(app);
});

const validBody = {
  customer_id: 'CUST_0001',
  delinquency_prob: 0.75,
  top_3_shap_reasons: [
    { feature: 'composite_stress_index', feature_label: 'Stress', feature_value: 0.8, shap_value: 0.3, direction: 'increases risk' },
  ],
  customer_features: { emi_to_income_ratio: 0.6, customer_segment: 'salaried', geography: 'metro' },
  model_version: 'v1.0.0',
  dry_run: false,
};

describe('POST /intervention/trigger', () => {
  it('returns 200 with correct shape for valid body', async () => {
    // Mock getCustomerById
    mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Rohit Dhade', email: 'test@test.com', segment: 'salaried', geography: 'metro', emi_to_income_ratio: 0.6 }] });
    // Mock getLastInterventionResponse
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // Mock insertIntervention
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    // Mock updateEmailDelivered
    mockQuery.mockResolvedValueOnce({});

    mockComplete.mockResolvedValueOnce({ choices: [{ message: { content: 'SUBJECT: Help\n\nDear Rohit, we are here.' } }] });

    const res = await request.post('/intervention/trigger').send(validBody);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('customer_id', 'CUST_0001');
    expect(res.body).toHaveProperty('risk_tier', 'critical');
    expect(res.body).toHaveProperty('offer');
    expect(res.body).toHaveProperty('channel');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('email_sent');
    expect(res.body).toHaveProperty('triggered_at');
  });

  it('returns 400 + issues array for invalid body', async () => {
    const res = await request.post('/intervention/trigger').send({ customer_id: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
    expect(res.body).toHaveProperty('issues');
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it('returns 200 + no_action_required for stable tier', async () => {
    const stableBody = { ...validBody, delinquency_prob: 0.10 };
    mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Test', email: 'a@b.com', segment: 'salaried', geography: 'metro', emi_to_income_ratio: 0.3 }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request.post('/intervention/trigger').send(stableBody);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('no_action_required');
  });

  it('returns null intervention_id for dry_run', async () => {
    const dryBody = { ...validBody, dry_run: true };
    mockQuery.mockResolvedValueOnce({ rows: [{ name: 'Test User', email: 'a@b.com', segment: 'salaried', geography: 'metro', emi_to_income_ratio: 0.6 }] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockComplete.mockResolvedValueOnce({ choices: [{ message: { content: 'SUBJECT: Test\n\nBody.' } }] });

    const res = await request.post('/intervention/trigger').send(dryBody);
    expect(res.status).toBe(200);
    expect(res.body.intervention_id).toBeNull();
    expect(res.body.dry_run).toBe(true);
  });
});

describe('POST /intervention/outcome', () => {
  it('returns 200 + stats for valid outcome', async () => {
    // Mock insertOutcome
    mockQuery.mockResolvedValueOnce({});
    // Mock getWeeklyRates - acceptance
    mockQuery.mockResolvedValueOnce({ rows: [{ accepted: 5, total: 10 }] });
    // Mock getWeeklyRates - recovery
    mockQuery.mockResolvedValueOnce({ rows: [{ recovered: 8, total: 10 }] });

    const res = await request.post('/intervention/outcome').send({
      intervention_id: 1, customer_id: 'CUST_0001', offer_accepted: true, days_to_resolve: 5, did_default_anyway: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toHaveProperty('acceptance_rate_this_week');
  });
});

describe('GET /intervention/history/:id', () => {
  it('returns array max 6', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    const res = await request.get('/intervention/history/CUST_0001');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(6);
  });
});

describe('GET /intervention/stats', () => {
  it('returns correct shape', async () => {
    // Mock all getStats queries (7 queries total)
    for (let i = 0; i < 7; i++) mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request.get('/intervention/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('offer_acceptance_rate');
    expect(res.body).toHaveProperty('recovery_rate');
    expect(res.body).toHaveProperty('email_delivery_rate');
    expect(res.body).toHaveProperty('tier_distribution');
  });
});

describe('GET /intervention/health', () => {
  it('checks all four services', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const res = await request.get('/intervention/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('postgres');
    expect(res.body).toHaveProperty('mistral_api');
    expect(res.body).toHaveProperty('gmail_smtp');
    expect(res.body).toHaveProperty('fastapi_backend');
    expect(res.body).toHaveProperty('status');
  });
});
