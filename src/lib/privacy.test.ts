import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_STORE_PRIVACY_PATH } from "./native-app";
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_INTRO,
  PRIVACY_PATH,
  PRIVACY_SECTIONS,
} from "./privacy";

describe("privacy policy", () => {
  it("covers the App Store topics on the public /privacy page", () => {
    expect(PRIVACY_PATH).toBe("/privacy");
    expect(PRIVACY_PATH).toBe(APP_STORE_PRIVACY_PATH);
    expect(PRIVACY_INTRO.toLowerCase()).toContain("private saltwater logbook");
    expect(PRIVACY_CONTACT_EMAIL).toMatch(/@/);
    const ids = PRIVACY_SECTIONS.map((section) => section.id);
    expect(ids).toEqual(["account", "photos", "location", "sharing", "hosting", "deletion"]);
    const text = PRIVACY_SECTIONS.map((section) => `${section.title} ${section.paragraphs.join(" ")}`).join(" ");
    expect(text).toMatch(/account email/i);
    expect(text).toMatch(/catch photos/i);
    expect(text).toMatch(/location pins/i);
    expect(text).toMatch(/linked friends/i);
    expect(text).toMatch(/Render/);
    expect(text).toMatch(/Turso/);
    expect(text).toMatch(/delete/i);
    expect(text).toContain(PRIVACY_CONTACT_EMAIL);
  });

  it("links Help, sign-in, and Home More to /privacy", () => {
    const help = readFileSync(resolve(__dirname, "../components/HelpGuide.tsx"), "utf8");
    const auth = readFileSync(resolve(__dirname, "../components/AuthForm.tsx"), "utf8");
    const home = readFileSync(resolve(__dirname, "../components/HomeClient.tsx"), "utf8");
    expect(help).toContain("help-privacy");
    expect(help).toContain("PRIVACY_PATH");
    expect(auth).toContain("signin-privacy");
    expect(auth).toContain("PRIVACY_PATH");
    expect(home).toContain("home-privacy");
    expect(home).toContain('href="/privacy"');
  });
});
