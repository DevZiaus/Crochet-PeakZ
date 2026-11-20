import dotenv from "dotenv";
import type { Router } from "express";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import {
  createDatabase,
  type Database,
} from "./infrastructure/database/prisma.js";
import { PrismaUserRepository } from "./infrastructure/database/user.repository.js";
import { PrismaSessionRepository } from "./infrastructure/database/session.repository.js";
import { BcryptPasswordHasher } from "./infrastructure/auth/bcrypt-password-hasher.js";
import { JwtTokenService } from "./infrastructure/auth/jwt-token-service.js";
import { ResendEmailSender } from "./infrastructure/email/resend-email-sender.js";
import { ResendContactEmailSender } from "./infrastructure/email/resend-contact-email-sender.js";
import { createOAuthAuthenticator } from "./infrastructure/oauth/passport.js";
import { systemClock } from "./domain/ports/clock.js";
import type { AuthDependencies } from "./application/dependencies.js";
import type { CatalogDependencies } from "./application/catalog/dependencies.js";
import type { ContactDependencies } from "./application/contact/dependencies.js";
import { createAuthRouter } from "./presentation/auth/auth.routes.js";
import { createCatalogRouter } from "./presentation/catalog/catalog.routes.js";
import { createContactRouter } from "./presentation/contact/contact.routes.js";
import { PrismaCatalogRepository } from "./infrastructure/database/catalog.repository.js";
import { CloudinaryImageUrlResolver } from "./infrastructure/cloudinary/image-url-resolver.js";

dotenv.config({ quiet: true });

/**
 * Registers SIGTERM/SIGINT handlers so containers and process managers can
 * stop the API without dropping in-flight requests or leaking DB connections.
 *
 * @param server HTTP server returned by `app.listen`.
 * @param database Database handle to close.
 */
function installShutdownHandlers(server: Server, database: Database): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.log(`[API] ${signal} received, shutting down gracefully`);

    const forceExit = setTimeout(() => {
      console.error("[API] Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(() => {
      void database.disconnect().finally(() => {
        clearTimeout(forceExit);
        process.exit(0);
      });
    });
  };

  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    shutdown("SIGINT");
  });
}

/**
 * Starts the server: validates env, connects to the database, and listens.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const database = createDatabase(env.databaseUrl);

  try {
    // Verify database connection, but keep serving liveness checks if the
    // database is temporarily unavailable.
    await database.client.$connect();
    console.log("[DB] Connected to PostgreSQL");
  } catch (error) {
    console.warn(
      "[DB] Could not connect to PostgreSQL. The server will start, " +
        "but database features will not work until the connection is available.",
    );
    console.warn("[DB]", error instanceof Error ? error.message : error);
  }

  const authRouter = buildAuthRouter();
  const catalogRouter = buildCatalogRouter();
  const contactRouter = buildContactRouter();
  const app = createApp(
    env,
    database.checkHealth,
    authRouter,
    catalogRouter,
    contactRouter,
  );

  /**
   * Builds the contact form dependencies and Express router.
   */
  function buildContactRouter(): Router {
    const contact: ContactDependencies = {
      emails: new ResendContactEmailSender({
        apiKey: env.resendApiKey,
        from: env.emailFrom,
        to: env.contactEmail,
      }),
      clock: systemClock,
    };

    return createContactRouter({
      contact,
      allowedOrigins: [...new Set([env.webAppUrl, ...env.corsOrigins])],
    });
  }

  /**
   * Builds the catalog dependencies from the validated environment and the
   * Prisma client.
   */
  function buildCatalogRouter(): Router {
    const catalog: CatalogDependencies = {
      catalog: new PrismaCatalogRepository(database.client),
      imageUrls: new CloudinaryImageUrlResolver(env.cloudinaryCloudName),
    };

    return createCatalogRouter(catalog);
  }

  /**
   * Builds the auth dependencies from the validated environment and the
   * Prisma client.
   */
  function buildAuthRouter(): Router {
    const auth: AuthDependencies = {
      users: new PrismaUserRepository(database.client),
      sessions: new PrismaSessionRepository(database.client),
      passwords: new BcryptPasswordHasher(),
      tokens: new JwtTokenService({
        jwtSecret: env.jwtSecret,
        refreshSecret: env.jwtRefreshSecret,
      }),
      emails: new ResendEmailSender({
        apiKey: env.resendApiKey,
        from: env.emailFrom,
        logLinks: env.nodeEnv !== "production",
      }),
      clock: systemClock,
      webAppUrl: env.webAppUrl,
    };

    return createAuthRouter({
      auth,
      proxySharedSecret: env.proxySharedSecret,
      webAppUrl: env.webAppUrl,
      isProduction: env.nodeEnv === "production",
      authenticator: createOAuthAuthenticator({
        webAppUrl: env.webAppUrl,
        google: env.googleClient,
        facebook: env.facebookClient,
      }),
    });
  }
  const server = app.listen(env.port, env.host, () => {
    console.log(
      `[API] Crochet PeakZ API running on http://${env.host}:${env.port}`,
    );
    console.log(
      `[API] Health check: http://${env.host}:${env.port}/api/health`,
    );
  });

  server.on("error", (error) => {
    console.error("[FATAL] HTTP server error:", error);
    process.exit(1);
  });

  installShutdownHandlers(server, database);
}

main().catch((error: unknown) => {
  console.error("[FATAL] Failed to start server:", error);
  process.exit(1);
});
