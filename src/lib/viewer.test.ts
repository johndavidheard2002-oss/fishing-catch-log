import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { signSession } from "./auth";
import { createAngler, linkAnglers, linkByInviteCode, listAnglers, listHouseholdProfiles, seedDefaultAngler } from "./db/anglers";
import { getDb, resetDbForTests } from "./db/index";
import { registerJournal } from "./auth";
import { ANGLER_COOKIE, SESSION_COOKIE, requireViewerId, resolveViewerId, viewerIdFromRequest } from "./viewer";
import { LEGACY_SESSION_COOKIE } from "./viewer-cookie";

describe("viewer identity requires a signed-in session", () => {
  const previousPath = process.env.DATABASE_PATH;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function freshJournal() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-viewer-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    resetDbForTests();
    getDb();
  }

  function requestWithCookie(value?: string) {
    const headers = new Headers();
    if (value) headers.set("cookie", `${ANGLER_COOKIE}=${value}`);
    return new NextRequest("http://localhost/api/me", { headers });
  }

  it("rotates the session cookie away from leftover tester sessions", () => {
    expect(SESSION_COOKIE).toBe("cast-log-session-v2");
    expect(LEGACY_SESSION_COOKIE).toBe("cast-log-session");
    expect(ANGLER_COOKIE).toBe("cast-log-angler");
    expect(SESSION_COOKIE).not.toBe(LEGACY_SESSION_COOKIE);
  });

  it("does not mint a journal for a request without a cookie", async () => {
    freshJournal();
    const first = await seedDefaultAngler();
    const before = (await listAnglers()).length;
    const unknown = await viewerIdFromRequest(requestWithCookie());
    expect(unknown).toBe("");
    expect(await requireViewerId(requestWithCookie())).toBeNull();
    expect(await resolveViewerId(undefined)).toBe("");
    expect((await listAnglers()).length).toBe(before);
    expect(first.id).toBeTruthy();
  });

  it("gives two sequential no-cookie requests no journal", async () => {
    freshJournal();
    await seedDefaultAngler();
    const a = await viewerIdFromRequest(requestWithCookie());
    const b = await viewerIdFromRequest(requestWithCookie());
    expect(a).toBe("");
    expect(b).toBe("");
  });

  it("does not open a leftover unclaimed cookie as a journal", async () => {
    freshJournal();
    const mine = await createAngler("Pat");
    expect(await resolveViewerId(mine.id)).toBe("");
    expect(await requireViewerId(requestWithCookie(mine.id))).toBeNull();
    expect(await viewerIdFromRequest(requestWithCookie(mine.id))).toBe("");
  });

  it("does not create an angler from a minted cookie id", async () => {
    freshJournal();
    const first = await seedDefaultAngler();
    const minted = crypto.randomUUID();
    const before = (await listAnglers()).length;
    expect(await resolveViewerId(minted)).toBe("");
    expect((await listAnglers()).length).toBe(before);
    expect(minted).not.toBe(first.id);
  });

  it("does not reuse a claimed journal from an anonymous cookie", async () => {
    freshJournal();
    const claimed = await registerJournal({
      name: "Pat",
      email: "pat@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    const next = await resolveViewerId(claimed.angler.id);
    expect(next).toBe("");
    expect(await viewerIdFromRequest(requestWithCookie(claimed.angler.id))).toBe("");
  });

  it("ignores leftover angler and pre-rotation session cookies", async () => {
    freshJournal();
    const leftover = await seedDefaultAngler();
    const created = await registerJournal({
      name: "Pat",
      email: "pat@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const headers = new Headers();
    headers.set(
      "cookie",
      `${ANGLER_COOKIE}=${leftover.id}; ${LEGACY_SESSION_COOKIE}=${signSession(created.angler.id)}`,
    );
    expect(await viewerIdFromRequest(new NextRequest("http://localhost/api/me", { headers }))).toBe("");
    expect(await requireViewerId(new NextRequest("http://localhost/api/me", { headers }))).toBeNull();
  });

  it("does not treat a leftover unclaimed angler as signed in even with a session token", async () => {
    freshJournal();
    const leftover = await seedDefaultAngler();
    const headers = new Headers();
    headers.set("cookie", `${SESSION_COOKIE}=${signSession(leftover.id)}`);
    expect(leftover.claimed).toBe(false);
    expect(await viewerIdFromRequest(new NextRequest("http://localhost/api/me", { headers }))).toBe("");
    expect(await requireViewerId(new NextRequest("http://localhost/api/me", { headers }))).toBeNull();
  });

  it("opens only the rotated signed session", async () => {
    freshJournal();
    const created = await registerJournal({
      name: "Pat",
      email: "pat@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const other = await createAngler("Other");
    const headers = new Headers();
    headers.set("cookie", `${ANGLER_COOKIE}=${other.id}; ${SESSION_COOKIE}=${signSession(created.angler.id)}`);
    const id = await viewerIdFromRequest(new NextRequest("http://localhost/api/me", { headers }));
    expect(id).toBe(created.angler.id);
    expect(await requireViewerId(new NextRequest("http://localhost/api/me", { headers }))).toBe(created.angler.id);
  });

  it("lists only this journal plus linked friends, not every angler", async () => {
    freshJournal();
    const me = await createAngler("Pat");
    const friend = await createAngler("Sam");
    const stranger = await createAngler("Other tester");
    await linkAnglers(me.id, friend.id);
    const profiles = await listHouseholdProfiles(me.id);
    expect(profiles.map((row) => row.id).sort()).toEqual([friend.id, me.id].sort());
    expect(profiles.some((row) => row.id === stranger.id)).toBe(false);
  });

  it("does not let an invite code dump a tester into an unclaimed journal", async () => {
    freshJournal();
    const leftover = await seedDefaultAngler();
    const me = await registerJournal({
      name: "Pat",
      email: "pat@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    expect(me.ok).toBe(true);
    if (!me.ok) return;
    const blocked = await linkByInviteCode(me.angler.id, leftover.inviteCode);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toMatch(/own account/i);

    const friend = await registerJournal({
      name: "Sam",
      email: "sam@gulf.com",
      password: "password2",
      confirm: "password2",
    });
    expect(friend.ok).toBe(true);
    if (!friend.ok) return;
    const linked = await linkByInviteCode(me.angler.id, friend.angler.inviteCode);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.linked.id).toBe(friend.angler.id);
  });
});
