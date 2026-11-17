const BASE_URL =
  process.env.REACT_APP_API_BASE_URL?.trim() || "/api";

export const DEFAULT_NURSE_PASSWORD = "nursepass";

// ── Login ────────────────────────────────────────────────────────────────────

export const login = async (role, email, password) => {
  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });

    if (!response.ok) return false;

    const data = await response.json();
  // Response is flat: { token, email, firstName, lastName, role, message }
    sessionStorage.setItem("token", data.token);
    const mustChangePassword =
      data.role === "nurse" && password === DEFAULT_NURSE_PASSWORD;

    sessionStorage.setItem(
      "current_user",
      JSON.stringify({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        name: `${data.firstName} ${data.lastName}`,
        mustChangePassword,
      }),
    );

    return data.role === role;
  } catch (error) {
    console.error("Login failed:", error);
    return false;
  }
};

// ── Register ─────────────────────────────────────────────────────────────────

export const signup = async (user) => {
  try {
    const response = await fetch(`${BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: user.password,
        confirmPassword: user.confirmPassword ?? user.password,
        role: user.role,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Signup failed:", err);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Signup error:", error);
    return false;
  }
};

// registerUser was a localStorage duplicate of signup — now just calls signup
export const registerUser = signup;

// ── Session helpers ───────────────────────────────────────────────────────────

export const getCurrentUser = () => {
  const user = sessionStorage.getItem("current_user");
  return user ? JSON.parse(user) : null;
};

export const getRole = () => {
  const user = getCurrentUser();
  return user ? user.role : null;
};

export const getToken = () => sessionStorage.getItem("token");

export const logout = () => {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("current_user");
};

export const clearMustChangePassword = () => {
  const user = getCurrentUser();
  if (!user) return;

  sessionStorage.setItem(
    "current_user",
    JSON.stringify({
      ...user,
      mustChangePassword: false,
    }),
  );
};

// ── Update Account ─────────────────────────────────────────────────────────────

export const updateAccount = async (currentPassword, newPassword = "", newEmail = "") => {
  const token = sessionStorage.getItem("token");
  if (!token) {
    return { success: false, error: "Session expired or invalid" };
  }

  try {
    const body = { currentPassword };
    if (newPassword) body.newPassword = newPassword;
    if (newEmail) body.newEmail = newEmail;

    const response = await fetch(`${BASE_URL}/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || "Failed to update account" };
    }

    // If email changes, the backend returns a new token
    if (data.token) {
      sessionStorage.setItem("token", data.token);
    }

    // Update session storage details if email changed
    if (newEmail) {
      const user = getCurrentUser();
      if (user) {
        user.email = newEmail;
        sessionStorage.setItem("current_user", JSON.stringify(user));
      }
    }

    return { success: true, message: data.message };
  } catch (error) {
    console.error("Update account failed:", error);
    return { success: false, error: "Network or server error" };
  }
};