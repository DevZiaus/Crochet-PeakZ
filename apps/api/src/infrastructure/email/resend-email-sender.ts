import { Resend } from "resend";
import type {
  AuthEmail,
  EmailSender,
} from "../../domain/ports/email-sender.js";

/** Configuration for the Resend email sender. */
export interface ResendEmailSenderOptions {
  apiKey: string;
  from: string;
  /** Log the auth link to the console when Resend is not configured to send. */
  logLinks: boolean;
}

/**
 * Resend backed transactional email sender for the two auth emails.
 *
 * The Resend SDK returns `{ data, error }` instead of throwing, so the error is
 * checked explicitly. A failure in development falls back to logging the link;
 * in production it is rethrown for the use case to log without rolling back the
 * account change.
 */
export class ResendEmailSender implements EmailSender {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly logLinks: boolean;

  /**
   * @param options Resend credentials and sender.
   */
  constructor(options: ResendEmailSenderOptions) {
    this.resend = new Resend(options.apiKey);
    this.from = options.from;
    this.logLinks = options.logLinks;
  }

  /** @inheritdoc */
  async sendVerificationEmail(email: AuthEmail): Promise<void> {
    const subject = "Confirm your Crochet PeakZ email";
    const heading = "Confirm your email";
    const body =
      "Welcome to Crochet PeakZ. Confirm your email address so your orders and downloads belong to you.";
    const action = "Confirm my email";

    await this.send(
      email,
      subject,
      heading,
      renderEmail({
        heading,
        body,
        action,
        url: email.url,
        footer:
          "This link works once and expires in 24 hours. If you did not create an account, you can ignore this email.",
      }),
      `Confirm your Crochet PeakZ email: ${email.url}`,
      `verify-email/${email.to}`,
    );
  }

  /** @inheritdoc */
  async sendPasswordResetEmail(email: AuthEmail): Promise<void> {
    const subject = "Reset your Crochet PeakZ password";
    const heading = "Reset your password";
    const body =
      "We received a request to reset your Crochet PeakZ password. Choose a new password with the button below.";
    const action = "Choose a new password";

    await this.send(
      email,
      subject,
      heading,
      renderEmail({
        heading,
        body,
        action,
        url: email.url,
        footer:
          "This link works once and expires in 1 hour. If you did not request a reset, you can ignore this email; your password stays the same.",
      }),
      `Reset your Crochet PeakZ password: ${email.url}`,
      `reset-password/${email.to}`,
    );
  }

  private async send(
    email: AuthEmail,
    subject: string,
    heading: string,
    html: string,
    text: string,
    idempotencyKey: string,
  ): Promise<void> {
    if (this.logLinks) {
      console.info(`[auth] ${heading} for ${email.to}: ${extractUrl(text)}`);
    }

    const { error } = await this.resend.emails.send(
      {
        from: this.from,
        to: [email.to],
        subject,
        html,
        text,
      },
      { idempotencyKey },
    );

    if (error) {
      console.error(`[auth] Resend rejected "${subject}":`, error.message);
      if (this.logLinks) {
        console.info(`[auth] ${heading} link: ${extractUrl(text)}`);
        return;
      }
      throw new Error(`Could not send "${subject}": ${error.message}`);
    }
  }
}

/** Extracts the URL from the plain text fallback. */
function extractUrl(text: string): string {
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
                <p style="margin:0 0 8px;font-size:14px;letter-spacing:0.04em;text-transform:uppercase;color:#0f5c5c;font-weight:700;">Crochet PeakZ</p>
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
