const FALLBACK_TEMPLATES = {
  critical: {
    subject: "We'd like to help — let's talk before things get harder",
    body: (name) =>
      `Dear ${name},\n\nWe noticed some changes in your account and want to reach out personally before anything becomes a concern. Please reply to this email or call your relationship manager at your earliest convenience.\n\nWe are here to help.\n\nWarm regards,\nYour Relationship Manager`,
  },
  moderate: {
    subject: 'A helpful offer just for you this month',
    body: (name) =>
      `Dear ${name},\n\nWe have a special arrangement that might give you some financial breathing room this month. Please reply to this email and we will walk you through the details.\n\nBest regards,\nYour Banking Team`,
  },
  watch: {
    subject: 'Checking in on your account',
    body: (name) =>
      `Dear ${name},\n\nWe just wanted to check in and see if there is anything we can help you with this month. We are always here if you need us.\n\nWarm regards,\nYour Banking Team`,
  },
};

/**
 * Returns a fallback email for the given tier and customer name.
 * @param {string} tier
 * @param {string} customerName
 * @returns {{ subject: string, body: string }}
 */
export function getFallbackTemplate(tier, customerName) {
  const template = FALLBACK_TEMPLATES[tier];
  if (!template) {
    return {
      subject: 'A message from your bank',
      body: `Dear ${customerName},\n\nWe wanted to reach out and let you know we are here if you need any assistance. Please do not hesitate to contact us.\n\nBest regards,\nYour Banking Team`,
    };
  }
  return {
    subject: template.subject,
    body: template.body(customerName),
  };
}

export default getFallbackTemplate;
