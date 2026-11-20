import type { ContactMessage } from "./contact-message.js";

/** Error raised when the outbound email transport fails to deliver a message. */
export class ContactDeliveryError extends Error {
  /**
   * @param message Diagnostic summary of the delivery failure.
   */
  constructor(message: string) {
    super(message);
    this.name = "ContactDeliveryError";
  }
}

/** Outbound port for delivering validated contact form messages. */
export interface ContactEmailSender {
  /**
   * Sends a validated contact message to the store inbox.
   *
   * @param message Validated contact message entity.
   * @throws {ContactDeliveryError} When the transport rejects or fails the send.
   */
  sendContactMessage(message: ContactMessage): Promise<void>;
}
