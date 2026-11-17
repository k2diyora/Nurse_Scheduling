import { apiFetch } from "../services/api";

describe("api service helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("sends JSON headers without auth token", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const result = await apiFetch("/health");

    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  test("adds bearer token and merges custom headers", async () => {
    localStorage.setItem("token", "abc-token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: 1 }),
    });

    await apiFetch("/secure", {
      method: "POST",
      headers: { "X-Test": "yes" },
      body: JSON.stringify({ a: 1 }),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/secure",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer abc-token",
          "X-Test": "yes",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  test("throws fallback message when response is not ok and error json is absent", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error("not-json");
      },
    });

    await expect(apiFetch("/bad")).rejects.toThrow("Something went wrong");
  });

  test("throws server-provided error message", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "nope" }),
    });

    await expect(apiFetch("/bad")).rejects.toThrow("nope");
  });
});
