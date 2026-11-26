/**
 * Small browser helper for the auth endpoints.
 *
 * Every call goes to the web origin; the Next.js proxy adds the shared secret
 * and handles a stale access token.
 */

/** Error body the API returns. */
export interface AuthApiError {
  message: string;
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;
}

/** Upper bound for one browser auth request, so a stalled proxy or network cannot hang a form. */
const AUTH_FETCH_TIMEOUT_MS = 10_000;

/** Success or failure of an auth call. */
export type AuthApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: AuthApiError };

/**
 * Posts JSON to an auth endpoint and normalizes the response.
 *
 * @param path Path under `/api/auth`.
 * @param body JSON body.
 * @returns Parsed data or a typed error.
 */
export async function postAuthJson<T>(
  path: string,
  body: unknown,
): Promise<AuthApiResult<T>> {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
    });

    if (response.status === 204) {
      return { ok: true, status: 204, data: undefined as T };
    }

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: toError(payload, response.status),
      };
    }

    return { ok: true, status: response.status, data: payload as T };
  } catch {
    return {
      ok: false,
      status: 0,
      error: {
        message:
          "We could not reach the store. Check your connection and try again.",
        statusCode: 0,
      },
    };
  }
}

/** Narrow an unknown error body to the API shape. */
function toError(payload: unknown, status: number): AuthApiError {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "object"
  ) {
    const error = (payload as { error: Record<string, unknown> }).error;
    return {
      message:
        typeof error["message"] === "string"
          ? error["message"]
          : "Something went wrong.",
      statusCode:
        typeof error["statusCode"] === "number" ? error["statusCode"] : status,
      code: typeof error["code"] === "string" ? error["code"] : undefined,
      details:
        typeof error["details"] === "object" && error["details"] !== null
          ? (error["details"] as Record<string, unknown>)
          : undefined,
    };
  }

  return { message: "Something went wrong. Try again.", statusCode: status };
}

/**
 * Reads a string field from an error's details.
 *
 * @param error API error.
 * @param key Detail key.
 * @returns The string value, or undefined.
 */
export function detailString(
  error: AuthApiError,
  key: string,
): string | undefined {
  const value = error.details?.[key];
  return typeof value === "string" ? value : undefined;
}

/** Reads a number field from an error's details. */
export function detailNumber(
  error: AuthApiError,
  key: string,
): number | undefined {
  const value = error.details?.[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * Reads the first field issue message from a validation error.
 *
 * @param error API error.
 * @returns The first issue message, or the general error message.
 */
export function firstIssueMessage(error: AuthApiError): string {
  const issues: unknown = error.details?.["issues"];
  if (Array.isArray(issues)) {
    const first: unknown = issues[0];
    if (
      typeof first === "object" &&
      first !== null &&
      "message" in first &&
      typeof (first as { message?: unknown }).message === "string"
    ) {
      return (first as { message: string }).message;
    }
  }
  return error.message;
}
