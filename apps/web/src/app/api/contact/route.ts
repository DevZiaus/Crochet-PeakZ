import { NextResponse, type NextRequest } from "next/server";
import { CONTACT_MAX_BODY_BYTES } from "@crochet-peakz/shared";
import { PROXY_CLIENT_IP_HEADER, readClientIp } from "@/lib/auth/client-ip";
import { getCatalogEnv } from "@/lib/catalog/env";

/** Forces request-time evaluation on every call. */
export const dynamic = "force-dynamic";

const CONTACT_TIMEOUT_MS = 10_000;

function errorResponse(message: string, statusCode: number): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        statusCode,
      },
    },
    {
      status: statusCode,
      headers: { "cache-control": "no-store" },
    },
  );
}

function isSameOrigin(request: NextRequest, webAppUrl: string): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  if (origin.replace(/\/$/, "") === webAppUrl) {
    return true;
  }

  try {
    const originHost = new URL(origin).host;
    const rawHost =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      "";
    const requestHost = rawHost.split(",")[0]?.trim() ?? "";

    return requestHost.length > 0 && originHost === requestHost;
  } catch {
    return false;
  }
}

async function readLimitedBody(
  request: NextRequest,
): Promise<{ ok: true; body: ArrayBuffer | undefined } | { ok: false }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > CONTACT_MAX_BODY_BYTES) {
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
    if (total > CONTACT_MAX_BODY_BYTES) {
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
 * Proxies same-origin contact form submissions to the backend API (`POST /api/contact`).
 *
 * @param request Incoming browser request.
 * @returns Relayed API response with `Cache-Control: no-store`.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const env = getCatalogEnv();

  if (!isSameOrigin(request, env.webAppUrl)) {
    return errorResponse("Invalid request origin.", 403);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse("Invalid request.", 415);
  }

  const read = await readLimitedBody(request);
  if (!read.ok) {
    return errorResponse("Your message is too large.", 413);
  }

  const clientIp = readClientIp(request.headers);
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("origin", env.webAppUrl);
  headers.set("x-forwarded-for", clientIp);

  const proxySecret = process.env["PROXY_SHARED_SECRET"]?.trim();
  if (proxySecret) {
    headers.set("x-proxy-secret", proxySecret);
    headers.set(PROXY_CLIENT_IP_HEADER, clientIp);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${env.apiInternalUrl}/contact`, {
      method: "POST",
      headers,
      body: read.body && read.body.byteLength > 0 ? read.body : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(CONTACT_TIMEOUT_MS),
    });
  } catch {
    return errorResponse(
      "We could not send your message right now. Please try again in a moment.",
      502,
    );
  }

  const body = await upstream.arrayBuffer();
  const responseHeaders = new Headers();
  for (const name of ["content-type", "retry-after"]) {
    const value = upstream.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }
  responseHeaders.set("cache-control", "no-store");

  return new NextResponse(body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
