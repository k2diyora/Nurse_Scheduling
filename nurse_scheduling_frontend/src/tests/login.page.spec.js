import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Login from "../pages/Login";

const mockedNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockedNavigate,
  }),
  { virtual: true },
);

jest.mock("../utils/auth", () => ({
  login: jest.fn(),
  registerUser: jest.fn(),
}));

const { login, registerUser } = require("../utils/auth");

describe("Login page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows validation when fields are missing", async () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Please fill in all fields")).toBeTruthy();
  });

  test("shows mismatch error in register mode", async () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "New user? Register here" }));

    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "jane@x.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Password"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "secret2" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("Passwords do not match")).toBeTruthy();
  });

  test("navigates to nurse dashboard on successful nurse login", async () => {
    login.mockResolvedValue(true);
    render(<Login />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "nurse@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("nurse", "nurse@example.com", "secret123");
    });
    expect(mockedNavigate).toHaveBeenCalledWith("/nurse");
  });

  test("shows registration success message", async () => {
    registerUser.mockReturnValue(true);
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "New user? Register here" }));

    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "jane@x.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Password"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "secret1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("Registration successful. Please login.", {}, { timeout: 2500 })).toBeTruthy();
  });

  test("shows existing-user error when registration fails", async () => {
    registerUser.mockReturnValue(false);
    render(<Login />);

    fireEvent.click(screen.getByRole("button", { name: "New user? Register here" }));
    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "jane@x.com" },
    });
    fireEvent.change(screen.getByLabelText("Create Password"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "secret1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText("User already exists with this email", {}, { timeout: 2500 })).toBeTruthy();
  });

  test("shows invalid credentials error on failed login", async () => {
    login.mockResolvedValue(false);
    render(<Login />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "nurse@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Invalid email or password. Please try again.", {}, { timeout: 2500 })).toBeTruthy();
  });

  test("navigates to admin dashboard on successful admin login", async () => {
    login.mockResolvedValue(true);
    render(<Login />);

    fireEvent.mouseDown(screen.getByLabelText("Select Role"));
    fireEvent.click(screen.getByRole("option", { name: "Administrator" }));
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("admin", "admin@example.com", "secret123");
    }, { timeout: 2500 });
    expect(mockedNavigate).toHaveBeenCalledWith("/admin");
  });

  test("supports enter key submit and password visibility toggle", async () => {
    login.mockResolvedValue(true);
    render(<Login />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "nurse@example.com" },
    });
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput.getAttribute("type")).toBe("password");
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text");

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.keyDown(screen.getByLabelText("Email Address"), { key: "Enter" });

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("nurse", "nurse@example.com", "secret123");
    });
  });

  test("does not submit on non-Enter keypress", async () => {
    login.mockResolvedValue(true);
    render(<Login />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "nurse@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });

    fireEvent.keyDown(screen.getByLabelText("Email Address"), { key: "A" });
    await waitFor(() => {
      expect(login).not.toHaveBeenCalled();
    });
  });

  test("toggle affects confirm password type in register mode", async () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "New user? Register here" }));

    expect(screen.getByLabelText("Confirm Password").getAttribute("type")).toBe("password");
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByLabelText("Confirm Password").getAttribute("type")).toBe("text");
  });


  test("closes alert using close button", async () => {
    login.mockResolvedValue(false);
    render(<Login />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "nurse@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    const message = await screen.findByText("Invalid email or password. Please try again.", {}, { timeout: 2500 });
    expect(message).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.queryByText("Invalid email or password. Please try again.")).toBeNull();
    });
  });

  test("shows generic error when login throws", async () => {
    login.mockRejectedValue(new Error("network"));
    render(<Login />);

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "nurse@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Something went wrong. Please try again.", {}, { timeout: 2500 })).toBeTruthy();
  });

});
