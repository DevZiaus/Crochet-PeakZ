import bcrypt from "bcryptjs";
import type { PasswordHasher } from "../../domain/ports/password-hasher.js";

/** bcrypt cost factor required by the spec. */
const BCRYPT_COST = 12;

/**
 * bcryptjs password hasher.
 *
 * Cost 12 matches the spec. bcrypt compares in constant time, and the password
 * schema rejects anything above 72 bytes so bcryptjs never silently truncates.
 */
export class BcryptPasswordHasher implements PasswordHasher {
  /** @inheritdoc */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }

  /** @inheritdoc */
  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
