import { Resend } from "resend";
import type {
  AuthEmail,
  EmailSender,
} from "../../domain/ports/email-sender.js";
import {
  composeAuthEmail,
  extractEmailUrl,
  type ComposedAuthEmail,
} from "./auth-email-templates.js";

/**
 * Sends one fully rendered message.
 *
 * Injectable so tests can inspect the exact envelope, including `from`,
 * without calling Resend. The real transport wraps the Resend SDK.
 */
export type AuthEmailTransport = (
  email: ComposedAuthEmail,
) => Promise<{ error: { message: string } | null }>;

/** Configuration for the Resend email sender. */
export interface ResendEmailSenderOptions {
  apiKey: string;
  from: string;
  /** Log the auth link to the console when Resend is not configured to send. */
  logLinks: boolean;
  /** Replaces the Resend call, used by tests and local mail capture. */
  transport?: AuthEmailTransport | undefined;
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
  private readonly from: string;
  private readonly logLinks: boolean;
  private readonly transport: AuthEmailTransport;

  /**
   * @param options Resend credentials, sender, and optional transport.
   */
  constructor(options: ResendEmailSenderOptions) {
    this.from = options.from;
    this.logLinks = options.logLinks;
    this.transport = options.transport ?? createResendTransport(options.apiKey);
  }

  /** @inheritdoc */
  async sendVerificationEmail(email: AuthEmail): Promise<void> {
    await this.send(composeAuthEmail("verification", this.from, email));
  }

  /** @inheritdoc */
  async sendPasswordResetEmail(email: AuthEmail): Promise<void> {
    await this.send(composeAuthEmail("password-reset", this.from, email));
  }

  private async send(email: ComposedAuthEmail): Promise<void> {
    const link = extractEmailUrl(email.text);

    if (this.logLinks) {
      console.info(
        `[auth] ${email.subject} from ${email.from} to ${email.to.join(", ")}: ${link}`,
      );
    }

    const { error } = await this.transport(email);

    if (error) {
      console.error(
        `[auth] Resend rejected "${email.subject}":`,
        error.message,
      );
      if (this.logLinks) {
        console.info(`[auth] ${email.subject} link: ${link}`);
        return;
      }
      throw new Error(`Could not send "${email.subject}": ${error.message}`);
    }
  }
}

/**
 * Wraps the Resend SDK in the transport contract.
 *
 * @param apiKey Resend API key.
 * @returns Transport that posts the composed envelope with an idempotency key.
 */
function createResendTransport(apiKey: string): AuthEmailTransport {
  const resend = new Resend(apiKey);

  return (email) =>
    resend.emails.send(
      {
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      },
      { idempotencyKey: email.idempotencyKey },
    );
}
