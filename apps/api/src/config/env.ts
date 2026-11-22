import { DEFAULT_CONTACT_EMAIL } from "@crochet-peakz/shared";

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

/** Optional endpoint overrides used to point a provider at a local mock. */
export interface OAuthEndpointsConfig {
  /** Authorization page the browser is sent to. */
  authorizationUrl?: string;
  /** Token endpoint used for the code exchange. */
  tokenUrl?: string;
  /** Profile or userinfo endpoint used after the exchange. */
  profileUrl?: string;
}

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
  /** Google OAuth 2.0 client credentials, plus test-only endpoint overrides. */
  googleClient: {
    id: string;
    secret: string;
    endpoints?: OAuthEndpointsConfig | undefined;
  };
  /** Facebook OAuth 2.0 app credentials, plus test-only endpoint overrides. */
  facebookClient: {
    id: string;
    secret: string;
    endpoints?: OAuthEndpointsConfig | undefined;
  };
  /** Resend API key used for verification and reset email. */
  resendApiKey: string;
  /** Sender address on every auth email. */
  emailFrom: string;
  /** Destination inbox for contact form submissions. */
  contactEmail: string;
  /** Cloudinary cloud name used to build public delivery URLs. */
  cloudinaryCloudName: string;
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

  const nodeEnv = parseNodeEnv(source["NODE_ENV"]);
  const jwtSecret = parseJwtSecret(source, "JWT_SECRET");
  const jwtRefreshSecret = parseJwtSecret(source, "JWT_REFRESH_SECRET");

  if (jwtSecret === jwtRefreshSecret) {
    throw new Error(
      "JWT_SECRET and JWT_REFRESH_SECRET must be different values.",
    );
  }

  const googleEndpoints = parseOAuthEndpoints(
    source,
    {
      authorizationUrl: "GOOGLE_AUTH_URL",
      tokenUrl: "GOOGLE_TOKEN_URL",
      profileUrl: "GOOGLE_USERINFO_URL",
    },
    nodeEnv,
  );
  const facebookEndpoints = parseOAuthEndpoints(
    source,
    {
      authorizationUrl: "FACEBOOK_AUTH_URL",
      tokenUrl: "FACEBOOK_TOKEN_URL",
      profileUrl: "FACEBOOK_PROFILE_URL",
    },
    nodeEnv,
  );

  return {
    nodeEnv,
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
      ...(googleEndpoints ? { endpoints: googleEndpoints } : {}),
    },
    facebookClient: {
      id: parseCredential(source, "FACEBOOK_APP_ID"),
      secret: parseCredential(source, "FACEBOOK_APP_SECRET"),
      ...(facebookEndpoints ? { endpoints: facebookEndpoints } : {}),
    },
    resendApiKey: parseCredential(source, "RESEND_API_KEY"),
    emailFrom: parseEmailFrom(source["EMAIL_FROM"], nodeEnv),
    contactEmail: parseOptionalContactEmail(source["CONTACT_EMAIL"], nodeEnv),
    cloudinaryCloudName: parseCredential(source, "CLOUDINARY_CLOUD_NAME"),
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

/*
 * An address with a local part, an "@", and a dotted domain. Used only to
 * reject obviously malformed senders such as `foo@` or `CrocheT PeakZ`; the
 * address is not otherwise reinterpreted.
 */
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Loopback domains accepted only outside production. */
const LOCAL_EMAIL_DOMAINS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function parseEmailFrom(value: string | undefined, nodeEnv: NodeEnv): string {
  const raw = value?.trim();
  // Accept a bare address or the `Name <address>` form, and validate the
  // address itself rather than only the presence of an "@".
  const address = /<([^>]+)>/.exec(raw ?? "")?.[1]?.trim() ?? raw ?? "";

  if (
    !raw ||
    PLACEHOLDER_PATTERN.test(raw) ||
    !(
      EMAIL_ADDRESS_PATTERN.test(address) ||
      (nodeEnv !== "production" && isLocalEmailAddress(address))
    )
  ) {
    throw new Error(
      "Missing required environment variable: EMAIL_FROM. " +
        "Set it to a verified sender such as CrocheT PeakZ <hello@example.com>. " +
        "A localhost sender is allowed outside production.",
    );
  }
  return raw;
}

function parseOptionalContactEmail(
  value: string | undefined,
  nodeEnv: NodeEnv,
): string {
  const raw = value?.trim();
  if (!raw) {
    return DEFAULT_CONTACT_EMAIL;
  }

  if (
    PLACEHOLDER_PATTERN.test(raw) ||
    !(
      EMAIL_ADDRESS_PATTERN.test(raw) ||
      (nodeEnv !== "production" && isLocalEmailAddress(raw))
    )
  ) {
    throw new Error(
      "Invalid environment variable: CONTACT_EMAIL. " +
        "Set it to a valid destination address such as hello@crochetpeakz.tech.",
    );
  }

  return raw;
}

/**
 * Whether the address uses a loopback domain.
 *
 * @param address Bare email address.
 * @returns True for localhost and loopback IP domains.
 */
function isLocalEmailAddress(address: string): boolean {
  const at = address.lastIndexOf("@");
  if (at === -1) {
    return false;
  }
  return LOCAL_EMAIL_DOMAINS.has(address.slice(at + 1).toLowerCase());
}

/** Environment variable names for one provider's three endpoints. */
interface OAuthEndpointNames {
  authorizationUrl: string;
  tokenUrl: string;
  profileUrl: string;
}

/**
 * Reads optional endpoint overrides for a local mock provider.
 *
 * All three values are optional, but any value is rejected in production so a
 * deployment cannot accidentally route sign in through a test server.
 *
 * @param source Environment object.
 * @param names Variable name for each endpoint.
 * @param nodeEnv Current Node.js environment.
 * @returns Overrides, or undefined when none are set.
 */
function parseOAuthEndpoints(
  source: NodeJS.ProcessEnv,
  names: OAuthEndpointNames,
  nodeEnv: NodeEnv,
): OAuthEndpointsConfig | undefined {
  const authorizationUrl = parseOptionalHttpUrl(
    source[names.authorizationUrl],
    names.authorizationUrl,
  );
  const tokenUrl = parseOptionalHttpUrl(source[names.tokenUrl], names.tokenUrl);
  const profileUrl = parseOptionalHttpUrl(
    source[names.profileUrl],
    names.profileUrl,
  );

  if (!authorizationUrl && !tokenUrl && !profileUrl) {
    return undefined;
  }

  if (nodeEnv === "production") {
    throw new Error(
      `${names.authorizationUrl}, ${names.tokenUrl}, and ${names.profileUrl} ` +
        "are test-only overrides and cannot be set when NODE_ENV=production.",
    );
  }

  return {
    ...(authorizationUrl ? { authorizationUrl } : {}),
    ...(tokenUrl ? { tokenUrl } : {}),
    ...(profileUrl ? { profileUrl } : {}),
  };
}

/**
 * Reads an optional absolute http(s) URL.
 *
 * @param value Raw environment value.
 * @param name Variable name used in the error message.
 * @returns The normalized URL, or undefined when unset.
 */
function parseOptionalHttpUrl(
  value: string | undefined,
  name: string,
): string | undefined {
  const raw = value?.trim();
  if (!raw) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `Invalid ${name} "${raw}". Expected an absolute http(s) URL.`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must use http or https.`);
  }

  return parsed.toString();
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
