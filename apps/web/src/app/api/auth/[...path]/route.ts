import { NextResponse, type NextRequest } from "next/server";
import { getWebAuthEnv } from "@/lib/auth/web-env";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  readCookie,
  readSetCookie,
  writeCookie,
} from "@/lib/auth/cookies";
import { readClientIp } from "@/lib/auth/client-ip";

/** Forces request time evaluation on every call. */
export const dynamic = "force-dynamic";

/** How long an upstream auth call may take before the proxy gives up. */
const AUTH_FETCH_TIMEOUT_MS = 5_000;

/** The API's JSON limit. The proxy stops reading at the same boundary. */
const MAX_AUTH_BODY_BYTES = 1024 * 1024;

/**
 * The only API paths this proxy will call.
 *
 * The catch all route must not become an open relay that adds the shared
 * secret to any path a caller invents.
 */
const ALLOWED_AUTH_PATHS = new Set([
  "register",
  "verify-email",
  "resend-verification",
  "login",
  "refresh",
  "logout",
  "me",
  "forgot-password",
  "reset-password",
  "google",
  "google/callback",
  "facebook",
  "facebook/callback",
]);

/** Next.js route context with the catch all auth path. */
interface RouteContext {
  params: Promise<{ path: string[] }>;
}

/**
 * Reads an auth request body without buffering more than the API accepts.
 *
 * A declared `Content-Length` above the limit is refused before any byte is
 * read. A chunked body has no declared length, so the read stops as soon as
 * the running total passes the same boundary.
 *
 * @param request Incoming browser request.
 * @returns The body bytes, or a refusal when the body is too large.
 */
async function readLimitedBody(
  request: NextRequest,
): Promise<{ ok: true; body: ArrayBuffer | undefined } | { ok: false }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_AUTH_BODY_BYTES) {
    return { ok: false };
  }

  if (!request.body) {
    return { ok: true, body: undefined };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_AUTH_BODY_BYTES) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }

  if (total === 0) {
    return { ok: true, body: undefined };
  }

  const buffer = new ArrayBuffer(total);
  const view = new Uint8Array(buffer);
  let offset = 0;
  for (const chunk of chunks) {
    view.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, body: buffer };
}

/**
 * Forwards GET auth requests (including OAuth entry points and callbacks).
 *
 * @param request Incoming browser request.
 * @param context Dynamic route parameters.
 * @returns The API response, cookies and redirects included.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  return proxyAuthRequest(request, context);
}

/**
 * Forwards POST auth requests.
 *
 * @param request Incoming browser request.
 * @param context Dynamic route parameters.
 * @returns The API response, cookies and redirects included.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  return proxyAuthRequest(request, context);
}

/**
 * Relays one auth request to the API.
 *
 * The browser only ever talks to the web origin. The proxy adds the shared
 * secret, forwards the client IP, relays `Set-Cookie` and `Location`, and on a
 * 401 with a refresh cookie it refreshes once and replays the request once.
 */
