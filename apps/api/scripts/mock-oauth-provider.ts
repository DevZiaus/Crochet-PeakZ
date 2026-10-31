import process from "node:process";
import {
  startMockOAuthProvider,
  type MockOAuthProfile,
} from "../src/test-support/mock-oauth-provider.js";

const port = Number(process.env["MOCK_OAUTH_PORT"] ?? "9099");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("MOCK_OAUTH_PORT must be an integer from 1 to 65535.");
}

/** Builds the fixture returned for one provider. */
function fixture(
  provider: "google" | "facebook",
  email: string,
  name: string,
): MockOAuthProfile {
  return {
    id: `${provider}-mock-account`,
    name,
    email,
    emailVerified: true,
    pictureUrl: `https://cdn.example.com/${provider}-mock.png`,
  };
}

const provider = await startMockOAuthProvider({
  port,
  google: fixture(
    "google",
    process.env["MOCK_GOOGLE_EMAIL"] ?? "google.mock@example.com",
    "Google Mock Customer",
  ),
  facebook: fixture(
    "facebook",
    process.env["MOCK_FACEBOOK_EMAIL"] ?? "facebook.mock@example.com",
    "Facebook Mock Customer",
  ),
});

const base = provider.url;

console.log(`[mock-oauth] Listening on ${base}`);
console.log("[mock-oauth] Point the API at this server for a local sign in:");
console.log(`GOOGLE_AUTH_URL=${base}/oauth/google/authorize`);
console.log(`GOOGLE_TOKEN_URL=${base}/oauth/google/token`);
console.log(`GOOGLE_USERINFO_URL=${base}/oauth/google/userinfo`);
console.log(`FACEBOOK_AUTH_URL=${base}/oauth/facebook/authorize`);
console.log(`FACEBOOK_TOKEN_URL=${base}/oauth/facebook/token`);
console.log(`FACEBOOK_PROFILE_URL=${base}/oauth/facebook/profile`);
console.log("[mock-oauth] Both providers approve immediately.");

/** Closes the server before exiting. */
async function shutdown(): Promise<void> {
  await provider.close();
  process.exit(0);
}

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
