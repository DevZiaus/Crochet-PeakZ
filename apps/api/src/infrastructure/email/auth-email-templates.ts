import { createHash } from "node:crypto";
import type { AuthEmail } from "../../domain/ports/email-sender.js";

/** The two transactional auth messages. */
export type AuthEmailKind = "verification" | "password-reset";

/**
 * A fully rendered message, ready for any email transport.
 *
 * The sender address is part of the envelope so tests can prove the value the
 * transport receives is exactly the configured `EMAIL_FROM`.
 */
export interface ComposedAuthEmail {
  /** Sender address, including an optional display name. */
  from: string;
  /** Recipients. */
  to: string[];
  /** Subject line. */
  subject: string;
  /** Accessible HTML body. */
  html: string;
  /** Plain text fallback containing the action link. */
  text: string;
  /** Stable key that stops a retry from sending a duplicate. */
  idempotencyKey: string;
}

/** Copy blocks that differ between the two messages. */
const TEMPLATES: Record<
  AuthEmailKind,
  {
    subject: string;
    heading: string;
    body: string;
    action: string;
    footer: string;
    keyPrefix: string;
  }
> = {
  verification: {
    subject: "Confirm your CrocheT PeakZ email",
    heading: "Confirm your email",
    body: "Welcome to CrocheT PeakZ. Confirm your email address so your orders and downloads belong to you.",
    action: "Confirm my email",
    footer:
      "This link works once and expires in 24 hours. If you did not create an account, you can ignore this email.",
    keyPrefix: "verify-email",
  },
  "password-reset": {
    subject: "Reset your CrocheT PeakZ password",
    heading: "Reset your password",
    body: "We received a request to reset your CrocheT PeakZ password. Choose a new password with the button below.",
    action: "Choose a new password",
    footer:
      "This link works once and expires in 1 hour. If you did not request a reset, you can ignore this email; your password stays the same.",
    keyPrefix: "reset-password",
  },
};

/**
 * Renders one auth email into a complete envelope.
 *
 * @param kind Which message to build.
 * @param from Configured sender address.
 * @param email Recipient and action link.
 * @returns The envelope handed to the transport.
 */
export function composeAuthEmail(
  kind: AuthEmailKind,
  from: string,
  email: AuthEmail,
): ComposedAuthEmail {
  const template = TEMPLATES[kind];

  return {
    from,
    to: [email.to],
    subject: template.subject,
    html: renderEmail({
      heading: template.heading,
      body: template.body,
      action: template.action,
      url: email.url,
      footer: template.footer,
    }),
    text: `${template.subject}: ${email.url}`,
    idempotencyKey: keyFor(template.keyPrefix, email.to, email.url),
  };
}

/**
 * Builds a fixed length idempotency key from the prefix, recipient, and action
 * link. Recipient and URL are hashed together so the key stays bounded even
 * for a 255 character address, never touching Resend's 256 character cap.
 */
function keyFor(prefix: string, recipient: string, url: string): string {
  const recipientHash = createHash("sha256").update(recipient).digest("hex");
  const linkHash = createHash("sha256").update(url).digest("hex");

  return `${prefix}/${recipientHash}/${linkHash.slice(0, 32)}`;
}

/**
 * Extracts the first URL from the plain text fallback.
 *
 * @param text Plain text body.
 * @returns The URL, or an empty string when none is present.
 */
export function extractEmailUrl(text: string): string {
  const match = /https?:\/\/\S+/.exec(text);
  return match?.[0] ?? "";
}

/** Escapes text interpolated into HTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Renders the shared accessible email layout. */
function renderEmail(input: {
  heading: string;
  body: string;
  action: string;
  url: string;
  footer: string;
}): string {
  const url = escapeHtml(input.url);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#fbf8f3;color:#1f2a2a;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf8f3;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ddd6c8;border-radius:12px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:19px;letter-spacing:-0.01em;font-weight:700;"><span style="color:#2b6563;">CrocheT</span> <span style="color:#bf5570;">PeakZ</span></p>
                <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#1f2a2a;">${escapeHtml(input.heading)}</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#1f2a2a;">${escapeHtml(input.body)}</p>
                <p style="margin:0 0 24px;">
                  <a href="${url}" style="display:inline-block;background:#0f5c5c;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px;">${escapeHtml(input.action)}</a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5b6666;">If the button does not work, paste this link into your browser:</p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${url}" style="color:#0f5c5c;">${url}</a></p>
                <hr style="border:none;border-top:1px solid #ddd6c8;margin:0 0 16px;" />
                <p style="margin:0;font-size:12px;line-height:1.5;color:#5b6666;">${escapeHtml(input.footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
