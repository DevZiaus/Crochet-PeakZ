import { NextResponse, type NextRequest } from "next/server";
import { getWebAuthEnv } from "@/lib/auth/web-env";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  readCookie,
  readSetCookie,
  writeCookie,
} from "@/lib/auth/cookies";
import { PROXY_CLIENT_IP_HEADER, readClientIp } from "@/lib/auth/client-ip";

/** Default upstream fetch timeout in milliseconds. */
const DEFAULT_FETCH_TIMEOUT_MS = 5_000;

/** Configuration describing one same origin BFF proxy route group. */
export interface ApiProxyConfig {
  /** Upstream path prefix under `API_INTERNAL_URL` (e.g. `"/auth"` or `"/cart"`). */
  upstreamBasePath: string;
  /** HTTP methods accepted by this route group. */
  allowedMethods: readonly string[];
  /** Returns true when `(method, targetPath)` is allowed to reach the API. */
  isAllowedPath: (method: string, targetPath: string) => boolean;
  /** Maximum request body size in bytes before refusing with 413. */
  maxBodyBytes: number;
  /** Error message returned when the path is not on the allow list. */
  notFoundMessage: string;
  /** Error message returned when the upstream API fails or times out. */
  unavailableMessage: string;
  /** Whether a 401 response with a refresh cookie triggers one refresh and replay. */
  shouldRefreshOn401: (targetPath: string) => boolean;
  /** Upstream timeout override in milliseconds. */
  timeoutMs?: number;
}

/**
 * Reads a request body without buffering more than `maxBodyBytes`.
 *
 * A declared `Content-Length` above the limit is refused before any byte is
 * read. A chunked body stops reading as soon as the running total passes the
 * same boundary.
 *
 * @param request Incoming browser request.
 * @param maxBodyBytes Maximum body size in bytes.
 * @returns The body bytes, `undefined` when empty, or a refusal.
 */
async function readLimitedBody(
  request: NextRequest,
  maxBodyBytes: number,
): Promise<{ ok: true; body: ArrayBuffer | undefined } | { ok: false }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
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
    if (total > maxBodyBytes) {
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
 * Relays one browser request to the internal API with proxy authentication,
 * origin checking, bounded body reading, cookie relay, and one time 401
 * session refresh and replay.
 *
 * @param request Incoming browser request.
 * @param segments Optional catch all path segments.
 * @param config Proxy boundary configuration.
 * @returns Relayed response with `Cache-Control: no-store`.
 */
export async function proxyApiRequest(
  request: NextRequest,
  segments: readonly string[],
  config: ApiProxyConfig,
): Promise<Response> {
  const env = getWebAuthEnv();
  const targetPath = segments.join("/");
  const method = request.method;
  const timeoutMs = config.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  if (!config.allowedMethods.includes(method)) {
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

  if (!config.isAllowedPath(method, targetPath)) {
    return NextResponse.json(
      {
        error: {
          message: config.notFoundMessage,
          statusCode: 404,
        },
      },
      { status: 404 },
    );
  }

  const isWrite =
    method === "POST" || method === "PATCH" || method === "DELETE";

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
    const read = await readLimitedBody(request, config.maxBodyBytes);
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
  const pathSuffix = targetPath.length > 0 ? `/${targetPath}` : "";
  const target = `${env.apiInternalUrl}${config.upstreamBasePath}${pathSuffix}${request.nextUrl.search}`;

  const send = async (cookie: string) =>
    fetch(target, {
      method,
      headers: buildHeaders(env, { cookie, ip, isWrite, request }),
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

  let response: Response;
  try {
    response = await send(originalCookie);
  } catch {
    return upstreamUnavailable(config.unavailableMessage);
  }

  let refreshSetCookies: string[] = [];
  const carriedRefresh = readCookie(originalCookie, REFRESH_COOKIE);

  if (
    response.status === 401 &&
    carriedRefresh &&
    config.shouldRefreshOn401(targetPath)
  ) {
    let refreshResponse: Response;
    try {
      refreshResponse = await fetch(`${env.apiInternalUrl}/auth/refresh`, {
        method: "POST",
        headers: buildHeaders(env, {
          cookie: originalCookie,
          ip,
          isWrite: true,
          request,
        }),
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return upstreamUnavailable(config.unavailableMessage);
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
          return upstreamUnavailable(
            config.unavailableMessage,
            refreshSetCookies,
          );
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

/** Builds a 502 response when the upstream API cannot be reached or times out. */
function upstreamUnavailable(
  message: string,
  setCookies: string[] = [],
): NextResponse {
  const headers = new Headers();
  headers.set("cache-control", "no-store");
  for (const cookie of setCookies) {
    headers.append("set-cookie", cookie);
  }
  return NextResponse.json(
    {
      error: {
        message,
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
    headers.set("user-agent", userAgent);
  }
  if (input.cookie) {
    headers.set("cookie", input.cookie);
  }

  headers.set("x-proxy-secret", env.proxySharedSecret);
  headers.set("x-forwarded-for", input.ip);
  headers.set(PROXY_CLIENT_IP_HEADER, input.ip);

  if (input.isWrite) {
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
