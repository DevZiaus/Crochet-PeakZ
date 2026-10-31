import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { Container } from "@/components/container";
import { RequireRole } from "@/components/auth/require-role";
import { getSessionUser } from "@/lib/auth/session";

/** Where a caller without a session is sent, and where they return from. */
const SIGN_IN_URL = `/login?next=${encodeURIComponent("/admin")}`;

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
  const user = await getSessionUser();

  if (!user) {
    redirect(SIGN_IN_URL);
  }

  if (user.role !== "ADMIN") {
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
