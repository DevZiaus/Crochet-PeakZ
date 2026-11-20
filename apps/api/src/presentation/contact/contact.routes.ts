import { Router, type Request, type Response } from "express";
import { ZodError } from "zod";
import { CONTACT_MAX_BODY_BYTES } from "@crochet-peakz/shared";
import type { ContactDependencies } from "../../application/contact/dependencies.js";
import { validateContactSubmission } from "../../application/contact/submit-contact.js";
import {
  ContactRejectionError,
  type ContactMessage,
} from "../../domain/contact/contact-message.js";
import { getClientIp } from "../auth/proxy-guard.js";
import { AppError } from "../middleware/errorHandler.js";
import { createContactRateLimiter } from "./contact-rate-limit.js";

const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 5;

/** Options for constructing the public contact router. */
export interface ContactRouterOptions {
  /** Contact submission dependencies (email port + clock). */
  contact: ContactDependencies;
  /** Exact web origins permitted when an `Origin` header is present. */
  allowedOrigins: string[];
  /** Optional rate-limit window override (defaults to 15 minutes). */
  rateLimitWindowMs?: number;
  /** Optional rate-limit max override (defaults to 5). */
  rateLimitMax?: number;
}

/**
 * Creates the public contact form router mounted under `/api`.
 *
 * @param options Contact dependencies, allowed origins, and rate-limit settings.
 * @returns Configured Express router handling `POST /contact`.
 */
export function createContactRouter(options: ContactRouterOptions): Router {
  const router = Router();
  const originAllowlist = new Set(
    options.allowedOrigins.map((origin) => origin.replace(/\/$/, "")),
  );
  const limiter = createContactRateLimiter({
    windowMs: options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
    max: options.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX,
    now: () => options.contact.clock.now().getTime(),
  });

  async function handleContactPost(req: Request, res: Response): Promise<void> {
    res.setHeader("Cache-Control", "no-store");

    const contentType = req.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError(415, "Invalid request.");
    }

    const declaredLength = Number(req.get("content-length") ?? 0);
    const bodyBytes = Buffer.byteLength(
      JSON.stringify(req.body ?? null),
      "utf8",
    );
    if (
      (Number.isFinite(declaredLength) &&
        declaredLength > CONTACT_MAX_BODY_BYTES) ||
      bodyBytes > CONTACT_MAX_BODY_BYTES
    ) {
      throw new AppError(413, "Your message is too large.");
    }

    if (req.get("sec-fetch-site") === "cross-site") {
      throw new AppError(403, "Invalid request origin.");
    }

    const origin = req.get("origin");
    if (origin && !originAllowlist.has(origin.replace(/\/$/, ""))) {
      throw new AppError(403, "Invalid request origin.");
    }

    const message = parseContactOrThrow(req.body, options.contact.clock.now());
    const ip = getClientIp(req) ?? req.ip ?? "unknown";
    const rateLimit = limiter.consume(ip);

    if (!rateLimit.allowed) {
      const minutes = Math.max(1, Math.ceil(rateLimit.retryAfterSeconds / 60));
      res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
      throw new AppError(
        429,
        `Please wait about ${minutes} ${
          minutes === 1 ? "minute" : "minutes"
        } before sending another message.`,
        {
          code: "RATE_LIMITED",
          details: { retryAfterSeconds: rateLimit.retryAfterSeconds },
        },
      );
    }

    try {
      await options.contact.emails.sendContactMessage(message);
    } catch {
      limiter.release(ip);
      throw new AppError(
        502,
        "We could not send your message right now. Please try again in a moment.",
        { code: "DELIVERY_FAILED" },
      );
    }

    res.status(200).json({ ok: true });
  }

  router.post("/contact", (req, res, next) => {
    void handleContactPost(req, res).catch(next);
  });

  return router;
}

/** Validates request input and maps domain/schema errors into HTTP 400 errors. */
function parseContactOrThrow(rawBody: unknown, now: Date): ContactMessage {
  try {
    return validateContactSubmission(rawBody, now);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstMessage =
        error.issues[0]?.message ?? "Please check the highlighted fields.";
      throw new AppError(400, firstMessage, {
        code: "VALIDATION_FAILED",
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }

    if (error instanceof ContactRejectionError) {
      throw new AppError(400, error.message, { code: error.code });
    }

    throw error;
  }
}
