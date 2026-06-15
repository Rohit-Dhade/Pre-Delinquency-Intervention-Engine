// ─────────────────────────────────────────────────────
// src/services/offerEngine.js — Offer Engine
// ─────────────────────────────────────────────────────

const OFFERS = {
  loan_restructuring: {
    offer_type: 'loan_restructuring',
    offer_description: 'Restructure your loan with extended tenure and reduced EMI to ease immediate financial pressure.',
    validity_days: 30,
    escalation_path: 'immediate_rm_escalation',
  },
  payment_holiday: {
    offer_type: 'payment_holiday',
    offer_description: 'Take a 2-month payment holiday — no EMIs due, no penalties, interest capitalized.',
    validity_days: 14,
    escalation_path: 'immediate_rm_escalation',
  },
  emi_deferral_1_month: {
    offer_type: 'emi_deferral_1_month',
    offer_description: 'Defer your next EMI by one month with zero additional interest.',
    validity_days: 21,
    escalation_path: 'critical_if_ignored',
  },
  flexible_repayment_plan: {
    offer_type: 'flexible_repayment_plan',
    offer_description: 'Switch to a flexible repayment plan that adjusts with your income cycle.',
    validity_days: 21,
    escalation_path: 'critical_if_ignored',
  },
  micro_deferral_2_weeks: {
    offer_type: 'micro_deferral_2_weeks',
    offer_description: 'Push your next payment by 2 weeks — no questions asked, no extra charges.',
    validity_days: 14,
    escalation_path: 'critical_if_ignored',
  },
  financial_wellness_check: {
    offer_type: 'financial_wellness_check',
    offer_description: 'Schedule a free 15-minute financial wellness review with our advisor.',
    validity_days: 30,
    escalation_path: 'moderate_if_ignored',
  },
};

/**
 * Selects the best intervention offer based on tier, segment, and EMI ratio.
 * @param {string} tier
 * @param {string} customerSegment — salaried | self_employed | gig_worker
 * @param {number} emiToIncomeRatio
 * @returns {{ offer_type: string|null, offer_description: string, validity_days: number, escalation_path: string }}
 */
export function offerEngine(tier, customerSegment, emiToIncomeRatio) {
  if (tier === 'critical') {
    return emiToIncomeRatio > 0.5
      ? { ...OFFERS.loan_restructuring }
      : { ...OFFERS.payment_holiday };
  }

  if (tier === 'moderate') {
    switch (customerSegment) {
      case 'salaried':
        return { ...OFFERS.emi_deferral_1_month };
      case 'self_employed':
        return { ...OFFERS.flexible_repayment_plan };
      case 'gig_worker':
        return { ...OFFERS.micro_deferral_2_weeks };
      default:
        return { ...OFFERS.emi_deferral_1_month };
    }
  }

  if (tier === 'watch') {
    return { ...OFFERS.financial_wellness_check };
  }

  // stable
  return {
    offer_type: null,
    offer_description: 'No action required at this time.',
    validity_days: 0,
    escalation_path: 'none',
  };
}

export default offerEngine;
