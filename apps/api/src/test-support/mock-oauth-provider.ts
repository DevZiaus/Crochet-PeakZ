import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { once } from "node:events";

/** The two providers the mock supports. */
export type MockOAuthProviderName = "google" | "facebook";

/** Identity the mock returns for one provider. */
export interface MockOAuthProfile {
  /** Provider subject id, stored as `providerId`. */
  id: string;
  /** Display name. */
  name: string;
  /** Email address, or null to simulate a provider that withholds it. */
  email: string | null;
  /** Google's `email_verified` claim. Ignored for Facebook. */
  emailVerified: boolean;
  /** Avatar URL, or null for an account without a picture. */
  pictureUrl: string | null;
}

/** One request the mock provider received. */
export interface MockOAuthRequest {
  /** Provider the request was for. */
  provider: MockOAuthProviderName;
  /** Full request URL. */
  url: URL;
  /** Parsed URL encoded body for token requests. */
  body: URLSearchParams | null;
}

/** Running mock provider that implements the two OAuth round trips. */
export interface MockOAuthProvider {
  /** Base URL, for example `http://127.0.0.1:54321`. */
  url: string;
  /** Replaces the fixture returned for the next sign in. */
  setProfile(provider: MockOAuthProviderName, profile: MockOAuthProfile): void;
  /** Requests grouped by endpoint kind. */
  readonly requests: {
    authorize: MockOAuthRequest[];
    token: MockOAuthRequest[];
    profile: MockOAuthRequest[];
  };
  /** Stops the server and closes keep alive sockets. */
  close(): Promise<void>;
}

/** Provider fixture used when the caller does not supply one. */
function defaultProfile(name: string): MockOAuthProfile {
  return {
    id: `${name}-sub`,
    name: `${name} customer`,
    email: null,
    emailVerified: true,
    pictureUrl: null,
  };
}

/**
 * Starts a local OAuth 2.0 provider for tests.
 *
 * It implements only the surface Passport uses: an authorization endpoint that
 * immediately approves and redirects with a code, a token endpoint that
 * returns a fixed bearer token, and a profile endpoint with the configured
 * fixture. No live Google or Facebook page is involved, so CAPTCHAs and
 * automation blocks never apply.
 *
 * @param options Initial identity for each provider and an optional fixed port.
 * @returns Handle with the base URL and a close function.
 */
export async function startMockOAuthProvider(
  options: {
    google?: MockOAuthProfile | undefined;
    facebook?: MockOAuthProfile | undefined;
    port?: number | undefined;
  } = {},
): Promise<MockOAuthProvider> {
  const profiles: Record<MockOAuthProviderName, MockOAuthProfile> = {
    google: options.google ?? defaultProfile("google"),
    facebook: options.facebook ?? defaultProfile("facebook"),
  };
  const codes = new Map<
    string,
    { provider: MockOAuthProviderName; redirectUri: string }
  >();
  const requests: MockOAuthProvider["requests"] = {
    authorize: [],
    token: [],
    profile: [],
  };
  let codeCounter = 0;

  const server = createServer((request, response) => {
    void handle(request, response).catch((error: unknown) => {
      sendJson(response, 500, {
        error: "mock_provider_error",
        detail: error instanceof Error ? error.message : String(error),
      });
    });
  });

  server.listen(options.port ?? 0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock OAuth provider did not bind a TCP port.");
  }

  /** Dispatches one request to the endpoint named in the path. */
  async function handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "127.0.0.1"}`,
    );
    const [prefix, provider, action] = url.pathname.split("/").filter(Boolean);

    if (
      prefix !== "oauth" ||
      (provider !== "google" && provider !== "facebook") ||
      !action
    ) {
      sendJson(response, 404, { error: "not_found" });
      return;
    }

    if (action === "authorize" && request.method === "GET") {
      handleAuthorize(provider, url, response);
      return;
    }

    if (action === "token" && request.method === "POST") {
      await handleToken(provider, url, request, response);
      return;
    }

    if (
      (action === "profile" || action === "userinfo") &&
      request.method === "GET"
    ) {
      handleProfile(provider, url, request, response);
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  }

  /** Approves immediately and redirects back with a code and the same state. */
  function handleAuthorize(
    provider: MockOAuthProviderName,
    url: URL,
    response: ServerResponse,
  ): void {
    requests.authorize.push({ provider, url, body: null });

    const redirectUri = url.searchParams.get("redirect_uri");
    if (!redirectUri) {
      sendJson(response, 400, { error: "invalid_request" });
      return;
    }

    const state = url.searchParams.get("state");
    if (url.searchParams.get("error")) {
      const failure = new URL(redirectUri);
      failure.searchParams.set(
        "error",
        url.searchParams.get("error") ?? "access_denied",
      );
      if (state) {
        failure.searchParams.set("state", state);
      }
      redirect(response, failure.toString());
      return;
    }

    codeCounter += 1;
    const code = `mock-${provider}-code-${codeCounter}`;
    codes.set(code, { provider, redirectUri });

    const target = new URL(redirectUri);
    target.searchParams.set("code", code);
    if (state) {
      target.searchParams.set("state", state);
    }

    redirect(response, target.toString());
  }

  /** Exchanges a code for a fixed bearer token. */
  async function handleToken(
    provider: MockOAuthProviderName,
    url: URL,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const body = new URLSearchParams(await readBody(request));
    requests.token.push({ provider, url, body });

    const code = body.get("code") ?? "";
    const entry = codes.get(code);
    if (
      !entry ||
      entry.provider !== provider ||
      body.get("grant_type") !== "authorization_code"
    ) {
      sendJson(response, 400, { error: "invalid_grant" });
      return;
    }

    codes.delete(code);
    sendJson(response, 200, {
      access_token: accessToken(provider),
      token_type: "Bearer",
      expires_in: 3600,
    });
  }

  /** Returns the current fixture for the provider. */
  function handleProfile(
    provider: MockOAuthProviderName,
    url: URL,
    request: IncomingMessage,
    response: ServerResponse,
  ): void {
    requests.profile.push({ provider, url, body: null });

    const supplied =
      url.searchParams.get("access_token") ??
      request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (supplied !== accessToken(provider)) {
      sendJson(response, 401, { error: "invalid_token" });
      return;
    }

    const profile = profiles[provider];

    if (provider === "google") {
      sendJson(response, 200, {
        sub: profile.id,
        name: profile.name,
        ...(profile.email
          ? { email: profile.email, email_verified: profile.emailVerified }
          : {}),
        ...(profile.pictureUrl ? { picture: profile.pictureUrl } : {}),
      });
      return;
    }

    sendJson(response, 200, {
      id: profile.id,
      name: profile.name,
      ...(profile.email ? { email: profile.email } : {}),
      ...(profile.pictureUrl
        ? { picture: { data: { url: profile.pictureUrl } } }
        : {}),
    });
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    setProfile(provider, profile) {
      profiles[provider] = profile;
    },
    requests,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
        server.closeAllConnections();
      });
    },
  };
}

/** Fixed token the mock issues for a provider. */
function accessToken(provider: MockOAuthProviderName): string {
  return `mock-${provider}-access-token`;
}

/** Reads and concatenates a request body. */
async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Sends a JSON response. */
function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  if (response.headersSent) {
    return;
  }
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

/** Sends a redirect response. */
function redirect(response: ServerResponse, location: string): void {
  response.writeHead(302, { location });
  response.end();
}
