import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_COMP_ACCOUNT_EMAILS, compAccountEmails, isCompAccountEmail } from "./plan-comp";

describe("Plan comp accounts", () => {
  const previous = process.env.COMP_ACCOUNT_EMAILS;

  afterEach(() => {
    if (previous === undefined) delete process.env.COMP_ACCOUNT_EMAILS;
    else process.env.COMP_ACCOUNT_EMAILS = previous;
  });

  it("defaults to the owner accounts and leaves the App Review demo off the list", () => {
    delete process.env.COMP_ACCOUNT_EMAILS;
    expect(compAccountEmails()).toEqual(["johndavidheard2002@gmail.com", "jd@southtexascharters.com"]);
    expect(DEFAULT_COMP_ACCOUNT_EMAILS).not.toContain("app-review-demo@example.com");
    expect(isCompAccountEmail("Jd@southtexascharters.com")).toBe(true);
    expect(isCompAccountEmail("  JohnDavidHeard2002@gmail.com ")).toBe(true);
    expect(isCompAccountEmail("app-review-demo@example.com")).toBe(false);
    expect(isCompAccountEmail(null)).toBe(false);
  });

  it("replaces the default when COMP_ACCOUNT_EMAILS is set", () => {
    process.env.COMP_ACCOUNT_EMAILS = "mate@example.com, Jd@southtexascharters.com";
    expect(compAccountEmails()).toEqual(["mate@example.com", "jd@southtexascharters.com"]);
    expect(isCompAccountEmail("johndavidheard2002@gmail.com")).toBe(false);
    expect(isCompAccountEmail("MATE@example.com")).toBe(true);
    process.env.COMP_ACCOUNT_EMAILS = "   ";
    expect(compAccountEmails()).toEqual([...DEFAULT_COMP_ACCOUNT_EMAILS]);
  });
});
