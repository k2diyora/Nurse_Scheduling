import {
  clearMustChangePassword,
  getCurrentUser,
  getRole,
  getToken,
  login,
  logout,
  signup,
  updateAccount,
} from "../utils/auth";

describe("auth utility", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.restoreAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("login stores token and user on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "jwt-token",
        email: "nurse@example.com",
        firstName: "Jane",
        lastName: "Doe",
        role: "nurse",
      }),
    });

    const success = await login("nurse", "nurse@example.com", "secret123");

    expect(success).toBe(true);
    expect(getToken()).toBe("jwt-token");
    expect(getCurrentUser()).toEqual(
      expect.objectContaining({
        email: "nurse@example.com",
        role: "nurse",
        name: "Jane Doe",
      }),
    );
  });

  test("login returns false when API rejects", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    await expect(login("admin", "admin@example.com", "bad")).resolves.toBe(
      false,
    );
  });

  test("login returns false when role does not match requested role", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "jwt-token",
        email: "admin@example.com",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
      }),
    });

    const success = await login("nurse", "admin@example.com", "secret123");
    expect(success).toBe(false);
  });

  test("login returns false on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network"));
    await expect(login("admin", "admin@example.com", "secret123")).resolves.toBe(
      false,
    );
  });

  test("signup returns true on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const ok = await signup({
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      password: "secret123",
      role: "admin",
    });
    expect(ok).toBe(true);
  });

  test("signup returns false on failed response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "duplicate" }),
    });
    await expect(
      signup({
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
        password: "secret123",
        role: "nurse",
      }),
    ).resolves.toBe(false);
  });

  test("signup returns false on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network"));
    await expect(
      signup({
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
        password: "secret123",
        role: "nurse",
      }),
    ).resolves.toBe(false);
  });

  test("session helpers work and logout clears state", () => {
    sessionStorage.setItem("token", "abc");
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({ email: "x@y.com", role: "admin" }),
    );

    expect(getToken()).toBe("abc");
    expect(getCurrentUser()).toEqual({ email: "x@y.com", role: "admin" });
    expect(getRole()).toBe("admin");

    logout();
    expect(getToken()).toBeNull();
    expect(getCurrentUser()).toBeNull();
  });

  test("getRole returns null when current user is missing", () => {
    sessionStorage.removeItem("current_user");
    expect(getRole()).toBeNull();
  });

  test("clearMustChangePassword is a no-op when user is missing", () => {
    sessionStorage.removeItem("current_user");
    clearMustChangePassword();
    expect(getCurrentUser()).toBeNull();
  });

  test("clearMustChangePassword updates current user flag", () => {
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({ email: "nurse@example.com", role: "nurse", mustChangePassword: true }),
    );

    clearMustChangePassword();

    expect(getCurrentUser()).toEqual(
      expect.objectContaining({
        email: "nurse@example.com",
        mustChangePassword: false,
      }),
    );
  });

  test("updateAccount returns token error when session is missing", async () => {
    await expect(updateAccount("old", "newpass")).resolves.toEqual(
      expect.objectContaining({ success: false }),
    );
  });

  test("updateAccount returns success and updates token/email when returned", async () => {
    sessionStorage.setItem("token", "old-token");
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({ email: "old@x.com", role: "admin" }),
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok", token: "new-token" }),
    });

    const result = await updateAccount("oldpass", "newpass", "new@x.com");
    expect(result.success).toBe(true);
    expect(getToken()).toBe("new-token");
    expect(getCurrentUser()).toEqual(
      expect.objectContaining({ email: "new@x.com" }),
    );
  });

  test("updateAccount handles failed API response", async () => {
    sessionStorage.setItem("token", "old-token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "bad current password" }),
    });

    const result = await updateAccount("wrong", "newpass");
    expect(result).toEqual(
      expect.objectContaining({ success: false, error: "bad current password" }),
    );
  });

  test("updateAccount uses default error when API response has no error field", async () => {
    sessionStorage.setItem("token", "old-token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const result = await updateAccount("wrong", "newpass");
    expect(result).toEqual(
      expect.objectContaining({ success: false, error: "Failed to update account" }),
    );
  });

  test("updateAccount succeeds without email change", async () => {
    sessionStorage.setItem("token", "old-token");
    sessionStorage.setItem(
      "current_user",
      JSON.stringify({ email: "old@x.com", role: "admin" }),
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    });

    const result = await updateAccount("oldpass", "newpass", "");
    expect(result.success).toBe(true);
    expect(getCurrentUser()).toEqual(
      expect.objectContaining({ email: "old@x.com" }),
    );
  });

  test("updateAccount can change email without new password when no user object exists", async () => {
    sessionStorage.setItem("token", "old-token");
    sessionStorage.removeItem("current_user");
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: "ok" }),
    });

    const result = await updateAccount("oldpass", "", "new@x.com");
    expect(result.success).toBe(true);
    expect(getCurrentUser()).toBeNull();
  });

  test("updateAccount supports defaults when only current password is provided", async () => {
    sessionStorage.setItem("token", "old-token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Provide newPassword, newEmail, or both" }),
    });

    const result = await updateAccount("oldpass");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Provide newPassword, newEmail, or both");
  });

  test("updateAccount returns network error on exception", async () => {
    sessionStorage.setItem("token", "old-token");
    global.fetch = jest.fn().mockRejectedValue(new Error("network"));
    const result = await updateAccount("old", "newpass");
    expect(result).toEqual(
      expect.objectContaining({ success: false, error: "Network or server error" }),
    );
  });
});
