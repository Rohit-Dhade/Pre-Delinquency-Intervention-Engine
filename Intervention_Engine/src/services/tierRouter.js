// ─────────────────────────────────────────────────────
// src/services/tierRouter.js — Risk Tier Router
// ─────────────────────────────────────────────────────

const TIERS = {
  critical: {
    tier: 'critical',
    tier_label: 'Immediate Intervention Required',
  },
  moderate: {
    tier: 'moderate',
    tier_label: 'Early Intervention Recommended',
  },
  watch: {
    tier: 'watch',
    tier_label: 'Monitor Closely',
  },
  stable: {
    tier: 'stable',
    tier_label: 'No Action Required',
  },
};

/**
 * Determines risk tier from delinquency probability.
 * @param {number} delinquencyProb — float 0–1
 * @returns {{ tier: string, urgency_score: number, tier_label: string }}
 */
export function tierRouter(delinquencyProb) {
  let tierInfo;

  if (delinquencyProb >= 0.70) {
    tierInfo = TIERS.critical;
  } else if (delinquencyProb >= 0.40) {
    tierInfo = TIERS.moderate;
  } else if (delinquencyProb >= 0.20) {
    tierInfo = TIERS.watch;
  } else {
    tierInfo = TIERS.stable;
  }

  return {
    ...tierInfo,
    urgency_score: delinquencyProb,
  };
}

export default tierRouter;
