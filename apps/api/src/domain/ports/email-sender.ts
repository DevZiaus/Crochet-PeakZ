/** One auth email to send. */
export interface AuthEmail {
  /** Recipient email address. */
  to: string;
  /** Recipient display name. */
  name: string;
  /** Absolute link the customer opens. */
  url: string;
}

/**
 * Transactional email port for the two auth emails.
 *
 * Implemented with Resend. A send failure is logged and never rolls back the
 * account change that triggered it.
 */
export interface EmailSender {
  /** Sends the "confirm your email" message. */
  sendVerificationEmail(email: AuthEmail): Promise<void>;
  /** Sends the "reset your password" message. */
  sendPasswordResetEmail(email: AuthEmail): Promise<void>;
}
