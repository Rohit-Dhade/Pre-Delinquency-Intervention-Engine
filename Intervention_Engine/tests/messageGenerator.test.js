// tests/messageGenerator.test.js — Message Generator + SHAP translator tests
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockComplete = jest.fn();
jest.unstable_mockModule('@mistralai/mistralai', () => ({
  Mistral: jest.fn().mockImplementation(() => ({
    chat: { complete: mockComplete },
    models: { list: jest.fn() },
  })),
}));

const { messageGenerator } = await import('../src/services/messageGenerator.js');
const { translateFeature, translateShapReasons } = await import('../src/utils/shapTranslator.js');

const baseParams = {
  tier: 'critical',
  offer: { offer_type: 'loan_restructuring', offer_description: 'Restructure your loan', validity_days: 30, escalation_path: 'immediate_rm_escalation' },
  channel: { channel: 'gmail', email_type: 'personal_rm_email', priority: 'urgent', best_time_to_send: '09:00', follow_up_in_days: null, subject_line_hint: "We'd like to help" },
  shapReasons: [
    { feature: 'composite_stress_index', direction: 'increases risk' },
    { feature: 'salary_delay_days', direction: 'increases risk' },
  ],
  customerSegment: 'salaried',
  customerName: 'Rohit',
};

describe('messageGenerator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('parses SUBJECT: correctly', async () => {
    mockComplete.mockResolvedValueOnce({ choices: [{ message: { content: 'SUBJECT: Test Subject\n\nBody text.' } }] });
    const r = await messageGenerator(baseParams);
    expect(r.subject).toBe('Test Subject');
    expect(r.body).not.toContain('SUBJECT:');
  });

  it('computes word_count from body only', async () => {
    mockComplete.mockResolvedValueOnce({ choices: [{ message: { content: 'SUBJECT: S\n\nOne two three.' } }] });
    const r = await messageGenerator(baseParams);
    expect(r.word_count).toBe(3);
  });

  it('falls back on Mistral rejection', async () => {
    mockComplete.mockRejectedValueOnce(new Error('rate limit'));
    const r = await messageGenerator(baseParams);
    expect(r.subject).toContain("We'd like to help");
    expect(r.body).toContain('Rohit');
  });

  it('returns empty for stable (no email_type)', async () => {
    const r = await messageGenerator({ ...baseParams, tier: 'stable', channel: { ...baseParams.channel, email_type: null } });
    expect(r.subject).toBe('');
    expect(r.email_type).toBe('none');
  });

  it('includes tone', async () => {
    mockComplete.mockResolvedValueOnce({ choices: [{ message: { content: 'SUBJECT: Hi\n\nBody.' } }] });
    const r = await messageGenerator(baseParams);
    expect(r.tone).toBe('professional and reassuring');
  });
});

describe('shapTranslator', () => {
  it('translates known features', () => {
    expect(translateFeature('composite_stress_index')).toBe('overall financial pressure');
    expect(translateFeature('salary_delay_days')).toBe('recent salary timing changes');
  });

  it('returns null for unknown', () => {
    expect(translateFeature('unknown_xyz')).toBeNull();
  });

  it('omits unknown from translateShapReasons', () => {
    const r = translateShapReasons([
      { feature: 'composite_stress_index', direction: 'increases risk' },
      { feature: 'unknown', direction: 'increases risk' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toBe('overall financial pressure');
  });
});
