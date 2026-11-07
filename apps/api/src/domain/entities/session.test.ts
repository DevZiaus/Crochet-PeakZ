import { describe, expect, it } from "vitest";
import { ROTATION_GRACE_MS } from "../auth-constants.js";
import { Session } from "./session.js";
import { makeSessionSnapshot } from "../../test-support/auth-fakes.js";

const NOW = new Date("2026-01-01T12:00:00Z");

describe("Session", () => {
  it("detects an expired session", () => {
    const session = Session.reconstitute(
      makeSessionSnapshot({ expiresAt: NOW }),
    );

    expect(session.isExpired(NOW)).toBe(true);
    expect(session.isExpired(new Date(NOW.getTime() - 1))).toBe(false);
  });

  it("treats a rotated token inside the grace window as a concurrent refresh", () => {
    const session = Session.reconstitute(
      makeSessionSnapshot({
        revokedAt: NOW,
        replacedByTokenId: "session-2",
      }),
    );

    expect(
      session.isWithinRotationGrace(
        new Date(NOW.getTime() + ROTATION_GRACE_MS),
      ),
    ).toBe(true);
    expect(session.isReuse(NOW)).toBe(false);
  });

  it("treats a rotated token after the grace window as reuse", () => {
    const session = Session.reconstitute(
      makeSessionSnapshot({
        revokedAt: NOW,
        replacedByTokenId: "session-2",
      }),
    );

    expect(
      session.isReuse(new Date(NOW.getTime() + ROTATION_GRACE_MS + 1)),
    ).toBe(true);
  });

  it("does not treat a revoked session without a successor as reuse", () => {
    const session = Session.reconstitute(
      makeSessionSnapshot({ revokedAt: NOW, replacedByTokenId: null }),
    );

    expect(session.isWithinRotationGrace(NOW)).toBe(false);
    expect(session.isReuse(NOW)).toBe(false);
    expect(
      session.isReuse(new Date(NOW.getTime() + ROTATION_GRACE_MS + 1)),
    ).toBe(false);
  });

  it("does not treat an active session as reuse", () => {
    const session = Session.reconstitute(makeSessionSnapshot());

    expect(session.isRevoked()).toBe(false);
    expect(session.isReuse(new Date(NOW.getTime() + 60_000))).toBe(false);
  });

  it("is active only while neither revoked nor expired", () => {
    const active = Session.reconstitute(makeSessionSnapshot());
    const revoked = Session.reconstitute(
      makeSessionSnapshot({ revokedAt: NOW }),
    );
    const expired = Session.reconstitute(
      makeSessionSnapshot({ expiresAt: NOW }),
    );

    expect(active.isActive(NOW)).toBe(true);
    expect(revoked.isActive(NOW)).toBe(false);
    expect(expired.isActive(NOW)).toBe(false);
  });
});
