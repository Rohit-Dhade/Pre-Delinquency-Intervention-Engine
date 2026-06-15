// ─────────────────────────────────────────────────────
// src/services/channelRouter.js — Channel Router
// ─────────────────────────────────────────────────────

const PRIORITY_LEVELS = ['normal', 'high', 'urgent'];

const SUBJECT_LINE_HINTS = {
  urgent: "We'd like to help — let's talk before things get harder",
  high: 'A helpful offer just for you this month',
  normal: 'Checking in on your account',
};

const BEST_TIMES = {
  salaried: '09:00',
  gig_worker: '18:00',
  self_employed: '11:00',
};

/**
 * Escalates priority one level up.
 * @param {string} priority
 * @returns {string}
 */
function escalatePriority(priority) {
  const idx = PRIORITY_LEVELS.indexOf(priority);
  if (idx < 0 || idx >= PRIORITY_LEVELS.length - 1) return priority;
  return PRIORITY_LEVELS[idx + 1];
}

/**
 * Determines email channel, type, priority, and timing.
 * @param {string} tier
 * @param {string} customerSegment
 * @param {string} geography — metro | tier2 | rural
 * @param {string} pastOfferResponse — accepted | ignored | no_history
 * @returns {object}
 */
export function channelRouter(tier, customerSegment, geography, pastOfferResponse) {
  let emailType = null;
  let priority = null;
  let followUpInDays = null;

  switch (tier) {
    case 'critical':
      emailType = 'personal_rm_email';
      priority = 'urgent';
      break;
    case 'moderate':
      emailType = 'offer_email';
      priority = 'high';
      break;
    case 'watch':
      emailType = 'wellness_email';
      priority = 'normal';
      break;
    case 'stable':
    default:
      // No email for stable tier
      return {
        channel: 'gmail',
        email_type: null,
        priority: null,
        best_time_to_send: BEST_TIMES[customerSegment] || '09:00',
        follow_up_in_days: null,
        subject_line_hint: '',
      };
  }

  // Escalate if past offer was ignored
  if (pastOfferResponse === 'ignored') {
    priority = escalatePriority(priority);
    followUpInDays = 3;
  }

  return {
    channel: 'gmail',
    email_type: emailType,
    priority,
    best_time_to_send: BEST_TIMES[customerSegment] || '09:00',
    follow_up_in_days: followUpInDays,
    subject_line_hint: SUBJECT_LINE_HINTS[priority] || '',
  };
}

export default channelRouter;
