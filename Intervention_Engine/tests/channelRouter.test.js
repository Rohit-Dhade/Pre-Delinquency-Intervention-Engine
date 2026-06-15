// ─────────────────────────────────────────────────────
// tests/channelRouter.test.js — Channel Router tests
// ─────────────────────────────────────────────────────
import { describe, it, expect } from '@jest/globals';
import { channelRouter } from '../src/services/channelRouter.js';

describe('channelRouter', () => {
  it('should return urgent + personal_rm_email for critical', () => {
    const result = channelRouter('critical', 'salaried', 'metro', 'no_history');
    expect(result.priority).toBe('urgent');
    expect(result.email_type).toBe('personal_rm_email');
    expect(result.channel).toBe('gmail');
  });

  it('should return high + offer_email for moderate + metro', () => {
    const result = channelRouter('moderate', 'salaried', 'metro', 'no_history');
    expect(result.priority).toBe('high');
    expect(result.email_type).toBe('offer_email');
  });

  it('should return normal + wellness_email for watch', () => {
    const result = channelRouter('watch', 'salaried', 'metro', 'no_history');
    expect(result.priority).toBe('normal');
    expect(result.email_type).toBe('wellness_email');
  });

  it('should return null priority + null email_type for stable', () => {
    const result = channelRouter('stable', 'salaried', 'metro', 'no_history');
    expect(result.priority).toBeNull();
    expect(result.email_type).toBeNull();
    expect(result.subject_line_hint).toBe('');
  });

  it('should escalate priority one level when past response is "ignored"', () => {
    // watch (normal) should escalate to high
    const watchResult = channelRouter('watch', 'salaried', 'metro', 'ignored');
    expect(watchResult.priority).toBe('high');
    expect(watchResult.follow_up_in_days).toBe(3);

    // moderate (high) should escalate to urgent
    const modResult = channelRouter('moderate', 'salaried', 'metro', 'ignored');
    expect(modResult.priority).toBe('urgent');
    expect(modResult.follow_up_in_days).toBe(3);

    // critical (urgent) should stay urgent (already max)
    const critResult = channelRouter('critical', 'salaried', 'metro', 'ignored');
    expect(critResult.priority).toBe('urgent');
    expect(critResult.follow_up_in_days).toBe(3);
  });

  it('should return best_time_to_send = "18:00" for gig_worker', () => {
    const result = channelRouter('moderate', 'gig_worker', 'metro', 'no_history');
    expect(result.best_time_to_send).toBe('18:00');
  });

  it('should return best_time_to_send = "09:00" for salaried', () => {
    const result = channelRouter('moderate', 'salaried', 'metro', 'no_history');
    expect(result.best_time_to_send).toBe('09:00');
  });

  it('should return best_time_to_send = "11:00" for self_employed', () => {
    const result = channelRouter('moderate', 'self_employed', 'metro', 'no_history');
    expect(result.best_time_to_send).toBe('11:00');
  });

  it('should have follow_up_in_days = null when not ignored', () => {
    const result = channelRouter('moderate', 'salaried', 'metro', 'accepted');
    expect(result.follow_up_in_days).toBeNull();
  });

  it('should have correct subject_line_hint per priority', () => {
    const urgent = channelRouter('critical', 'salaried', 'metro', 'no_history');
    expect(urgent.subject_line_hint).toContain("We'd like to help");

    const high = channelRouter('moderate', 'salaried', 'metro', 'no_history');
    expect(high.subject_line_hint).toContain('A helpful offer');

    const normal = channelRouter('watch', 'salaried', 'metro', 'no_history');
    expect(normal.subject_line_hint).toContain('Checking in');
  });
});
