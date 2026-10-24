"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";
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

/**
 * Header account control.
 *
 * Signed out it links to sign in with the current path as `next`. Signed in it
 * opens a menu with the account name, an admin link for admins, and sign out.
 */
export function AuthMenu() {
  const { user, loading, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  if (loading) {
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

  if (!user) {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="min-h-[44px] min-w-[44px]"
      >
        <Link
          href={`/login?next=${encodeURIComponent(pathname || "/")}`}
          aria-label="Sign in to your account"
        >
          <UserIcon className="size-5" />
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
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
          onSelect={() => {
            void signOut().then(() => {
              router.replace("/");
              router.refresh();
            });
          }}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
