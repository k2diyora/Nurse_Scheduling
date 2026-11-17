import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import NurseDashboard from "../pages/NurseDashboard";

const mockedNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockedNavigate,
  }),
  { virtual: true },
);

jest.mock("../utils/auth", () => ({
  DEFAULT_NURSE_PASSWORD: "nursepass",
  clearMustChangePassword: jest.fn(),
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
  updateAccount: jest.fn(),
}));

jest.mock("../services/apiservices", () => ({
  mockDataService: {
    getClientsForNurse: jest.fn(),
  },
}));

const {
  clearMustChangePassword,
  getCurrentUser,
  logout,
  updateAccount,
} = require("../utils/auth");
const { mockDataService } = require("../services/apiservices");

describe("NurseDashboard page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("redirects when nurse user is missing", async () => {
    getCurrentUser.mockReturnValue(null);
    render(<NurseDashboard />);
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/");
    });
  });

  test("renders assigned patient rows", async () => {
    getCurrentUser.mockReturnValue({
      role: "nurse",
      name: "Jane Doe",
      firstName: "Jane",
    });
    mockDataService.getClientsForNurse.mockResolvedValue([
      {
        id: 1,
        name: "Patient One",
        condition: "ICU",
        _raw: { shift_date: "2026-03-01T10:00:00Z", duration: 8 },
      },
    ]);

    render(<NurseDashboard />);

    expect(await screen.findByText("Assigned Patients")).toBeTruthy();
    expect(await screen.findByText("Patient One")).toBeTruthy();
    expect(screen.getByText("ICU")).toBeTruthy();
  });

  test("shows empty state when data fetch fails", async () => {
    getCurrentUser.mockReturnValue({
      role: "nurse",
      name: "Jane Doe",
      firstName: "Jane",
    });
    mockDataService.getClientsForNurse.mockRejectedValue(new Error("boom"));

    render(<NurseDashboard />);

    expect(await screen.findByText("No patients assigned currently.")).toBeTruthy();
  });

  test("logout confirm calls auth logout and navigates home", async () => {
    getCurrentUser.mockReturnValue({
      role: "nurse",
      name: "Jane Doe",
      firstName: "Jane",
    });
    mockDataService.getClientsForNurse.mockResolvedValue([]);

    render(<NurseDashboard />);

    fireEvent.click(screen.getAllByRole("button", { name: "Logout" })[0]);
    expect(await screen.findByText("Confirm Logout")).toBeTruthy();

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Logout" }));

    expect(logout).toHaveBeenCalled();
    expect(mockedNavigate).toHaveBeenCalledWith("/");
  });

  test("logout dialog closes on cancel", async () => {
    getCurrentUser.mockReturnValue({
      role: "nurse",
      name: "Jane Doe",
      firstName: "Jane",
    });
    mockDataService.getClientsForNurse.mockResolvedValue([]);

    render(<NurseDashboard />);

    fireEvent.click(screen.getAllByRole("button", { name: "Logout" })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("Confirm Logout")).toBeNull();
    });
  });

  test("settings button navigates to settings page", async () => {
    getCurrentUser.mockReturnValue({ role: "nurse", name: "Jane Doe" });
    mockDataService.getClientsForNurse.mockResolvedValue([]);

    render(<NurseDashboard />);

    const settingsButton = await screen.findByRole("button", {
      name: "Settings",
    });
    fireEvent.click(settingsButton);
    expect(mockedNavigate).toHaveBeenCalledWith("/settings");
  });

  test("force-password dialog validates empty and mismatched values", async () => {
    getCurrentUser.mockReturnValue({
      role: "nurse",
      name: "Jane Doe",
      mustChangePassword: true,
    });
    mockDataService.getClientsForNurse.mockResolvedValue([]);

    render(<NurseDashboard />);
    expect(await screen.findByText("Change Password Required")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(await screen.findByText("Please fill in both password fields.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "abcdef" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "ghijkl" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("New password and confirm password must match.")).toBeTruthy();
  });

  test("force-password dialog validates short and default passwords", async () => {
    getCurrentUser.mockReturnValue({
      role: "nurse",
      name: "Jane Doe",
      mustChangePassword: true,
    });
    mockDataService.getClientsForNurse.mockResolvedValue([]);

    render(<NurseDashboard />);
    expect(await screen.findByText("Change Password Required")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(await screen.findByText("New password must be at least 6 characters.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "nursepass" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "nursepass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("Please choose a password different from nursepass.")).toBeTruthy();
  });

  test("force-password update failure shows fallback error", async () => {
    getCurrentUser.mockReturnValue({
      role: "nurse",
      name: "Jane Doe",
      mustChangePassword: true,
    });
    mockDataService.getClientsForNurse.mockResolvedValue([]);
    updateAccount.mockResolvedValue({ success: false });

    render(<NurseDashboard />);
    expect(await screen.findByText("Change Password Required")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "newpass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith("nursepass", "newpass123", "");
    });
    expect(await screen.findByText("Failed to update password.")).toBeTruthy();
  });

  test("force-password update success clears flag and closes dialog", async () => {
    getCurrentUser.mockReturnValue({
      role: "nurse",
      name: "Jane Doe",
      mustChangePassword: true,
    });
    mockDataService.getClientsForNurse.mockResolvedValue([]);
    updateAccount.mockResolvedValue({ success: true, message: "ok" });

    render(<NurseDashboard />);
    expect(await screen.findByText("Change Password Required")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "newpass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() => {
      expect(clearMustChangePassword).toHaveBeenCalled();
      expect(screen.queryByText("Change Password Required")).toBeNull();
    });
  });
});
