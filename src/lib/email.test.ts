import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RESEND_FROM, RESEND_API_URL, sendEmail } from "./email";

const message = { to: "angler@example.com", subject: "Hi", text: "Body" };

describe("sendEmail (Resend)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call Resend or throw when RESEND_API_KEY is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn();
    const result = await sendEmail(message, { env: {}, fetchImpl });
    expect(result).toEqual({ ok: false, reason: "not-configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("posts a plain-text email with the API key and RESEND_FROM", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    const result = await sendEmail(message, {
      env: { RESEND_API_KEY: "re_test", RESEND_FROM: "Tide Mark <no-reply@southtexascharters.com>" },
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, id: "msg_1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_API_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Tide Mark <no-reply@southtexascharters.com>",
      to: ["angler@example.com"],
      subject: "Hi",
      text: "Body",
    });
  });

  it("falls back to the default sender and reports Resend errors without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("domain not verified", { status: 403 }));
    const result = await sendEmail(message, { env: { RESEND_API_KEY: "re_test" }, fetchImpl });
    expect(result).toMatchObject({ ok: false, reason: "rejected" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).from).toBe(DEFAULT_RESEND_FROM);

    const offline = await sendEmail(message, {
      env: { RESEND_API_KEY: "re_test" },
      fetchImpl: async () => {
        throw new Error("offline");
      },
    });
    expect(offline).toEqual({ ok: false, reason: "network" });
  });
});
