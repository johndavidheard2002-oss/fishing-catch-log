import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { createAngler, linkAnglers, listHouseholdProfiles, seedDefaultAngler } from "./db/anglers";
import { getDb, resetDbForTests } from "./db/index";
import { ANGLER_COOKIE, resolveViewerId, viewerIdFromRequest } from "./viewer";

describe("viewer identity is per browser", () => {
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

  it("does not reuse the first/default angler for a request without a cookie", async () => {
    freshJournal();
    const first = await seedDefaultAngler();
    const unknown = await viewerIdFromRequest(requestWithCookie());
    expect(unknown).not.toBe(first.id);
    expect(await resolveViewerId(undefined)).not.toBe(first.id);
  });

  it("gives two sequential no-cookie requests different journals", async () => {
    freshJournal();
    await seedDefaultAngler();
    const a = await viewerIdFromRequest(requestWithCookie());
    const b = await viewerIdFromRequest(requestWithCookie());
    expect(a).not.toBe(b);
  });

  it("keeps a valid cookie on the same browser", async () => {
    freshJournal();
    const mine = await createAngler("Pat");
    const again = await viewerIdFromRequest(requestWithCookie(mine.id));
    expect(again).toBe(mine.id);
    expect(await resolveViewerId(mine.id)).toBe(mine.id);
  });

  it("claims a minted cookie id instead of falling back to the first angler", async () => {
    freshJournal();
    const first = await seedDefaultAngler();
    const minted = crypto.randomUUID();
    const claimed = await resolveViewerId(minted);
    expect(claimed).toBe(minted);
    expect(claimed).not.toBe(first.id);
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
});
