/**
 * Tests for the Express application composition.
 *
 * This file is the seam that lets integration tests build the real app without
 * starting a listener, and it is where the auth router is optionally mounted.
 * Two things here are easy to get wrong and expensive to get wrong: the error
 * handler has to be registered last, and the auth router is optional so the
 * health only app still works.
 */
import { Router } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import type { ApiEnv } from "./config/env.js";

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
  emailFrom: "Crochet PeakZ <hello@example.com>",
  contactEmail: "hello@crochetpeakz.tech",
  cloudinaryCloudName: "crochet-peakz",
};

describe("createApp", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const authRouter = Router();
    authRouter.get("/probe", (_req, res) => {
      res.json({ mounted: true });
    });
    authRouter.get("/boom", () => {
      throw new Error("unexpected failure");
    });

    const app = createApp(env, () => Promise.resolve(true), authRouter);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
      server.closeAllConnections();
    });
  });

  it("serves the liveness probe", async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  it("serves the readiness probe from the injected database check", async () => {
    const response = await fetch(`${baseUrl}/api/health/ready`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { database: string };
    expect(body.database).toBe("up");
  });

  it("reports not ready when the database check fails", async () => {
    const app = createApp(env, () => Promise.resolve(false));
    const failing = app.listen(0, "127.0.0.1");
    await once(failing, "listening");
    const url = `http://127.0.0.1:${(failing.address() as AddressInfo).port}`;

    try {
      const response = await fetch(`${url}/api/health/ready`);

      expect(response.status).toBe(503);
      const body = (await response.json()) as { database: string };
      expect(body.database).toBe("down");
    } finally {
      await new Promise<void>((resolve) => {
        failing.close(() => {
          resolve();
        });
        failing.closeAllConnections();
      });
    }
  });

  it("mounts the auth router under /api/auth", async () => {
    const response = await fetch(`${baseUrl}/api/auth/probe`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ mounted: true });
  });

  it("builds an app with no auth router at all", async () => {
    const app = createApp(env, () => Promise.resolve(true));
    const bare = app.listen(0, "127.0.0.1");
    await once(bare, "listening");
    const url = `http://127.0.0.1:${(bare.address() as AddressInfo).port}`;

    try {
      const health = await fetch(`${url}/api/health`);
      expect(health.status).toBe(200);

      const auth = await fetch(`${url}/api/auth/me`);
      expect(auth.status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => {
        bare.close(() => {
          resolve();
        });
        bare.closeAllConnections();
      });
    }
  });

  it("turns an unexpected throw into a 500 without leaking the message", async () => {
    const response = await fetch(`${baseUrl}/api/auth/boom`);

    expect(response.status).toBe(500);
    const body = (await response.json()) as {
      error: { message: string; statusCode: number };
    };
    expect(body.error.message).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("unexpected failure");
  });

  it("answers 400, not 500, for a malformed JSON body", async () => {
    const response = await fetch(`${baseUrl}/api/auth/probe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { message: string; statusCode: number };
    };
    expect(body.error.statusCode).toBe(400);
    expect(body.error.message).toBe("The request could not be read.");
  });

  it("does not advertise the server technology", async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.headers.get("x-powered-by")).toBeNull();
  });

  it("accepts a JSON body on the auth routes", async () => {
    const app = createApp(
      env,
      () => Promise.resolve(true),
      (() => {
        const router = Router();
        router.post("/echo", (req, res) => {
          // Express types `req.body` as `any`, which the strict lint rules reject.
          const received: unknown = req.body;
          res.json({ received });
        });
        return router;
      })(),
    );
    const echo = app.listen(0, "127.0.0.1");
    await once(echo, "listening");
    const url = `http://127.0.0.1:${(echo.address() as AddressInfo).port}`;

    try {
      const response = await fetch(`${url}/api/auth/echo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "ada@example.com" }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        received: { email: "ada@example.com" },
      });
    } finally {
      await new Promise<void>((resolve) => {
        echo.close(() => {
          resolve();
        });
        echo.closeAllConnections();
      });
    }
  });
});
