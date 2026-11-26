# 0005. Customer auth: rationale

## Context

> ⚠️ Premise note: building authentication yourself is a known failure pattern. Expiry, rotation, cookie flags, CSRF, account linking, and lockout each hide a way to lose accounts. Spec 0001 already recorded self hosted JWT, Passport.js, and bcryptjs as the project's auth stack, and this spec keeps that decision rather than reopening it. The build must therefore lean on proven libraries for every primitive (`jose` for signing, Passport for OAuth, bcryptjs for hashing, standard cookie flags) and keep the custom code to the wiring. A hosted provider such as Clerk or Auth0 would remove most of this risk and is the honest runner up; it was not chosen because the stack is deliberately vendor free and self hosted.

The scope makes accounts mandatory: there is no guest checkout, so every order, digital download, and commission belongs to a user. Slice 1 needs that identity to exist before the catalog, cart, and checkout slices can be built, because checkout cannot be designed without knowing how a signed in customer is recognised.

Four forces shape the design. First, the app is a decoupled monorepo: a Next.js frontend and a separate Express API, which raises the question of how a cookie set by one is trusted by the other. Second, the store sells to Bangladesh and internationally, so a large share of customers arrive on mobile, often through a Google or Facebook session rather than a password. Third, the project is operated by a small team that wants boring infrastructure: PostgreSQL already exists, and nothing new should need a Redis or a queue. Fourth, the store handles names and emails (personal data) but no card data, so the security bar is real account integrity, not PCI DSS.

Without this decision, every later slice invents its own idea of who the user is, and the first protected screen becomes a security decision made inline while building a feature that needed something else.

## Options considered

### Option 1: Self hosted JWT sessions behind a Next.js proxy (chosen)

Express owns auth. A short lived access JWT (`jose`) and an opaque rotating refresh token are both sent as HttpOnly cookies. Refresh rows live in the existing `RefreshToken` table so sessions can be revoked. Next.js route handlers forward `/api/auth/*` to the API with a shared secret and relay `Set-Cookie`, so the browser stays on one origin.

**Pros**:

- No vendor, no per user pricing, no outside dependency for the core login path.
- Sessions are revocable, because the database holds the refresh rows and the rotation chain.
- One origin in the browser removes a whole class of cross site cookie problems in production and in Docker.
- Fits the stack and deployment contract already recorded in specs 0001 and 0004.

**Cons**:

- The team owns the security surface, including rotation, reuse detection, lockout, and cookie policy.
- The proxy is an extra hop and an extra place to get the origin and secret checks right.
- Two secrets must stay in sync between two workspaces.

### Option 2: Hosted auth provider

Delegate sign in to a hosted product (Clerk, Auth0, or a Supabase style auth service) and keep only a local user row keyed by the provider's subject id.

**Pros**:

- The hard parts (rotation, verification deliverability, OAuth app maintenance, MFA later) are someone else's problem.
- Fastest path to a working, well tested login, and a dashboard for support cases.

**Cons**:

- Adds vendor lock in and a recurring cost that grows with customers, against a stack chosen to stay portable.
- User data is split across two systems, and every admin screen has to reconcile both.
- Contradicts the auth decision already recorded and accepted in spec 0001.

### Option 3: Opaque server sessions only, no JWT

A single opaque session id in a cookie, looked up in PostgreSQL on every request.

**Pros**:

- The simplest possible model: revocation is instant, no signing secrets, no rotation chain.
- Fewer moving parts than access plus refresh, which is real security value at small scale.

**Cons**:

- Every request pays a database round trip before any handler runs.
- The API is no longer stateless, which complicates the horizontally scaled deployment option in spec 0004.
- Spec 0001 already chose JWT, and the `RefreshToken` table implies a token model.

### Option 4: Single long lived JWT, no refresh row

One signed token with a long life, held in an HttpOnly cookie.

**Pros**:

- The least code: sign once, verify everywhere, no database writes on sign in.

**Cons**:

- No revocation. Sign out clears one browser, and a stolen token stays valid until it expires.
- Cannot satisfy sign out everywhere or the "revoke all sessions on password reset" rule.

## Rationale

