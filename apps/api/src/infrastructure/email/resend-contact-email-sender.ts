import { Resend } from "resend";
import {
  ContactDeliveryError,
  type ContactEmailSender,
} from "../../domain/contact/contact-email-sender.js";
import type { ContactMessage } from "../../domain/contact/contact-message.js";
import {
  composeContactEmail,
  type ComposedContactEmail,
} from "./contact-email-template.js";

/**
 * Sends one composed contact email envelope.
 *
 * Injectable so tests can inspect the envelope without calling live Resend.
 */
export type ContactEmailTransport = (
  email: ComposedContactEmail,
) => Promise<{ error: { name?: string; message: string } | null }>;

/** Configuration for {@link ResendContactEmailSender}. */
export interface ResendContactEmailSenderOptions {
  /** Resend API key. */
  apiKey: string;
  /** Verified sender address (`EMAIL_FROM`). */
  from: string;
  /** Destination inbox address (`CONTACT_EMAIL`). */
  to: string;
  /** Optional transport override for unit tests. */
  transport?: ContactEmailTransport | undefined;
}

/**
 * Resend-backed outbound adapter for delivering contact form submissions.
 */
export class ResendContactEmailSender implements ContactEmailSender {
  private readonly from: string;
  private readonly to: string;
  private readonly transport: ContactEmailTransport;

  /**
   * @param options Resend API credentials, sender/recipient addresses, and optional transport.
   */
  constructor(options: ResendContactEmailSenderOptions) {
    this.from = options.from;
    this.to = options.to;
    this.transport = options.transport ?? createResendTransport(options.apiKey);
  }

  /** @inheritdoc */
  async sendContactMessage(message: ContactMessage): Promise<void> {
    const composed = composeContactEmail({
      from: this.from,
      to: this.to,
      message,
    });

    let result: { error: { name?: string; message: string } | null };
    try {
      result = await this.transport(composed);
    } catch (error) {
      console.error("[contact] Resend request failed.", error);
      throw new ContactDeliveryError(
        error instanceof Error ? error.message : "Resend request failed.",
      );
    }

    if (result.error) {
      console.error(
        "[contact] Resend rejected the message:",
        result.error.name ?? "ResendError",
        result.error.message,
      );
      throw new ContactDeliveryError(result.error.message);
    }
  }
}

/**
 * Wraps the Resend Node.js SDK in {@link ContactEmailTransport}.
 *
 * @param apiKey Resend API key.
 * @returns Transport posting the envelope with an idempotency key.
 */
function createResendTransport(apiKey: string): ContactEmailTransport {
  const resend = new Resend(apiKey);

  return (email) =>
    resend.emails.send(
      {
        from: email.from,
        to: email.to,
        replyTo: email.replyTo,
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: email.headers,
      },
      { idempotencyKey: email.idempotencyKey },
    );
}
