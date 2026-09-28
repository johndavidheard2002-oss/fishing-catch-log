import fs from "node:fs";
import os from "node:os";
import path, { resolve } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/auth/delete/route";
import { AUTH_WRONG, loginJournal, registerJournal, signSession } from "./auth";
import { JOURNAL_FREE_FOR_RELEASE } from "./entitlement";
import { DELETE_ACCOUNT_PHRASE } from "./delete-account-phrase";
import { deleteJournalAccount } from "./delete-account";
import { getAngler, linkAnglers, listBuddies } from "./db/anglers";
import { createBaitSpot, getBaitSpot } from "./db/bait";
import { createCatch, getCatch, listCatches } from "./db/catches";
import { deleteUploadedPhotoFile } from "./storage";
import { setStoredSubscription } from "./db/entitlement";
import { resetDbForTests } from "./db/index";
import { listSavedNamedAreas } from "./db/areas";
import { createCalendarNote, listCalendarNotes } from "./db/notes";
import { recordIdsSharedWith, setRecordShares } from "./db/shares";
import {
  clearOfflineAccountCache,
  listQueuedLogs,
  memoryOfflineBackend,
  readCachedSession,
  readJournalCache,
  resetOfflineBackend,
  saveQueuedLog,
  useOfflineBackend,
  writeCachedSession,
  writeJournalCache,
} from "./offline-store";
import { requireViewerId } from "./viewer";
import { SESSION_COOKIE } from "./viewer-cookie";

