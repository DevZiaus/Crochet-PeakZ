import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Google brand mark.
 *
 * The official Google colors are hardcoded on purpose: `design.md` exempts
 * third party brand marks from the token only color rule so the marks are not
 * misrepresented.
 */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

/**
 * Facebook brand mark.
 *
 * Like the Google mark, the official brand color is hardcoded under the
 * `design.md` brand mark exemption from the token only color rule.
 */
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"
      />
    </svg>
  );
}

interface OAuthButtonsProps {
  /** Relative path to return to after sign in. */
  next: string;
}

/**
 * Google and Facebook sign in links.
 *
 * These are plain links so the browser performs the provider redirect through
 * the web origin, and the provider's callback returns to the proxy.
 */
export function OAuthButtons({ next }: OAuthButtonsProps) {
  const suffix = `?next=${encodeURIComponent(next)}`;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Button asChild variant="outline" className="w-full">
        <Link href={`/api/auth/google${suffix}`}>
          <GoogleIcon />
          Continue with Google
        </Link>
      </Button>
      <Button asChild variant="outline" className="w-full">
        <Link href={`/api/auth/facebook${suffix}`}>
          <FacebookIcon />
          Continue with Facebook
        </Link>
      </Button>
    </div>
  );
}
