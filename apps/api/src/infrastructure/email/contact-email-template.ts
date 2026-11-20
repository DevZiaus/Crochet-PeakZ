import { createHash } from "node:crypto";
import type { ContactMessage } from "../../domain/contact/contact-message.js";

/** Fully rendered contact notification email envelope. */
export interface ComposedContactEmail {
  /** Verified sender address. */
  from: string;
  /** Destination inbox addresses. */
  to: string[];
  /** Customer reply-to address. */
  replyTo: string;
  /** Sanitized subject line. */
  subject: string;
  /** Plain-text message body. */
  text: string;
  /** Accessible HTML message body. */
  html: string;
  /** Custom SMTP headers attached to the message. */
  headers: Record<string, string>;
  /** Bounded idempotency key preventing duplicate sends on retry. */
  idempotencyKey: string;
}

/**
 * Escapes HTML special characters in untrusted text.
 *
 * @param value Raw text string.
 * @returns Escaped string safe for HTML body interpolation.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Builds a fixed-length idempotency key under Resend's 256 character cap.
 *
 * @param message Validated contact message.
 * @param submittedAt ISO 8601 timestamp string.
 * @returns Deterministic idempotency key.
 */
function buildIdempotencyKey(
  message: ContactMessage,
  submittedAt: string,
): string {
  const digest = createHash("sha256")
    .update(
      `${message.email}\0${message.topic}\0${message.message}\0${submittedAt}`,
    )
    .digest("hex");

  return `contact/${digest}`;
}

/**
 * Renders a validated {@link ContactMessage} into a complete Resend envelope.
 *
 * @param options Sender address, destination inbox, and validated message.
 * @returns Rendered {@link ComposedContactEmail}.
 */
export function composeContactEmail(options: {
  from: string;
  to: string;
  message: ContactMessage;
}): ComposedContactEmail {
  const { from, to, message } = options;
  const submittedAt = message.submittedAt.toISOString();
  const safeSubjectName = message.name.replace(/[\r\n]+/g, " ").trim();
  const safeSubjectTopic = message.topicLabel.replace(/[\r\n]+/g, " ").trim();
  const escapedName = escapeHtml(message.name);
  const escapedEmail = escapeHtml(message.email);
  const escapedTopic = escapeHtml(message.topicLabel);
  const escapedMessage = escapeHtml(message.message).replace(
    /\r?\n/g,
    "<br />",
  );

  const text = [
    "New contact message from Crochet PeakZ",
    "",
    `Name: ${message.name}`,
    `Email: ${message.email}`,
    `Topic: ${message.topicLabel}`,
    `Submitted: ${submittedAt}`,
    "",
    "Message:",
    message.message,
    "",
    "Reply directly to this email to respond.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#fbf8f3;color:#1f2a2a;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf8f3;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #ddd6c8;border-radius:12px;">
            <tr>
              <td style="padding:28px 32px;border-bottom:1px solid #ddd6c8;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#0f5c5c;font-weight:700;">Crochet PeakZ</p>
                <h1 style="margin:0;font-size:26px;line-height:1.25;color:#1f2a2a;">New contact message</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <p style="margin:0 0 20px;font-size:14px;color:#5b6666;">A message came through the contact form.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.6;">
                  <tr>
                    <td style="padding:8px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b6666;width:110px;">Name</td>
                    <td style="padding:8px 0;color:#1f2a2a;">${escapedName}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b6666;width:110px;">Email</td>
                    <td style="padding:8px 0;color:#1f2a2a;">${escapedEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b6666;width:110px;">Topic</td>
                    <td style="padding:8px 0;color:#1f2a2a;">${escapedTopic}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b6666;width:110px;">Submitted</td>
                    <td style="padding:8px 0;color:#1f2a2a;">${submittedAt}</td>
                  </tr>
                </table>
                <div style="margin-top:24px;padding:18px 20px;background:#f4f0e8;border-left:3px solid #0f5c5c;font-size:15px;line-height:1.6;color:#1f2a2a;">
                  ${escapedMessage}
                </div>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#5b6666;">Reply directly to this email to respond to ${escapedName}.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    from,
    to: [to],
    replyTo: message.email,
    subject: `New contact message: ${safeSubjectTopic} (${safeSubjectName})`,
    text,
    html,
    headers: {
      "X-Contact-Form-Submitted-At": submittedAt,
    },
    idempotencyKey: buildIdempotencyKey(message, submittedAt),
  };
}
