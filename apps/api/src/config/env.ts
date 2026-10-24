/**
 * Runtime configuration for the API.
 *
 * Every value that differs between local development, containers, and
 * managed hosts is read from the environment here. The rest of the code
 * receives a typed {@link ApiEnv} instead of reading `process.env`.
 */

/** Supported Node.js environments. */
export type NodeEnv = "development" | "test" | "production";

/** Express `trust proxy` accepts these forms. */
export type TrustProxy = boolean | number | string;

/** Validated API configuration. */
export interface ApiEnv {
  /** Current Node.js environment. */
  nodeEnv: NodeEnv;
  /** Interface the HTTP server binds to. */
  host: string;
  /** TCP port the HTTP server listens on. */
  port: number;
  /** PostgreSQL connection string used by Prisma. */
  databaseUrl: string;
  /** Explicit browser origins allowed to call the API with credentials. */
  corsOrigins: string[];
  /** Express `trust proxy` setting, used behind reverse proxies. */
  trustProxy: TrustProxy;
  /** Public web origin used inside links, OAuth callbacks, and redirects. */
  webAppUrl: string;
  /** Shared secret the web proxy sends and this API requires on auth routes. */
  proxySharedSecret: string;
  /** HS256 secret for access tokens and OAuth state values. */
  jwtSecret: string;
  /** HS256 secret for refresh token payloads. Distinct from `jwtSecret`. */
  jwtRefreshSecret: string;
  /** Google OAuth 2.0 client credentials. */
  googleClient: { id: string; secret: string };
  /** Facebook OAuth 2.0 app credentials. */
  facebookClient: { id: string; secret: string };
  /** Resend API key used for verification and reset email. */
  resendApiKey: string;
  /** Sender address on every auth email. */
  emailFrom: string;
}

const DEFAULT_PORT = 4000;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_CORS_ORIGIN = "http://localhost:3000";

/**
 * Parses and validates the process environment.
 *
 * Throws on invalid or missing required values so the process fails fast
 * at startup instead of failing on the first request.
 *
 * @param source Environment object. Defaults to `process.env`; injectable for tests.
 * @returns Validated API configuration.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const databaseUrl = source["DATABASE_URL"]?.trim();
  if (!databaseUrl) {
    throw new Error(
      "Missing required environment variable: DATABASE_URL. " +
        "Copy apps/api/.env.example to apps/api/.env and fill in the values.",
    );
  }

  const jwtSecret = parseJwtSecret(source, "JWT_SECRET");
  const jwtRefreshSecret = parseJwtSecret(source, "JWT_REFRESH_SECRET");

  if (jwtSecret === jwtRefreshSecret) {
    throw new Error(
      "JWT_SECRET and JWT_REFRESH_SECRET must be different values.",
    );
  }

  return {
    nodeEnv: parseNodeEnv(source["NODE_ENV"]),
    host: source["HOST"]?.trim() || DEFAULT_HOST,
    port: parsePort(source["PORT"]),
    databaseUrl,
    corsOrigins: parseCorsOrigins(source["CORS_ORIGIN"]),
    trustProxy: parseTrustProxy(source["TRUST_PROXY"]),
    webAppUrl: parseWebAppUrl(source["WEB_APP_URL"]),
    proxySharedSecret: parseSecret(source, "PROXY_SHARED_SECRET", 16),
    jwtSecret,
    jwtRefreshSecret,
    googleClient: {
      id: parseCredential(source, "GOOGLE_CLIENT_ID"),
      secret: parseCredential(source, "GOOGLE_CLIENT_SECRET"),
    },
    facebookClient: {
      id: parseCredential(source, "FACEBOOK_APP_ID"),
      secret: parseCredential(source, "FACEBOOK_APP_SECRET"),
    },
    resendApiKey: parseCredential(source, "RESEND_API_KEY"),
    emailFrom: parseEmailFrom(source["EMAIL_FROM"]),
  };
}

const PLACEHOLDER_PATTERN =
  /change[-_ ]?me|placeholder|your[-_ ]?(secret|key|value)|^\.+$/i;

/**
 * Reads a required string and rejects values that still look like a sample.
 */
function parseSecret(
  source: NodeJS.ProcessEnv,
  name: string,
  minLength: number,
): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in apps/api/.env.`,
    );
  }
  if (value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters long.`);
  }
  if (PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(
      `${name} is still set to a placeholder value. Use a real secret.`,
    );
  }
  return value;
}

function parseJwtSecret(source: NodeJS.ProcessEnv, name: string): string {
  return parseSecret(source, name, 32);
}

function parseCredential(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name]?.trim();
  if (!value || PLACEHOLDER_PATTERN.test(value) || value === "...") {
    throw new Error(
      `Missing required environment variable: ${name}. Set a real value in apps/api/.env.`,
    );
  }
  return value;
}

function parseWebAppUrl(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    throw new Error(
      "Missing required environment variable: WEB_APP_URL. " +
        "Set it to the public web origin, for example http://localhost:3000.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `Invalid WEB_APP_URL "${raw}". Expected an absolute http(s) URL.`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("WEB_APP_URL must use http or https.");
  }

  return parsed.origin;
}

function parseEmailFrom(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw || !raw.includes("@") || PLACEHOLDER_PATTERN.test(raw)) {
    throw new Error(
      "Missing required environment variable: EMAIL_FROM. " +
        "Set it to a verified sender such as Crochet PeakZ <hello@example.com>.",
    );
  }
  return raw;
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  const normalized = value?.trim() || "development";
  if (
    normalized !== "development" &&
    normalized !== "test" &&
    normalized !== "production"
  ) {
    throw new Error(
      `Invalid NODE_ENV "${normalized}". Expected development, test, or production.`,
    );
  }
  return normalized;
}

function parsePort(value: string | undefined): number {
  if (!value?.trim()) {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT "${value}". Expected an integer from 1 to 65535.`,
    );
  }
  return port;
}

function parseCorsOrigins(value: string | undefined): string[] {
  const raw = value?.trim();
  if (!raw) {
    return [DEFAULT_CORS_ORIGIN];
  }

  const origins = [
    ...new Set(
      raw
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter((origin) => origin.length > 0),
    ),
  ];

  if (origins.length === 0) {
    throw new Error("CORS_ORIGIN must contain at least one origin.");
  }

  if (origins.includes("*")) {
    throw new Error(
      "CORS_ORIGIN cannot be '*'. List explicit origins because credentials are enabled.",
    );
  }

  return origins;
}

function parseTrustProxy(value: string | undefined): TrustProxy {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "false" || normalized === "0") {
    return false;
  }
  if (normalized === "true") {
    return true;
  }

  const hops = Number(normalized);
  if (Number.isInteger(hops) && hops >= 0) {
    return hops;
  }

  // Express also accepts names such as "loopback" or a comma separated
  // list of trusted subnets.
  return normalized;
}