Option 1 wins because it is the only option that satisfies every rule the engineer asked for while keeping the vendor free position the project already took: sessions that survive reloads, revocable sessions, an audit of devices, automatic rotation, and a reset that kills open sessions. Option 3 is genuinely simpler and would be defensible for a much smaller surface, but it gives up the stateless API contract in spec 0004 and contradicts 0001. Option 2 would be the responsible choice for a team without the appetite to own auth, and it stays the runner up if operating this becomes a burden. Option 4 cannot revoke, so it fails the core requirement.

The proxy deserves its own note. Calling the API directly from the browser is fewer moving parts, and it was the recommendation in the conversation. The engineer chose the proxy so the browser sees one origin. That choice also pays a dividend: cookies become first party and simple, and server components can read the session before rendering, which removes the flash of protected content. Its cost is the shared secret, the Origin check, and the client IP forwarding, all of which are named in the spec so the build cannot improvise them.

Two details came out of conflicts rather than preferences. The refresh cookie had to widen from the refresh path to `/`, because a proxy that silently refreshes a request on any path needs the token on that path; the engineer chose the wider scope once the tradeoff was on the table. And OAuth linking to an unverified local account clears that account's password, because otherwise a person who pre registered someone else's address keeps working access when the real owner arrives through Google.

The OAuth round trip follows the same one origin rule. The callback URL registered with each provider points at the web origin, so the provider returns the browser to the proxy rather than to the API host, and the cookies the API issues are relayed onto the web host. The runner up was letting the provider call the API directly, which is less plumbing but puts the session cookie on the API host, where the browser never otherwise goes. Redirect state is a signed cookie rather than session middleware: it protects the callback from forgery and carries the `next` destination without adding a session store to a system that deliberately has no session layer.

On 2026-11-24, we reviewed the new account premise for Facebook sign in against Meta's Graph API User reference: Facebook deprecated its `User.verified` field, exposes no boolean `email_verified` claim, and specifies for `email` that _"The User's primary email address listed on their profile. This field will not be returned if no valid email address is available."_ While `enableProof: true` sends `appsecret_proof` and `User.canLinkOAuthProvider` already prevents Facebook from linking into existing `LOCAL` or `GOOGLE` accounts (returning `link_failed` with no cookies and no mutation), first time Facebook sign in creates a row marked `emailVerified: true` on the strength of that Graph API rule. We deliberately decided not to require an email confirmation click on first Facebook sign in before launch: forcing a mailbox trip breaks one tap social login for mobile shoppers and adds an email delivery dependency to Facebook login, whereas the remaining risk (someone squatting an unregistered email and retaining Facebook access if the real owner later links via Google while `authProvider` remains `FACEBOOK`) requires Meta to break its documented rule. A manual check against a real Facebook test account with an unconfirmed email (expecting Graph API to omit `email` and redirect with `email_missing`) is tracked in [index.md](index.md) under Follow up, and adding a confirmation flow or blocking Google links into `FACEBOOK` accounts stays an explicit `/architect` option if Meta's behaviour ever changes.

The cross check changed three things that are worth recording. A refresh token that was rotated seconds ago is not treated as theft, because two browser tabs racing the proxy would otherwise sign a customer out everywhere; outside a 10 second window it is. Verification and reset links are rendered, never consumed, on GET, so a mail scanner that opens links cannot burn a token, which is why verification takes an explicit confirm. And the failure lockout is a fixed window that a reset clears, because an account lock is also a way to attack a known customer; the IP throttle stays the first line of defence.

The build keeps custom code at the edges: entities hold the invariants, use cases orchestrate, and every cryptographic operation goes through a proven library or Node's own crypto. That is the only way a self hosted auth design stays defensible.

## Evidence: tool and skill discovery

Checked 2026-10-25 with `npx skills find` and `--list` confirmation.

- Installed: `resend/resend-skills` (five skills: `resend`, `react-email`, `email-best-practices`, `resend-cli`, `agent-email-inbox`), `wshobson/agents@auth-implementation-patterns`, and `giuseppe-trisciuoglio/developer-kit@nextjs-app-router`.
- Not installed: `g1joshi/agent-skills@passport` (only 8 installs), `jsonwebtoken/jwt-skills` (wrong library), and `nextjs-authentication` (assumes Auth.js 5).
- No skill exists for `jose` or `express-rate-limit`.
- MCP: `resend/resend-mcp` was offered and the engineer chose to connect it for checking verification and reset mail in development. Nothing in this repo can connect it; it is a user config step.