async function proxyAuthRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const env = getWebAuthEnv();
  const { path } = await context.params;
  const targetPath = path.join("/");
  const method = request.method;

  if (method !== "GET" && method !== "POST") {
    return NextResponse.json(
      {
        error: {
          message: "Method not allowed.",
          statusCode: 405,
        },
      },
      { status: 405 },
    );
  }

  const isWrite = method === "POST";

  if (!ALLOWED_AUTH_PATHS.has(targetPath)) {
    return NextResponse.json(
      {
        error: {
          message: "Unknown auth endpoint.",
          statusCode: 404,
        },
      },
      { status: 404 },
    );
  }

  if (isWrite) {
    const origin = request.headers.get("origin");
    if (origin !== env.webAppUrl) {
      return NextResponse.json(
        {
          error: {
            message: "This request came from an untrusted origin.",
            statusCode: 403,
          },
        },
        { status: 403 },
      );
    }
  }

  let body: ArrayBuffer | undefined;
  if (isWrite) {
    const read = await readLimitedBody(request);
    if (!read.ok) {
      return NextResponse.json(
        {
          error: {
            message: "The request body is too large.",
            statusCode: 413,
          },
        },
        { status: 413 },
      );
    }
    body = read.body;
  }
  const originalCookie = request.headers.get("cookie") ?? "";
  const ip = readClientIp(request.headers);

  const target = `${env.apiInternalUrl}/auth/${targetPath}${request.nextUrl.search}`;

  const send = async (cookie: string) =>
    fetch(target, {
      method,
      headers: buildHeaders(env, { cookie, ip, isWrite, method, request }),
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
    });

  let response: Response;
  try {
    response = await send(originalCookie);
  } catch {
    return upstreamUnavailable();
  }

  let refreshSetCookies: string[] = [];
  const carriedRefresh = readCookie(originalCookie, REFRESH_COOKIE);
  const isRefreshCall = targetPath === "refresh";
  const isLoginCall = targetPath === "login";

  if (
    response.status === 401 &&
    carriedRefresh &&
    !isRefreshCall &&
    !isLoginCall
  ) {
    let refreshResponse: Response;
    try {
      refreshResponse = await fetch(`${env.apiInternalUrl}/auth/refresh`, {
        method: "POST",
        headers: buildHeaders(env, {
          cookie: originalCookie,
          ip,
          isWrite: true,
          method: "POST",
          request,
        }),
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
      });
    } catch {
      return upstreamUnavailable();
    }

    if (refreshResponse.status === 200) {
      refreshSetCookies = getSetCookies(refreshResponse.headers);
      const nextAccess = readSetCookie(refreshSetCookies, ACCESS_COOKIE);
      const nextRefresh = readSetCookie(refreshSetCookies, REFRESH_COOKIE);

      if (nextAccess) {
        let replayCookie = writeCookie(
          originalCookie,
          ACCESS_COOKIE,
          nextAccess,
        );
        if (nextRefresh) {
          // The refresh rotated both tokens. Replay with the new pair so the
          // API does not see the now revoked refresh token on the retry.
          replayCookie = writeCookie(replayCookie, REFRESH_COOKIE, nextRefresh);
        }
        try {
          response = await send(replayCookie);
        } catch {
          // The refresh already revoked the old token, so the browser must
          // still receive the rotated pair even though the replay failed.
          return upstreamUnavailable(refreshSetCookies);
        }
      }
    } else {
      // A failed refresh means the session is gone. Relay the refresh cookie
      // clearing so the browser stops retrying.
      refreshSetCookies = getSetCookies(refreshResponse.headers);
    }
  }

  return relay(response, refreshSetCookies);
}

/** The answer when the API cannot be reached or times out. */
function upstreamUnavailable(setCookies: string[] = []): NextResponse {
  const headers = new Headers();
  for (const cookie of setCookies) {
    headers.append("set-cookie", cookie);
  }
  return NextResponse.json(
    {
      error: {
        message: "The auth service did not answer. Try again.",
        statusCode: 502,
      },
    },
    { status: 502, headers },
  );
}

/** Builds the upstream request headers for one call. */
function buildHeaders(
  env: ReturnType<typeof getWebAuthEnv>,
  input: {
    cookie: string;
    ip: string;
    isWrite: boolean;
    method: string;
    request: NextRequest;
  },
): Headers {
  const headers = new Headers();
  const contentType = input.request.headers.get("content-type");
  const accept = input.request.headers.get("accept");
  const userAgent = input.request.headers.get("user-agent");

  if (contentType) {
    headers.set("content-type", contentType);
  }
  if (accept) {
    headers.set("accept", accept);
  }
  if (userAgent) {
    // The API stores this on the session row so customers can tell devices
    // apart. The API truncates it to 255 characters.
    headers.set("user-agent", userAgent);
  }
  if (input.cookie) {
    headers.set("cookie", input.cookie);
  }

  headers.set("x-proxy-secret", env.proxySharedSecret);
  headers.set("x-forwarded-for", input.ip);

  if (input.isWrite) {
    // The API rejects a write without the exact web origin. The proxy already
    // checked the browser value and now speaks for itself.
    headers.set("origin", env.webAppUrl);
  }

  return headers;
}

/** Turns the upstream response into a browser response, relaying cookies. */
async function relay(
  response: Response,
  extraSetCookies: string[],
): Promise<Response> {
  const isEmpty = response.status === 204 || response.status === 304;
  const body = isEmpty ? null : await response.arrayBuffer();
  const headers = new Headers();

  for (const name of [
    "content-type",
    "location",
    "retry-after",
    "x-robots-tag",
  ]) {
    const value = response.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  // Auth responses are per customer, so the proxy always answers no-store
  // rather than relaying whatever the API set.
  headers.set("cache-control", "no-store");

  const setCookies = [...getSetCookies(response.headers), ...extraSetCookies];
  for (const cookie of setCookies) {
    headers.append("set-cookie", cookie);
  }

  return new NextResponse(body, {
    status: response.status,
    headers,
  });
}

/** Reads every Set-Cookie value from a response. */
function getSetCookies(headers: Headers): string[] {
  return headers.getSetCookie();
}