describe("in-app account deletion", () => {
  const previousPath = process.env.DATABASE_PATH;
  const previousUploads = process.env.UPLOADS_DIR;
  const tmpDirs: string[] = [];

  afterEach(() => {
    resetDbForTests();
    resetOfflineBackend();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    if (previousUploads === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previousUploads;
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs.length = 0;
  });

  function freshJournal() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-log-delete-"));
    tmpDirs.push(dir);
    process.env.DATABASE_PATH = path.join(dir, "journal.sqlite");
    process.env.UPLOADS_DIR = path.join(dir, "uploads");
    fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });
    resetDbForTests();
    return dir;
  }

  function writePhoto(name: string) {
    fs.writeFileSync(path.join(process.env.UPLOADS_DIR!, name), "photo");
  }

  async function register(name: string, email: string, password: string) {
    const result = await registerJournal({ name, email, password, confirm: password });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    return result.angler;
  }

  it("refuses a missing phrase or wrong password and leaves the journal", async () => {
    freshJournal();
    const pat = await register("Pat", "pat@gulf.com", "password1");
    const caught = await createCatch({
      species: "Redfish",
      caughtAt: "2026-08-02T15:00:00.000Z",
      placeName: "Mosquito Lagoon",
      anglerId: pat.id,
    });

    const missingPhrase = await deleteJournalAccount({
      anglerId: pat.id,
      password: "password1",
      confirm: "yes",
    });
    expect(missingPhrase).toEqual({ ok: false, error: "Type DELETE to confirm.", status: 400 });

    const wrongPassword = await deleteJournalAccount({
      anglerId: pat.id,
      password: "nope-nope",
      confirm: "delete",
    });
    expect(wrongPassword).toEqual({ ok: false, error: "Password is wrong.", status: 401 });

    expect(await getAngler(pat.id)).not.toBeNull();
    expect(await getCatch(caught.id)).not.toBeNull();
    expect((await listSavedNamedAreas(pat.id)).length).toBeGreaterThan(0);
  });

  it("permanently deletes the account, photos, and links without touching a friend", async () => {
    const dir = freshJournal();
    const outside = path.join(dir, "secret.jpg");
    fs.writeFileSync(outside, "keep");
    writePhoto("owner.jpg");
    writePhoto("bait.jpg");
    writePhoto("note.jpg");
    writePhoto("shared.jpg");

    const pat = await register("Pat", "pat@gulf.com", "password1");
    const sam = await register("Sam", "sam@gulf.com", "password2");
    await linkAnglers(pat.id, sam.id);

    const patCatch = await createCatch({
      species: "Redfish",
      caughtAt: "2026-08-02T15:00:00.000Z",
      placeName: "Mosquito Lagoon",
      photoPath: "owner.jpg",
      anglerId: pat.id,
    });
    const patBait = await createBaitSpot({
      loggedAt: "2026-08-02T16:00:00.000Z",
      placeName: "Haulover Canal",
      baitTypes: ["Shrimp"],
      photoPath: "bait.jpg",
      anglerId: pat.id,
    });
    await createCalendarNote(pat.id, {
      day: "2026-08-02",
      notes: "Dawn patrol",
      photoPath: "note.jpg",
    });
    await createCatch({
      species: "Trout",
      caughtAt: "2026-08-03T15:00:00.000Z",
      placeName: "The flats",
      photoPath: "/seed/redfish.svg",
      anglerId: pat.id,
    });
    await createCatch({
      species: "Snook",
      caughtAt: "2026-08-04T15:00:00.000Z",
      photoPath: "../secret.jpg",
      anglerId: pat.id,
    });
    const sharedCatch = await createCatch({
      species: "Flounder",
      caughtAt: "2026-08-05T15:00:00.000Z",
      placeName: "Shared flat",
      photoPath: "shared.jpg",
      anglerId: pat.id,
    });
    const samCatch = await createCatch({
      species: "Sheepshead",
      caughtAt: "2026-08-06T15:00:00.000Z",
      placeName: "Sam's dock",
      photoPath: "shared.jpg",
      anglerId: sam.id,
    });
    await createCalendarNote(sam.id, { day: "2026-08-06", notes: "Sam's note" });
    await setRecordShares({
      kind: "catch",
      recordId: sharedCatch.id,
      ownerId: pat.id,
      buddyIds: [sam.id],
    });
    expect([...(await recordIdsSharedWith("catch", sam.id))]).toContain(sharedCatch.id);

    const removed = await deleteJournalAccount({
      anglerId: pat.id,
      password: "password1",
      confirm: " DELETE ",
    });
    expect(removed).toEqual({ ok: true });

    expect(await getAngler(pat.id)).toBeNull();
    expect(await getCatch(patCatch.id)).toBeNull();
    expect(await getCatch(sharedCatch.id)).toBeNull();
    expect(await getBaitSpot(patBait.id)).toBeNull();
    expect(await listCalendarNotes(pat.id)).toEqual([]);
    expect(await listSavedNamedAreas(pat.id)).toEqual([]);
    expect(await listBuddies(sam.id)).toEqual([]);
    expect([...(await recordIdsSharedWith("catch", sam.id))]).not.toContain(sharedCatch.id);

    expect(await getCatch(samCatch.id)).not.toBeNull();
    expect((await listCatches({ viewerId: sam.id })).map((row) => row.id)).toEqual([samCatch.id]);
    expect((await listCalendarNotes(sam.id)).map((row) => row.notes)).toEqual(["Sam's note"]);
    expect((await listSavedNamedAreas(sam.id)).map((row) => row.name)).toContain("Sam's dock");

    const uploads = process.env.UPLOADS_DIR!;
    expect(fs.existsSync(path.join(uploads, "owner.jpg"))).toBe(false);
    expect(fs.existsSync(path.join(uploads, "bait.jpg"))).toBe(false);
    expect(fs.existsSync(path.join(uploads, "note.jpg"))).toBe(false);
    expect(fs.existsSync(path.join(uploads, "shared.jpg"))).toBe(true);
    expect(fs.existsSync(outside)).toBe(true);
    expect(deleteUploadedPhotoFile("/seed/redfish.svg")).toBe(false);
    expect(deleteUploadedPhotoFile("https://example.com/fish.jpg")).toBe(false);

    const again = await loginJournal({ email: "pat@gulf.com", password: "password1", ip: "1.1.1.1" });
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error).toBe(AUTH_WRONG);

    const recreated = await registerJournal({
      name: "Pat",
      email: "pat@gulf.com",
      password: "password1",
      confirm: "password1",
    });
    expect(recreated.ok).toBe(true);
    if (!recreated.ok) return;
    expect(recreated.angler.id).not.toBe(pat.id);
    expect(await listCatches({ viewerId: recreated.angler.id })).toEqual([]);
  });

  it("signs the user out from the API even when the subscription is expired", async () => {
    freshJournal();
    const pat = await register("Pat", "pat@gulf.com", "password1");
    await createCatch({
      species: "Redfish",
      caughtAt: "2026-08-02T15:00:00.000Z",
      anglerId: pat.id,
    });
    await setStoredSubscription(pat.id, { status: "expired", subscriptionExpiresAt: "2020-01-01T00:00:00.000Z" });
    const token = signSession(pat.id);

    const denied = await POST(sessionRequest(null, { password: "password1", confirm: DELETE_ACCOUNT_PHRASE }));
    expect(denied.status).toBe(401);

    const kept = await POST(sessionRequest(token, { password: "wrong-password", confirm: DELETE_ACCOUNT_PHRASE }));
    expect(kept.status).toBe(401);
    expect(await kept.json()).toMatchObject({ error: "Password is wrong." });
    expect(await getAngler(pat.id)).not.toBeNull();

    const res = await POST(sessionRequest(token, { password: "password1", confirm: "delete" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, signedIn: false });
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((line) => line.startsWith(`${SESSION_COOKIE}=`) && /Max-Age=0/i.test(line))).toBe(true);
    expect(await getAngler(pat.id)).toBeNull();
    expect(await requireViewerId(sessionRequest(token, {}))).toBeNull();
  });

  it("clears the on-device journal cache", async () => {
    useOfflineBackend(memoryOfflineBackend());
    await saveQueuedLog({
      id: "pending-1",
      createdAt: "2026-08-02T15:00:00.000Z",
      payload: { species: "Redfish" },
      photoName: null,
      photoType: null,
      hasPhotoBlob: false,
      serverPhotoPath: null,
      status: "queued",
      needsConditions: false,
      viewerId: "pat",
    });
    await writeJournalCache({
      viewerId: "pat",
      catches: [],
      baitSpots: [],
      notes: [],
      cachedAt: "2026-08-02T15:00:00.000Z",
    });
    await writeCachedSession({
      signedIn: true,
      me: { id: "pat" },
      entitlement: null,
      cachedAt: "2026-08-02T15:00:00.000Z",
    });
    await clearOfflineAccountCache();
    expect(await listQueuedLogs()).toEqual([]);
    expect(await readJournalCache()).toBeNull();
    expect(await readCachedSession()).toBeNull();
  });

  it("keeps deletion on Home and off the paywall", () => {
    expect(JOURNAL_FREE_FOR_RELEASE).toBe(true);
    expect(DELETE_ACCOUNT_PHRASE).toBe("DELETE");
    const home = fs.readFileSync(resolve(__dirname, "../components/HomeClient.tsx"), "utf8");
    const ui = fs.readFileSync(resolve(__dirname, "../components/DeleteAccount.tsx"), "utf8");
    const route = fs.readFileSync(resolve(__dirname, "../app/api/auth/delete/route.ts"), "utf8");
    expect(home).toContain("<DeleteAccount />");
    expect(home).toContain('idPrefix="delete-account-more"');
    expect(home).toContain("JOURNAL_FREE_FOR_RELEASE");
    expect(ui).toContain("Delete account");
    expect(ui).toContain("Delete my account");
    expect(ui).toContain('router.replace("/signin")');
    expect(ui).toContain("DELETE_ACCOUNT_PHRASE");
    expect(route).toContain("requireViewerId");
    expect(route).toContain("clearAuthCookies");
    expect(route).not.toContain("requireUnlockedViewer");
  });
});

function sessionRequest(token: string | null, body: unknown) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  return new NextRequest("http://localhost/api/auth/delete", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
