import { afterEach, describe, expect, it, vi } from "vitest";
import { GMAIL_SMTP_HOST, GMAIL_SMTP_PORT, sendEmail, type MailTransport, type SmtpConfig } from "./email";

const message = { to: "angler@example.com", subject: "Hi", text: "Body" };
const configured = { GMAIL_USER: "sender@example.com", GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop" };

function mockTransport(impl?: MailTransport["sendMail"]) {
  const sendMail = vi.fn(impl ?? (async () => ({ messageId: "<msg_1@example.com>", rejected: [] })));
  const createTransport = vi.fn((config: SmtpConfig): MailTransport => (void config, { sendMail }));
  return { sendMail, createTransport };
}

describe("sendEmail (Gmail SMTP)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a clear error and sends nothing when GMAIL_APP_PASSWORD is missing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createTransport, sendMail } = mockTransport();
    const result = await sendEmail(message, { env: { GMAIL_USER: "sender@example.com" }, createTransport });
    expect(result).toEqual({ ok: false, reason: "not-configured" });
    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(String(error.mock.calls[0]?.[0])).toContain("GMAIL_APP_PASSWORD is not set");
  });

  it("requires GMAIL_USER too (no built-in default sender)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createTransport } = mockTransport();
    const result = await sendEmail(message, { env: { GMAIL_APP_PASSWORD: "x" }, createTransport });
    expect(result).toEqual({ ok: false, reason: "not-configured" });
    expect(createTransport).not.toHaveBeenCalled();
    expect(String(error.mock.calls[0]?.[0])).toContain("GMAIL_USER is not set");

    error.mockClear();
    await sendEmail(message, { env: {}, createTransport });
    expect(String(error.mock.calls[0]?.[0])).toContain("GMAIL_USER and GMAIL_APP_PASSWORD are not set");
  });

  it("sends through smtp.gmail.com:465 over TLS with the app password and Tide Mark <GMAIL_USER>", async () => {
    const { createTransport, sendMail } = mockTransport();
    const result = await sendEmail(message, { env: configured, createTransport });
    expect(result).toEqual({ ok: true, id: "<msg_1@example.com>" });
    expect(createTransport).toHaveBeenCalledWith({
      host: GMAIL_SMTP_HOST,
      port: GMAIL_SMTP_PORT,
      secure: true,
      auth: { user: "sender@example.com", pass: "abcdefghijklmnop" },
    });
    expect(GMAIL_SMTP_HOST).toBe("smtp.gmail.com");
    expect(GMAIL_SMTP_PORT).toBe(465);
    expect(sendMail).toHaveBeenCalledWith({
      from: "Tide Mark <sender@example.com>",
      to: "angler@example.com",
      subject: "Hi",
      text: "Body",
    });
  });

  it("uses MAIL_FROM when set", async () => {
    const { createTransport, sendMail } = mockTransport();
    await sendEmail(message, {
      env: { ...configured, MAIL_FROM: "Tide Mark Help <sender@example.com>" },
      createTransport,
    });
    expect(sendMail.mock.calls[0]?.[0].from).toBe("Tide Mark Help <sender@example.com>");
  });

  it("reports SMTP and network errors without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = mockTransport(async () => {
      throw Object.assign(new Error("Invalid login: 535 Username and Password not accepted"), { code: "EAUTH" });
    });
    expect(await sendEmail(message, { env: configured, createTransport: auth.createTransport })).toMatchObject({
      ok: false,
      reason: "rejected",
    });

    const offline = mockTransport(async () => {
      throw Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
    });
    expect(await sendEmail(message, { env: configured, createTransport: offline.createTransport })).toMatchObject({
      ok: false,
      reason: "network",
    });

    const refused = mockTransport(async () => ({ messageId: "<x@example.com>", rejected: ["angler@example.com"] }));
    expect(await sendEmail(message, { env: configured, createTransport: refused.createTransport })).toMatchObject({
      ok: false,
      reason: "rejected",
    });
  });
});
