import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Admin overview | Crochet PeakZ",
  robots: { index: false, follow: false },
};

/**
 * Admin landing page.
 *
 * It confirms the account has the ADMIN role. Catalogue, order, and customer
 * tools arrive with the features that own them and will link from here.
 */
export default function AdminPage() {
  return (
    <>
      <header className="space-y-2 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Admin
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Store dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          You are signed in with an administrator account.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Access is working</CardTitle>
            <CardDescription>
              The admin guard checked your role against the API on this visit.
              Removing the role takes effect on the next request, even while an
              access token is still valid.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Management tools</CardTitle>
            <CardDescription>
              Product, order, and customer management are separate features.
              Their screens will appear here as they ship.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Back to the storefront</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
