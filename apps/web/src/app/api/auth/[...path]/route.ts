import { NextResponse, type NextRequest } from "next/server";
import { getWebAuthEnv } from "@/lib/auth/web-env";

/** The access cookie the proxy replaces on a successful refresh. */
const ACCESS_COOKIE = "cp_access";

/** The long lived session cookie that proves a refresh is possible. */
const REFRESH_COOKIE = "cp_refresh";

/** Forces request time evaluation on every call. */
export const dynamic = "force-dynamic";

/** Next.js route context with the catch all auth path. */
interface RouteContext {
  params: Promise<{ path: string[] }>;
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
  const isWrite = method !== "GET" && method !== "HEAD";

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

  const body = isWrite ? await request.arrayBuffer() : undefined;
  const originalCookie = request.headers.get("cookie") ?? "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const target = `${env.apiInternalUrl}/auth/${targetPath}${request.nextUrl.search}`;

  const send = async (cookie: string) =>
    fetch(target, {
      method,
      headers: buildHeaders(env, { cookie, ip, isWrite, method, request }),
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
    });

  let response = await send(originalCookie);

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
    const refreshResponse = await fetch(`${env.apiInternalUrl}/auth/refresh`, {
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
    });

    if (refreshResponse.status === 200) {
      refreshSetCookies = getSetCookies(refreshResponse.headers);
      const nextAccess = readSetCookie(refreshSetCookies, ACCESS_COOKIE);

      if (nextAccess) {
        const replayCookie = writeCookie(
          originalCookie,
          ACCESS_COOKIE,
          nextAccess,
        );
        response = await send(replayCookie);
      }
    } else {
      // A failed refresh means the session is gone. Relay the refresh cookie
      // clearing so the browser stops retrying.
      refreshSetCookies = getSetCookies(refreshResponse.headers);
    }
  }

  return relay(response, refreshSetCookies);
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
    "cache-control",
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

/** Reads one cookie value from a raw Cookie header. */
function readCookie(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return undefined;
}

/** Reads one cookie value from a list of Set-Cookie headers. */
function readSetCookie(setCookies: string[], name: string): string | undefined {
  for (const cookie of setCookies) {
    const first = cookie.split(";")[0] ?? "";
    const [key, ...rest] = first.split("=");
    if (key?.trim() === name) {
      return rest.join("=");
    }
  }
  return undefined;
}

/** Returns the Cookie header with one value replaced or appended. */
function writeCookie(header: string, name: string, value: string): string {
  const parts = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => part.split("=")[0] !== name);

  parts.push(`${name}=${value}`);
  return parts.join("; ");
}
