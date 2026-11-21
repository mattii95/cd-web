import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTurnstileEnv, TURNSTILE_TEST_KEYS } from "@/lib/security/env";
import { verifyTurnstile } from "@/lib/security/turnstile";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("verifyTurnstile", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("true con success y manda secret, response y remoteip", async () => {
    fetchMock.mockResolvedValue(json({ success: true }));
    expect(await verifyTurnstile("tok", "1.2.3.4")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("tok");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it("con IP local no manda remoteip", async () => {
    fetchMock.mockResolvedValue(json({ success: true }));
    await verifyTurnstile("tok", "local");
    expect((fetchMock.mock.calls[0][1].body as URLSearchParams).has("remoteip")).toBe(false);
  });

  it("false con token vacío, sin llamar a fetch", async () => {
    expect(await verifyTurnstile("", "1.2.3.4")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("false con success false", async () => {
    fetchMock.mockResolvedValue(json({ success: false }));
    expect(await verifyTurnstile("tok", "local")).toBe(false);
  });

  it("false con status 500", async () => {
    fetchMock.mockResolvedValue(json({ success: true }, 500));
    expect(await verifyTurnstile("tok", "local")).toBe(false);
  });

  it("false si fetch lanza", async () => {
    fetchMock.mockRejectedValue(new Error("red"));
    expect(await verifyTurnstile("tok", "local")).toBe(false);
  });

  it("false con timeout", async () => {
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    expect(await verifyTurnstile("tok", "local")).toBe(false);
  });
});

describe("getTurnstileEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sin claves y en test usa las claves de prueba", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(getTurnstileEnv()).toEqual(TURNSTILE_TEST_KEYS);
  });

  it("sin claves y en producción lanza nombrando las dos variables", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(() => getTurnstileEnv()).toThrow(
      /NEXT_PUBLIC_TURNSTILE_SITE_KEY.*TURNSTILE_SECRET_KEY/,
    );
  });
});
