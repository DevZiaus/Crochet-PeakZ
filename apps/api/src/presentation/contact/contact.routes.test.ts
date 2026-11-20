import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import type { ApiEnv } from "../../config/env.js";
import {
  ContactDeliveryError,
  type ContactEmailSender,
} from "../../domain/contact/contact-email-sender.js";
import type { ContactMessage } from "../../domain/contact/contact-message.js";
import { createContactRouter } from "./contact.routes.js";

const env: ApiEnv = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 0,
  databaseUrl: "postgresql://user:pass@localhost:5432/db",
  corsOrigins: ["https://shop.example.com"],
  trustProxy: false,
  webAppUrl: "https://shop.example.com",
  proxySharedSecret: "proxy-secret-0123456789",
  jwtSecret: "a".repeat(32),
  jwtRefreshSecret: "b".repeat(32),
  googleClient: { id: "google-id", secret: "google-secret" },
  facebookClient: { id: "facebook-id", secret: "facebook-secret" },
  resendApiKey: "re_test_key",
  emailFrom: "Crochet PeakZ <no-reply@example.com>",
  contactEmail: "hello@crochetpeakz.tech",
  cloudinaryCloudName: "crochet-peakz",
};

class FakeContactEmailSender implements ContactEmailSender {
  public readonly sent: ContactMessage[] = [];
  public failNext = false;

  sendContactMessage(message: ContactMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new ContactDeliveryError("Resend down"));
    }
    this.sent.push(message);
    return Promise.resolve();
  }
}

const VALID_BODY = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  topic: "general",
  message: "Do you take custom cardigan orders?",
  website: "",
  elapsedMs: 5000,
};

describe("contact router", () => {
  let server: Server;
  let baseUrl = "";
  let sender: FakeContactEmailSender;
  let nowMs = Date.parse("2026-11-20T12:00:00.000Z");
  let ipCounter = 0;

  function nextClientIp(): string {
    ipCounter += 1;
    return `198.51.100.${String(ipCounter)}`;
  }

  beforeAll(async () => {
    sender = new FakeContactEmailSender();
    const app = createApp(
      env,
      () => Promise.resolve(true),
      undefined,
      undefined,
      createContactRouter({
        contact: {
          emails: sender,
          clock: { now: () => new Date(nowMs) },
        },
        allowedOrigins: [env.webAppUrl],
        rateLimitWindowMs: 15 * 60 * 1000,
        rateLimitMax: 2,
      }),
    );

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${String(address.port)}`;
  });

  beforeEach(() => {
    sender.sent.length = 0;
    sender.failNext = false;
    nowMs += 1000;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
      server.closeAllConnections();
    });
  });

  it("delivers a valid contact submission and returns 200", async () => {
    const response = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://shop.example.com",
        "x-forwarded-for": nextClientIp(),
      },
      body: JSON.stringify(VALID_BODY),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.email).toBe("ada@example.com");
    expect(sender.sent[0]?.topicLabel).toBe("General inquiry");
  });

  it("rejects non-JSON content types with 415", async () => {
    const response = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: {
        "content-type": "text/plain",
        origin: "https://shop.example.com",
      },
      body: "hello",
    });

    expect(response.status).toBe(415);
  });

  it("rejects oversized JSON payloads with 413", async () => {
    const response = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://shop.example.com",
      },
      body: JSON.stringify({
        ...VALID_BODY,
        message: "x".repeat(25_000),
      }),
    });

    expect(response.status).toBe(413);
  });

  it("rejects cross-site requests and untrusted origins with 403", async () => {
    const crossSite = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify(VALID_BODY),
    });
    expect(crossSite.status).toBe(403);

    const badOrigin = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify(VALID_BODY),
    });
    expect(badOrigin.status).toBe(403);
  });

  it("rejects invalid fields, honeypot hits, rapid submits, and >3 links with 400", async () => {
    const badEmail = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...VALID_BODY, email: "invalid" }),
    });
    expect(badEmail.status).toBe(400);

    const honeypot = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...VALID_BODY, website: "https://bot.test" }),
    });
    expect(honeypot.status).toBe(400);

    const tooFast = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...VALID_BODY, elapsedMs: 500 }),
    });
    expect(tooFast.status).toBe(400);

    const linkSpam = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...VALID_BODY,
        message: "https://1.test https://2.test https://3.test https://4.test",
      }),
    });
    expect(linkSpam.status).toBe(400);
    expect(sender.sent).toHaveLength(0);
  });

  it("enforces rate limiting with Retry-After and releases the slot on 502 delivery failure", async () => {
    const ip = nextClientIp();
    const post = (): Promise<globalThis.Response> =>
      fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://shop.example.com",
          "x-forwarded-for": ip,
        },
        body: JSON.stringify(VALID_BODY),
      });

    // First send succeeds (1/2).
    expect((await post()).status).toBe(200);

    // Second send fails upstream (502) and must release its rate-limit slot.
    sender.failNext = true;
    expect((await post()).status).toBe(502);

    // Retry still succeeds (2/2) because the failed attempt was released.
    expect((await post()).status).toBe(200);

    // Third successful attempt hits the rate limit (429).
    const limited = await post();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
