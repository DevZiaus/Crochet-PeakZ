import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/header";
import { Container } from "@/components/container";
import { RequireRole } from "@/components/auth/require-role";

export const metadata: Metadata = {
  title: "Admin | Crochet PeakZ",
  robots: { index: false, follow: false },
};

/**
 * Admin area shell.
 *
 * The guard runs in the browser so the proxy can refresh an access token before
 * the role is judged. Non admins are sent away without seeing any admin markup.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
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
