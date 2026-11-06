import { z } from "zod";
import { UserRole, type AuthUser } from "../types/index.js";

/** Minimum password length in bytes. */
export const PASSWORD_MIN_BYTES = 8;

/** Maximum password length in bytes. bcryptjs silently truncates past this. */
export const PASSWORD_MAX_BYTES = 72;

/**
 * Counts the UTF-8 bytes in a string.
 *
 * Password limits are expressed in bytes because bcryptjs truncates at 72
 * bytes, not 72 characters. `TextEncoder` exists in browsers and Node, so the
 * same rule runs on both sides of the API boundary.
 *
 * @param value Text to measure.
 * @returns Byte length of the UTF-8 encoding.
 */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Password schema shared by registration and password reset.
 *
 * Accepts 8 to 72 bytes. Values above 72 bytes are rejected instead of being
 * silently truncated by bcryptjs.
 */
export const passwordSchema = z.string().refine(
  (value) => {
    const bytes = utf8ByteLength(value);
    return bytes >= PASSWORD_MIN_BYTES && bytes <= PASSWORD_MAX_BYTES;
  },
  {
    message: `Password must be between ${String(PASSWORD_MIN_BYTES)} and ${String(PASSWORD_MAX_BYTES)} bytes.`,
  },
);

/** Email schema: trims surrounding whitespace and lowercases the value. */
export const authEmailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email({ message: "Enter a valid email address." }))
  .pipe(z.string().max(255, "Email must be 255 characters or fewer."));

/**
 * Normalizes an email address for storage and comparison.
 *
 * One definition is shared by the input schema and the login and resend
 * throttles, so a normalized address can never drift between them.
 *
 * @param value Raw address.
 * @returns Trimmed, lowercased address.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Display name schema. */
export const authNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(255, "Name must be 255 characters or fewer.");

/** Body of `POST /api/auth/register`. */
export const registerSchema = z.object({
  name: authNameSchema,
  email: authEmailSchema,
  password: passwordSchema,
});

/** Body of `POST /api/auth/login`. */
export const loginSchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1, "Enter your password."),
});

/** Body of `POST /api/auth/verify-email` and `POST /api/auth/reset-password`. */
export const tokenSchema = z.object({
  token: z.string().min(1, "This link is missing its token."),
});

/** Body of `POST /api/auth/resend-verification`. */
export const resendVerificationSchema = z.object({
  email: authEmailSchema,
});

/** Body of `POST /api/auth/forgot-password`. */
export const forgotPasswordSchema = z.object({
  email: authEmailSchema,
});

/** Body of `POST /api/auth/reset-password`. */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "This link is missing its token."),
  password: passwordSchema,
});

/** Schema for the public `AuthUser` response shape. */
export const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum([UserRole.CUSTOMER, UserRole.ADMIN]),
  avatarUrl: z.string().nullable(),
  emailVerified: z.boolean(),
}) satisfies z.ZodType<AuthUser>;

/** Validated registration body. */
export type RegisterInput = z.infer<typeof registerSchema>;

/** Validated sign in body. */
export type LoginInput = z.infer<typeof loginSchema>;

/** Validated password reset body. */
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
