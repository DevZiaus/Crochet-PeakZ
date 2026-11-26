import { Router, type Request, type Response } from "express";
import { ZodError } from "zod";
import { CONTACT_MAX_BODY_BYTES } from "@crochet-peakz/shared";
import type { ContactDependencies } from "../../application/contact/dependencies.js";
import {
  ContactRateLimitError,
  submitContact,
} from "../../application/contact/submit-contact.js";
import { ContactDeliveryError } from "../../domain/contact/contact-email-sender.js";
import { ContactRejectionError } from "../../domain/contact/contact-message.js";
import { getClientIp } from "../auth/proxy-guard.js";
import { AppError } from "../middleware/errorHandler.js";
import { createContactRateLimiter } from "./contact-rate-limit.js";

const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = 5;

/** Options for constructing the public contact router. */
export interface ContactRouterOptions {
  /** Contact submission dependencies (email port + clock + optional limiter). */
  contact: ContactDependencies;
  /** Exact web origins permitted when an `Origin` header is present. */
  allowedOrigins: string[];
  /** Optional rate-limit window override (defaults to 15 minutes). */
  rateLimitWindowMs?: number;
  /** Optional rate-limit max override (defaults to 5). */
  rateLimitMax?: number;
  /** Number of trusted appending proxy hops before the API (defaults to 1). */
  trustedProxyHops?: number;
  /** Shared secret authorizing `x-proxy-client-ip` forwarded by the web proxy. */
  proxySharedSecret?: string;
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
  const rateLimiter =
    options.contact.rateLimiter ??
    createContactRateLimiter({
      windowMs: options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
      max: options.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX,
      now: () => options.contact.clock.now().getTime(),
    });
  const contactDeps: ContactDependencies = {
    ...options.contact,
    rateLimiter,
  };
  const clientIpOptions = {
    trustedHops: options.trustedProxyHops ?? 1,
    ...(options.proxySharedSecret
      ? { proxySharedSecret: options.proxySharedSecret }
      : {}),
  };

  async function handleContactPost(req: Request, res: Response): Promise<void> {
    res.setHeader("Cache-Control", "no-store");

    const contentType = req.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) {
      throw new AppError(415, "Invalid request.");
    }

    // Check declared Content-Length first; JSON.stringify on parsed req.body is
    // only a post-parse fallback for chunked requests without Content-Length
    // (the web proxy caps raw bytes at 20 KB and global express.json caps at 1 MB).
    const declaredLength = Number(req.get("content-length") ?? 0);
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > CONTACT_MAX_BODY_BYTES
    ) {
      throw new AppError(413, "Your message is too large.");
    }

    const bodyBytes = Buffer.byteLength(
      JSON.stringify(req.body ?? null),
      "utf8",
    );
    if (bodyBytes > CONTACT_MAX_BODY_BYTES) {
      throw new AppError(413, "Your message is too large.");
    }

    if (req.get("sec-fetch-site") === "cross-site") {
      throw new AppError(403, "Invalid request origin.");
    }

    const origin = req.get("origin");
    if (origin && !originAllowlist.has(origin.replace(/\/$/, ""))) {
      throw new AppError(403, "Invalid request origin.");
    }

    const ip = getClientIp(req, clientIpOptions) ?? req.ip ?? "unknown";

    try {
      await submitContact(contactDeps, {
        rawInput: req.body,
        clientKey: ip,
      });
    } catch (error) {
      throw mapContactError(error, res);
    }

    res.status(200).json({ ok: true });
  }

  router.post("/contact", (req, res, next) => {
    void handleContactPost(req, res).catch(next);
  });

  return router;
}

/** Maps application and domain contact failures into HTTP errors. */
function mapContactError(error: unknown, res: Response): unknown {
  if (error instanceof ZodError) {
    const firstMessage =
      error.issues[0]?.message ?? "Please check the highlighted fields.";
    return new AppError(400, firstMessage, {
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
    return new AppError(400, error.message, { code: error.code });
  }

  if (error instanceof ContactRateLimitError) {
    res.setHeader("Retry-After", String(error.retryAfterSeconds));
    return new AppError(429, error.message, {
      code: error.code,
      details: { retryAfterSeconds: error.retryAfterSeconds },
    });
  }

  if (error instanceof ContactDeliveryError) {
    return new AppError(
      502,
      "We could not send your message right now. Please try again in a moment.",
      { code: "DELIVERY_FAILED" },
    );
  }

  return error;
}
