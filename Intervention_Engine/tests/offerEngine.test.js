// ─────────────────────────────────────────────────────
// tests/offerEngine.test.js — Offer Engine tests
// ─────────────────────────────────────────────────────
import { describe, it, expect } from '@jest/globals';
import { offerEngine } from '../src/services/offerEngine.js';

describe('offerEngine', () => {
  it('should return loan_restructuring for critical + salaried + emi=0.6', () => {
    const result = offerEngine('critical', 'salaried', 0.6);
    expect(result.offer_type).toBe('loan_restructuring');
    expect(result.escalation_path).toBe('immediate_rm_escalation');
  });

  it('should return payment_holiday for critical + gig_worker + emi=0.3', () => {
    const result = offerEngine('critical', 'gig_worker', 0.3);
    expect(result.offer_type).toBe('payment_holiday');
    expect(result.escalation_path).toBe('immediate_rm_escalation');
  });

  it('should return emi_deferral_1_month for moderate + salaried', () => {
    const result = offerEngine('moderate', 'salaried', 0.4);
    expect(result.offer_type).toBe('emi_deferral_1_month');
    expect(result.escalation_path).toBe('critical_if_ignored');
  });

  it('should return flexible_repayment_plan for moderate + self_employed', () => {
    const result = offerEngine('moderate', 'self_employed', 0.4);
    expect(result.offer_type).toBe('flexible_repayment_plan');
  });

  it('should return micro_deferral_2_weeks for moderate + gig_worker', () => {
    const result = offerEngine('moderate', 'gig_worker', 0.4);
    expect(result.offer_type).toBe('micro_deferral_2_weeks');
  });

  it('should return financial_wellness_check for watch + self_employed', () => {
    const result = offerEngine('watch', 'self_employed', 0.3);
    expect(result.offer_type).toBe('financial_wellness_check');
    expect(result.escalation_path).toBe('moderate_if_ignored');
  });

  it('should return null offer_type for stable', () => {
    const result = offerEngine('stable', 'salaried', 0.1);
    expect(result.offer_type).toBeNull();
    expect(result.escalation_path).toBe('none');
  });

  it('should have validity_days > 0 on all non-null offers', () => {
    const critical = offerEngine('critical', 'salaried', 0.6);
    expect(critical.validity_days).toBeGreaterThan(0);

    const moderate = offerEngine('moderate', 'salaried', 0.4);
    expect(moderate.validity_days).toBeGreaterThan(0);

    const watch = offerEngine('watch', 'salaried', 0.3);
    expect(watch.validity_days).toBeGreaterThan(0);
  });

  it('should have validity_days = 0 for stable', () => {
    const stable = offerEngine('stable', 'salaried', 0.1);
    expect(stable.validity_days).toBe(0);
  });
});
