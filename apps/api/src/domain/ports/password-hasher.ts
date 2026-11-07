/**
 * Password hashing port.
 *
 * Implemented by bcryptjs at cost 12 in the infrastructure layer.
 */
export interface PasswordHasher {
  /** Hashes a raw password. */
  hash(password: string): Promise<string>;
  /** Compares a raw password with a stored hash in constant time. */
  verify(password: string, hash: string): Promise<boolean>;
}
