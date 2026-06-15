// ─────────────────────────────────────────────────────
// src/email/mailer.js — Gmail SMTP via Nodemailer
// ─────────────────────────────────────────────────────
import nodemailer from 'nodemailer';
import config from '../config/index.js';
import { wrapInHtml } from './htmlWrapper.js';
import logger from '../config/logger.js';

let transporter = null;

/**
 * Returns the Nodemailer transporter (lazy init).
 */
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.gmail.user,
        pass: config.gmail.appPassword,
      },
    });
  }
  return transporter;
}

/**
 * Sends an email via Gmail SMTP.
 * In DryRun mode: sends to GMAIL_USER with "[DRY RUN]" subject prefix.
 *
 * @param {object} opts
 * @param {string} opts.to — recipient email
 * @param {string} opts.subject — email subject
 * @param {string} opts.body — plain text body
 * @param {boolean} opts.dryRun — if true, send to self
 * @returns {Promise<{ sent: boolean, delivered: boolean }>}
 */
export async function sendEmail({ to, subject, body, dryRun = false }) {
  const actualTo = dryRun ? config.gmail.user : to;
  const actualSubject = dryRun ? `[DRY RUN] ${subject}` : subject;
  const html = wrapInHtml(body, subject);

  const mailOptions = {
    from: `"${config.bankName} Support" <${config.gmail.user}>`,
    to: actualTo,
    subject: actualSubject,
    text: body,
    html,
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    logger.info('Email sent successfully', {
      messageId: info.messageId,
      to: actualTo,
      dryRun,
    });
    return { sent: true, delivered: true };
  } catch (err) {
    logger.warn('Email delivery failed', {
      error: err.message,
      to: actualTo,
      dryRun,
    });
    return { sent: false, delivered: false };
  }
}

/**
 * Verifies the SMTP connection is alive.
 * @returns {Promise<boolean>}
 */
export async function verifySmtp() {
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}

/**
 * Closes the transporter for graceful shutdown.
 */
export function closeTransporter() {
  if (transporter) {
    transporter.close();
    transporter = null;
  }
}

export default { sendEmail, verifySmtp, closeTransporter };
