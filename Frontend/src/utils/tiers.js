/**
 * Utility functions for risk tier display.
 * Thresholds from tierRouter.js:
 *   critical: >= 0.70
 *   moderate: >= 0.40
 *   watch:    >= 0.20
 *   stable:   < 0.20
 */

export const TIER_CONFIG = {
  critical: {
    label: 'Critical',
    fullLabel: 'Immediate Intervention Required',
    bgClass: 'bg-tier-critical-bg',
    textClass: 'text-tier-critical-text',
    borderClass: 'border-tier-critical',
    dotColor: '#DC2626',
    bg: '#FEE2E2',
    text: '#991B1B',
    color: '#DC2626',
  },
  moderate: {
    label: 'Moderate',
    fullLabel: 'Early Intervention Recommended',
    bgClass: 'bg-tier-moderate-bg',
    textClass: 'text-tier-moderate-text',
    borderClass: 'border-tier-moderate',
    dotColor: '#D97706',
    bg: '#FEF3C7',
    text: '#92400E',
    color: '#D97706',
  },
  watch: {
    label: 'Watch',
    fullLabel: 'Monitor Closely',
    bgClass: 'bg-tier-watch-bg',
    textClass: 'text-tier-watch-text',
    borderClass: 'border-tier-watch',
    dotColor: '#CA8A04',
    bg: '#FEF9C3',
    text: '#854D0E',
    color: '#CA8A04',
  },
  stable: {
    label: 'Stable',
    fullLabel: 'No Action Required',
    bgClass: 'bg-tier-stable-bg',
    textClass: 'text-tier-stable-text',
    borderClass: 'border-tier-stable',
    dotColor: '#059669',
    bg: '#D1FAE5',
    text: '#065F46',
    color: '#059669',
  },
};

/**
 * Determine risk tier from delinquency probability.
 * Matches tierRouter.js thresholds exactly.
 */
export function getTierFromProb(prob) {
  if (prob >= 0.70) return 'critical';
  if (prob >= 0.40) return 'moderate';
  if (prob >= 0.20) return 'watch';
  return 'stable';
}

export function getTierConfig(tier) {
  return TIER_CONFIG[tier] || TIER_CONFIG.stable;
}

/**
 * Format a probability as a percentage string.
 */
export function formatProb(prob) {
  return `${(prob * 100).toFixed(1)}%`;
}
