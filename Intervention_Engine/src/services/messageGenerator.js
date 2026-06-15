// ─────────────────────────────────────────────────────
// src/services/messageGenerator.js — Mistral AI email gen
// ─────────────────────────────────────────────────────
import { Mistral } from '@mistralai/mistralai';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { translateShapReasons } from '../utils/shapTranslator.js';
import { getFallbackTemplate } from '../email/templates.js';

let mistralClient = null;

function getClient() {
  if (!mistralClient) {
    mistralClient = new Mistral({ apiKey: config.mistralApiKey });
  }
  return mistralClient;
}

const SYSTEM_PROMPT = `You are an empathetic banking assistant helping relationship managers reach out to customers showing early signs of financial stress. Write emails that feel human, warm, and genuinely helpful — never threatening, never collections-like, never alarming. The customer has NOT missed any payment yet. The goal is to offer support before they need to ask. Always write in plain English. Never use ML terms like 'model', 'score', 'prediction', or 'algorithm'. Never mention that this outreach was triggered by an automated system.`;

const TONE_MAP = {
  salaried: 'professional and reassuring',
  gig_worker: 'casual, brief, peer-to-peer',
  self_employed: 'business-friendly, respect their autonomy',
};

const EMAIL_TYPE_INSTRUCTIONS = {
  personal_rm_email:
    'Write as if the relationship manager is personally writing. Formal but warm, 200–300 words.',
  offer_email:
    'Put the offer in the first paragraph. Be benefit-focused. 150–200 words.',
  wellness_email:
    'No specific offer — just checking in. Light and friendly. 100–150 words.',
};

/**
 * Generates a personalised email using Mistral AI.
 * Falls back to templates on any error.
 *
 * @param {object} params
 * @param {string} params.tier
 * @param {object} params.offer — from offerEngine
 * @param {object} params.channel — from channelRouter
 * @param {Array} params.shapReasons — top 3 SHAP reasons
 * @param {string} params.customerSegment
 * @param {string} params.customerName
 * @returns {Promise<{ subject: string, body: string, word_count: number, tone: string, email_type: string }>}
 */
export async function messageGenerator({
  tier,
  offer,
  channel,
  shapReasons,
  customerSegment,
  customerName,
}) {
  const emailType = channel.email_type;
  const tone = TONE_MAP[customerSegment] || 'professional and reassuring';

  // If no email type (stable tier), return empty
  if (!emailType) {
    return {
      subject: '',
      body: '',
      word_count: 0,
      tone,
      email_type: 'none',
    };
  }

  // Translate SHAP reasons to plain English
  const plainReasons = translateShapReasons(shapReasons);
  const reasonsText =
    plainReasons.length > 0
      ? `The customer is showing signs of: ${plainReasons.join(', ')}.`
      : 'The customer is showing some early financial stress indicators.';

  // Build user prompt
  const userPrompt = `
Write an email for a customer named ${customerName}.

Context: ${reasonsText}

Offer: ${offer.offer_type ? `${offer.offer_type} — ${offer.offer_description}. Valid for ${offer.validity_days} days.` : 'No specific offer.'}

Email type: ${emailType}
${EMAIL_TYPE_INSTRUCTIONS[emailType] || ''}

Tone: ${tone}

Include a single clear call-to-action at the end (reply to this email, call us, or click a link).

IMPORTANT: The first line of your response MUST be: "SUBJECT: <your subject line>"
The email body starts from line 2. Do NOT include "SUBJECT:" anywhere else in the email.
`.trim();

  try {
    const client = getClient();
    const response = await client.chat.complete({
      model: 'mistral-large-latest',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 600,
    });

    const rawText = response.choices[0].message.content.trim();
    return parseResponse(rawText, tone, emailType);
  } catch (err) {
    logger.warn('Mistral API fallback triggered', {
      reason: err.message,
      tier,
      customerName,
    });

    const fallback = getFallbackTemplate(tier, customerName);
    return {
      subject: fallback.subject,
      body: fallback.body,
      word_count: fallback.body.split(/\s+/).length,
      tone,
      email_type: emailType,
    };
  }
}

/**
 * Parses Mistral response into structured email object.
 * First line must be "SUBJECT: <subject>".
 */
function parseResponse(rawText, tone, emailType) {
  const lines = rawText.split('\n');
  let subject = '';
  let bodyStartIndex = 0;

  // Find SUBJECT line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.toUpperCase().startsWith('SUBJECT:')) {
      subject = line.substring('SUBJECT:'.length).trim();
      bodyStartIndex = i + 1;
      break;
    }
  }

  // If no SUBJECT found, use first line as subject
  if (!subject) {
    subject = lines[0]?.trim() || 'A message from your bank';
    bodyStartIndex = 1;
  }

  const body = lines
    .slice(bodyStartIndex)
    .join('\n')
    .trim();

  const wordCount = body.split(/\s+/).filter(Boolean).length;

  return {
    subject,
    body,
    word_count: wordCount,
    tone,
    email_type: emailType,
  };
}

/**
 * Checks if Mistral API is reachable.
 * @returns {Promise<boolean>}
 */
export async function checkMistralHealth() {
  try {
    const client = getClient();
    await client.models.list();
    return true;
  } catch {
    return false;
  }
}

export default { messageGenerator, checkMistralHealth };
