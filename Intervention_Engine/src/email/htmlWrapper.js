// ─────────────────────────────────────────────────────
// src/email/htmlWrapper.js — Clean HTML email wrapper
// ─────────────────────────────────────────────────────
import config from '../config/index.js';

/**
 * Wraps plain-text email body in minimal, clean HTML.
 * @param {string} body — plain text body
 * @param {string} subject — email subject
 * @returns {string} — HTML string
 */
export function wrapInHtml(body, subject) {
  const bankName = config.bankName;

  // Convert newlines to <br> for HTML rendering
  const htmlBody = body
    .split('\n')
    .map((line) => line.trim())
    .join('<br>');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background-color:#1a73e8; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;">
                ${bankName}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 40px; font-size:16px; line-height:1.6; color:#333333;">
              ${htmlBody}
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 36px;">
              <a href="mailto:${config.gmail.user}?subject=Re: ${encodeURIComponent(subject)}"
                 style="display:inline-block; padding:14px 32px; background-color:#1a73e8; color:#ffffff; text-decoration:none; border-radius:6px; font-size:16px; font-weight:600;">
                Reply to This Email
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color:#fafafa; text-align:center; font-size:12px; color:#999999; border-top:1px solid #eeeeee;">
              Sent by ${bankName}. Reply STOP to unsubscribe.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export default wrapInHtml;
