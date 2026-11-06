/** The access cookie written by a successful sign in or refresh. */
export const ACCESS_COOKIE = "cp_access";

/** The long lived cookie that proves a refresh is possible. */
export const REFRESH_COOKIE = "cp_refresh";

/**
 * Reads one cookie value from a raw `Cookie` header.
 *
 * Express percent encodes cookie values when it writes them, so the value is
 * decoded here to match the API reader. A malformed sequence is treated as an
 * absent cookie rather than throwing.
 *
 * @param header The raw header value.
 * @param name Cookie name to find.
 * @returns The decoded value, or undefined when absent or malformed.
 */
export function readCookie(header: string, name: string): string | undefined {
  try {
    for (const part of header.split(";")) {
      const [key, ...rest] = part.trim().split("=");
      if (key === name) {
        return decodeURIComponent(rest.join("="));
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Reads one cookie value from a list of `Set-Cookie` header values.
 *
 * @param setCookies Raw `Set-Cookie` values.
 * @param name Cookie name to find.
 * @returns The value, or undefined when the cookie is absent.
 */
export function readSetCookie(
  setCookies: string[],
  name: string,
): string | undefined {
  for (const cookie of setCookies) {
    const first = cookie.split(";")[0] ?? "";
    const [key, ...rest] = first.split("=");
    if (key?.trim() === name) {
      return rest.join("=");
    }
  }
  return undefined;
}

/**
 * Returns a `Cookie` header with one value replaced or appended.
 *
 * @param header The original header value.
 * @param name Cookie name to replace.
 * @param value New cookie value.
 * @returns The rewritten header.
 */
export function writeCookie(
  header: string,
  name: string,
  value: string,
): string {
  const parts = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => part.split("=")[0] !== name);

  parts.push(`${name}=${value}`);
  return parts.join("; ");
}
