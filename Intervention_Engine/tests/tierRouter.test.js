// ─────────────────────────────────────────────────────
// tests/tierRouter.test.js — Risk Tier Router tests
// ─────────────────────────────────────────────────────
import { describe, it, expect } from '@jest/globals';
import { tierRouter } from '../src/services/tierRouter.js';

describe('tierRouter', () => {
  it('should return "critical" for prob = 0.85', () => {
    const result = tierRouter(0.85);
    expect(result.tier).toBe('critical');
    expect(result.tier_label).toBe('Immediate Intervention Required');
    expect(result.urgency_score).toBe(0.85);
  });

  it('should return "moderate" for prob = 0.55', () => {
    const result = tierRouter(0.55);
    expect(result.tier).toBe('moderate');
    expect(result.tier_label).toBe('Early Intervention Recommended');
  });

  it('should return "watch" for prob = 0.30', () => {
    const result = tierRouter(0.30);
    expect(result.tier).toBe('watch');
    expect(result.tier_label).toBe('Monitor Closely');
  });

  it('should return "stable" for prob = 0.10', () => {
    const result = tierRouter(0.10);
    expect(result.tier).toBe('stable');
    expect(result.tier_label).toBe('No Action Required');
  });

  it('should return "critical" for boundary prob = 0.70', () => {
    const result = tierRouter(0.70);
    expect(result.tier).toBe('critical');
  });

  it('should return "moderate" for boundary prob = 0.40', () => {
    const result = tierRouter(0.40);
    expect(result.tier).toBe('moderate');
  });

  it('should always include urgency_score equal to input prob', () => {
    expect(tierRouter(0.99).urgency_score).toBe(0.99);
    expect(tierRouter(0.01).urgency_score).toBe(0.01);
  });
});
