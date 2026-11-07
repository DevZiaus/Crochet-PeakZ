"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { sanitizeNextPath } from "@crochet-peakz/shared";
import {
  LayoutDashboard,
  Loader2,
  LogOut,
  RotateCw,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth/use-session";

/** Builds up to two initials for the avatar fallback. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Disabled account button shown while the query string is being read. */
function AccountButtonPlaceholder() {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Account"
      className="min-h-[44px] min-w-[44px]"
      disabled
    >
      <UserIcon className="size-5" />
    </Button>
  );
}

/**
 * Header account control.
 *
 * Signed out it links to sign in with the current path and query as `next`, so
 * a filtered view survives the round trip. Signed in it opens a menu with the
 * account name, an admin link for admins, and sign out.
 *
 * The menu reads the query string with `useSearchParams`, which suspends during
 * prerendering, so it sits behind a boundary that reserves the same button.
 */
export function AuthMenu() {
  return (
    <Suspense fallback={<AccountButtonPlaceholder />}>
      <AccountMenu />
    </Suspense>
  );
}

/** The account control once the query string is readable. */
function AccountMenu() {
  const { user, loading, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const next = sanitizeNextPath(query ? `${pathname}?${query}` : pathname, "/");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  // Radix closes the menu on select. Both menu items prevent that, so a
  // failure can show the retry inline; on success we navigate away anyway.
  const handleSignOut = useCallback(async (): Promise<void> => {
    setSignOutFailed(false);
    setPending(true);
    const result = await signOut();
    setPending(false);

    if (result.success) {
      setOpen(false);
      router.replace("/");
      router.refresh();
      return;
    }

    setSignOutFailed(true);
  }, [router, signOut]);

  // A stale failure must not greet the customer on the next open.
  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSignOutFailed(false);
    }
  }, []);

  if (loading) {
    return <AccountButtonPlaceholder />;
  }

  if (!user) {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="min-h-[44px] min-w-[44px]"
      >
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          aria-label="Sign in to your account"
        >
          <UserIcon className="size-5" />
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Account menu for ${user.name}`}
          className="min-h-[44px] min-w-[44px]"
        >
          <Avatar size="sm">
            {user.avatarUrl ? (
              <AvatarImage
                src={user.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback aria-hidden="true">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-semibold text-foreground">
            {user.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === "ADMIN" ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Admin dashboard
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          {pending ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <LogOut className="size-4" aria-hidden="true" />
          )}
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
        {signOutFailed ? (
          <>
            <DropdownMenuSeparator />
            <div role="alert" className="px-2 py-1.5 text-xs text-destructive">
              We could not sign you out. You are still signed in.
            </div>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void handleSignOut();
              }}
            >
              <RotateCw className="size-4" aria-hidden="true" />
              Try again
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
