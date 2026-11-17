import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountSettings from "../pages/AccountSettings";

const mockedNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockedNavigate,
  }),
  { virtual: true },
);

jest.mock("../utils/auth", () => ({
  updateAccount: jest.fn(),
}));

const { updateAccount } = require("../utils/auth");

describe("AccountSettings page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows validation for missing current password", async () => {
    render(<AccountSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Current Password is required")).toBeTruthy();
  });

  test("shows validation for missing updates", async () => {
    render(<AccountSettings />);
    fireEvent.change(screen.getAllByLabelText(/password/i)[0], {
      target: { value: "oldpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Provide a new Password, new Email, or both")).toBeTruthy();
  });

  test("shows validation for short password", async () => {
    render(<AccountSettings />);
    fireEvent.change(screen.getAllByLabelText(/password/i)[0], {
      target: { value: "oldpass" },
    });
    fireEvent.change(screen.getAllByLabelText(/password/i)[1], {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("New password must be at least 6 characters")).toBeTruthy();
  });

  test("submits and shows success message", async () => {
    updateAccount.mockResolvedValue({ success: true, message: "updated" });
    render(<AccountSettings />);

    fireEvent.change(screen.getAllByLabelText(/password/i)[0], {
      target: { value: "oldpass" },
    });
    fireEvent.change(screen.getAllByLabelText(/password/i)[1], {
      target: { value: "newpass123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith("oldpass", "newpass123", "");
    });
    expect(await screen.findByText("updated")).toBeTruthy();
  });

  test("submits email-only update and passes new email", async () => {
    updateAccount.mockResolvedValue({ success: true, message: "updated" });
    render(<AccountSettings />);

    fireEvent.change(screen.getAllByLabelText(/current password/i)[0], {
      target: { value: "oldpass" },
    });
    fireEvent.change(screen.getAllByLabelText(/new email/i)[0], {
      target: { value: "new@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith("oldpass", "", "new@example.com");
    });
  });

  test("shows fallback error when backend error is missing", async () => {
    updateAccount.mockResolvedValue({ success: false });
    render(<AccountSettings />);

    fireEvent.change(screen.getAllByLabelText(/current password/i)[0], {
      target: { value: "oldpass" },
    });
    fireEvent.change(screen.getAllByLabelText(/new password/i)[0], {
      target: { value: "newpass123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Failed to update account")).toBeTruthy();
  });

  test("shows default success message when backend omits message", async () => {
    updateAccount.mockResolvedValue({ success: true });
    render(<AccountSettings />);

    fireEvent.change(screen.getAllByLabelText(/password/i)[0], {
      target: { value: "oldpass" },
    });
    fireEvent.change(screen.getAllByLabelText(/password/i)[1], {
      target: { value: "newpass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Account updated successfully")).toBeTruthy();
  });

  test("back button navigates to previous page", () => {
    render(<AccountSettings />);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(mockedNavigate).toHaveBeenCalledWith(-1);
  });
});
