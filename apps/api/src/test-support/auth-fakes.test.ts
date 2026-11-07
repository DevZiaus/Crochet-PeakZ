import { describe, expect, it } from "vitest";
import { Session } from "../domain/entities/session.js";
import {
  InMemorySessionRepository,
  makeSessionSnapshot,
} from "./auth-fakes.js";

describe("InMemorySessionRepository", () => {
  it("keeps the session creation time when seeded", () => {
    const createdAt = new Date("2025-12-01T00:00:00Z");
    const snapshot = makeSessionSnapshot({ createdAt });
    const sessions = new InMemorySessionRepository();

    sessions.seed(Session.reconstitute(snapshot));

    expect(sessions.sessions.get(snapshot.id)?.createdAt).toEqual(createdAt);
  });
});
