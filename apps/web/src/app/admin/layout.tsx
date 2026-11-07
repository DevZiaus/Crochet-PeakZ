import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeNextPath } from "@crochet-peakz/shared";
import { Header } from "@/components/header";
import { Container } from "@/components/container";
import { RequireRole } from "@/components/auth/require-role";
import { getSessionUser } from "@/lib/auth/session";

/** Where a caller without a session lands when no request path is available. */
const DEFAULT_RETURN_PATH = "/admin";

/**
 * The admin shell reads the request session, so it must render on every
 * request. This also keeps the build from evaluating the server auth
 * environment, which is only available at runtime.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin | Crochet PeakZ",
  robots: { index: false, follow: false },
};

/**
 * Admin area shell.
 *
 * The session is read on the server and the redirect happens instead of the
 * render, so an anonymous caller or a CUSTOMER never receives admin markup at
 * all. A browser side check alone cannot do that: the server would already have
 * rendered the children into the response before any client JavaScript runs.
 *
 * The client guard stays inside as the second layer. It catches the case where
 * the access token expired while the page was open, where the proxy refreshes
 * and replays before the role is judged.
 *
 * @param props Admin page content, rendered only for a proven ADMIN.
 * @returns The admin shell, or a redirect for anyone else.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // The proxy already asked the API and rewrote the cookie header, so its
  // answer is trusted here and no second `/me` call is made. A render that did
  // not come through the proxy falls back to reading the session itself.
  const guardedRole = await readGuardedRole();
  const role = guardedRole ?? (await getSessionUser())?.role ?? null;

  if (role === null) {
    const returnTo = await signInReturnPath();
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  if (role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <Header />

      <main className="flex-1 py-10 sm:py-12">
        <Container>
          <RequireRole role="ADMIN">
            <div className="mx-auto max-w-4xl space-y-8">{children}</div>
          </RequireRole>
        </Container>
      </main>
    </div>
  );
}

/**
 * Reads the role the request proxy already proved.
 *
 * @returns The verified role, or null when the render did not come through the
 *   proxy and the layout has to ask the API itself.
 */
async function readGuardedRole(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    return requestHeaders.get("x-auth-role");
  } catch {
    // Outside a request scope (unit tests) there is nothing to trust.
    return null;
  }
}

/**
 * Reads the path the request proxy recorded, so a layout only redirect returns
 * the caller to the admin screen they asked for rather than the admin root.
 */
async function signInReturnPath(): Promise<string> {
  try {
    const requestHeaders = await headers();
    return sanitizeNextPath(
      requestHeaders.get("x-auth-return-to"),
      DEFAULT_RETURN_PATH,
    );
  } catch {
    // Outside a request scope (unit tests) the admin root is the safe fallback.
    return DEFAULT_RETURN_PATH;
  }
}
