// ─────────────────────────────────────────────────────
// src/utils/shapTranslator.js — SHAP → plain English
// ─────────────────────────────────────────────────────

const SHAP_TRANSLATIONS = {
  composite_stress_index: 'overall financial pressure',
  salary_delay_days: 'recent salary timing changes',
  failed_autodebit_count: 'a few payment hiccups',
  savings_decline_pct: 'a dip in your savings',
  behavioral_risk_score: 'changes in spending patterns',
  credit_utilization_ratio: 'credit card usage levels',
  emi_to_income_ratio: 'monthly repayment load',
  income_drop_pct: 'recent income changes',
  utility_payment_delay_days: 'utility payment timing',
  gambling_spend_increase_pct: 'changes in discretionary spend',
  atm_withdrawal_increase_pct: 'cash withdrawal patterns',
  upi_lending_app_txn_count: 'recent loan app activity',
  balance_volatility_30d: 'account balance fluctuations',
  discretionary_spend_drop_pct: 'reduced everyday spending',
  risk_momentum_score: 'recent financial trend',
};

/**
 * Translates a SHAP feature name to customer-friendly plain English.
 * Returns null for unknown features (caller should omit them).
 * @param {string} featureName
 * @returns {string|null}
 */
export function translateFeature(featureName) {
  return SHAP_TRANSLATIONS[featureName] || null;
}

/**
 * Translates an array of SHAP reasons to plain-English descriptions.
 * Unknown features are silently omitted.
 * @param {Array<{feature: string, direction: string}>} shapReasons
 * @returns {string[]}
 */
export function translateShapReasons(shapReasons) {
  const translations = [];
  for (const reason of shapReasons) {
    const plain = translateFeature(reason.feature);
    if (plain) {
      translations.push(plain);
    }
  }
  return translations;
}

export default { translateFeature, translateShapReasons };
