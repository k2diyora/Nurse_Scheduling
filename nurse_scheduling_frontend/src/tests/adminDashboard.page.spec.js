import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mockedNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockedNavigate,
  }),
  { virtual: true },
);

jest.mock("../utils/auth", () => ({
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
}));

jest.mock("../services/apiservices", () => ({
  mockDataService: {
    getRequests: jest.fn(),
    getUsersByRole: jest.fn(),
    getShifts: jest.fn(),
    createNurse: jest.fn(),
    updateNurse: jest.fn(),
    deleteNurse: jest.fn(),
    createRequest: jest.fn(),
    updateRequest: jest.fn(),
    deleteRequest: jest.fn(),
  },
}));

import AdminDashboard from "../pages/AdminDashboard";

const { getCurrentUser, logout } = require("../utils/auth");
const { mockDataService } = require("../services/apiservices");

const sampleRequests = [
  {
    ID: 1,
    patient_id: 100,
    patient_first_name: "Ava",
    patient_last_name: "Stone",
    required_skills: ["IV"],
    shift_date: "2025-02-05T09:00:00.000Z",
    duration: 2,
    status: "PENDING",
  },
  {
    ID: 2,
    patient_id: 101,
    patient_first_name: "Mia",
    patient_last_name: "Ray",
    required_skills: ["Wound Care"],
    shift_date: "2025-02-06T09:00:00.000Z",
    duration: 3,
    status: "COMPLETED",
  },
  {
    ID: 3,
    patient_id: 102,
    patient_first_name: "Noah",
    patient_last_name: "Lee",
    required_skills: ["ICU"],
    shift_date: "2025-02-07T09:00:00.000Z",
    duration: 1,
    status: "CANCELED",
  },
];

const sampleNurses = [
  { id: 7, name: "Nurse Joy", skills: ["IV"], available: true },
  { ID: 8, name: "Nurse Hope", skills: ["ICU"], available: false },
];

const sampleShifts = [
  {
    ID: 11,
    nurse_id: 7,
    request_id: 1,
    start_date_time: "2025-02-05T09:00:00.000Z",
    end_date_time: "2025-02-05T11:00:00.000Z",
  },
  {
    ID: 12,
    nurse_id: 99,
    request_id: 999,
    start_date_time: "2025-02-08T09:00:00.000Z",
    end_date_time: "2025-02-08T12:00:00.000Z",
  },
];

describe("AdminDashboard page", () => {
  let consoleErrorSpy;
  let fetchSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    jest.clearAllMocks();
    getCurrentUser.mockReturnValue({ name: "Admin User", role: "admin" });
    mockDataService.getRequests.mockResolvedValue(sampleRequests);
    mockDataService.getUsersByRole.mockResolvedValue(sampleNurses);
    mockDataService.getShifts.mockResolvedValue(sampleShifts);
    mockDataService.createNurse.mockResolvedValue({});
    mockDataService.updateNurse.mockResolvedValue({});
    mockDataService.deleteNurse.mockResolvedValue({});
    mockDataService.createRequest.mockResolvedValue({});
    mockDataService.updateRequest.mockResolvedValue({});
    mockDataService.deleteRequest.mockResolvedValue({});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    fetchSpy.mockRestore();
  });

  test("redirects to login when user is missing", () => {
    getCurrentUser.mockReturnValue(null);
    render(<AdminDashboard />);
    expect(mockedNavigate).toHaveBeenCalledWith("/");
  });

  test("redirects to login when role is not admin", () => {
    getCurrentUser.mockReturnValue({ name: "Nurse", role: "nurse" });
    render(<AdminDashboard />);
    expect(mockedNavigate).toHaveBeenCalledWith("/");
  });

  test("shows active/completed/cancelled filters in separate tabs", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getRequests).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Active Requests" }));
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.queryByText("#2")).toBeNull();
    expect(screen.queryByText("#3")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Completed Requests" }));
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.queryByText("#1")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Cancelled Requests" }));
    expect(screen.getByText("#3")).toBeTruthy();
    expect(screen.getByText("Couldn\'t complete the request")).toBeTruthy();
  });

  test("shows assigned requests tab with nurse and fallback labels", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getShifts).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Scheduled Requests" }));

    expect(screen.getByText("Nurse Joy")).toBeTruthy();
    expect(screen.getByText("Unassigned nurse")).toBeTruthy();
    expect(screen.getByText("Request #999")).toBeTruthy();
  });

  test("can create a nurse from the nurse dialog", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getUsersByRole).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Nurse" }));
    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "New Nurse" },
    });
    fireEvent.change(screen.getByLabelText("Skills (comma separated)"), {
      target: { value: "ICU,  Pediatrics" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockDataService.createNurse).toHaveBeenCalledWith({
        name: "New Nurse",
        skills: ["ICU", "Pediatrics"],
      });
    });
  });

  test("can create request and convert form values", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getRequests).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Active Requests" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Request" }));

    fireEvent.change(screen.getByLabelText("Patient ID"), {
      target: { value: "300" },
    });
    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "Zoe" },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: "Kim" },
    });
    fireEvent.change(screen.getByLabelText("Required Skills"), {
      target: { value: "IV, ICU" },
    });
    fireEvent.change(screen.getByLabelText("Shift Date & Time"), {
      target: { value: "2025-03-01T11:30" },
    });
    fireEvent.change(screen.getByLabelText("Duration (hrs)"), {
      target: { value: "4" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockDataService.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: 300,
          patient_first_name: "Zoe",
          patient_last_name: "Kim",
          required_skills: ["IV", "ICU"],
          duration: 4,
          shift_date: expect.any(String),
        }),
      );
    });
  });

  test("opens logout dialog and confirms logout", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    const dialog = screen.getByRole("dialog");
    const logoutButtons = within(dialog).getAllByRole("button", {
      name: "Logout",
    });
    fireEvent.click(logoutButtons[0]);

    expect(logout).toHaveBeenCalled();
    expect(mockedNavigate).toHaveBeenCalledWith("/");
  });

  test("request dialog can be dismissed via cancel and escape", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getRequests).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Active Requests" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Request" }));

    const requestDialog = screen.getByRole("dialog");
    expect(within(requestDialog).getByText("New Nursing Request")).toBeTruthy();

    fireEvent.keyDown(requestDialog, { key: "Escape", code: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("New Nursing Request")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Request" }));
    const reopenedDialog = screen.getByRole("dialog");
    fireEvent.click(within(reopenedDialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("New Nursing Request")).toBeNull();
    });
  });

  test("logout dialog can be closed with cancel", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("Confirm Logout")).toBeNull();
    });
  });

  test("sort toggles are clickable in active and scheduled tabs", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getRequests).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Active Requests" }));
    fireEvent.click(screen.getByText(/Date & Time/));

    fireEvent.click(screen.getByRole("tab", { name: "Scheduled Requests" }));
    fireEvent.click(screen.getByText(/Timing/));
  });

  test("supports settings navigation", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getRequests).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(mockedNavigate).toHaveBeenCalledWith("/settings");
  });

  test("handles data fetch failure gracefully", async () => {
    mockDataService.getRequests.mockRejectedValueOnce(new Error("boom"));
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to fetch data:", expect.any(Error));
    });
  });

  test("can edit and delete nurse, including confirm false and error paths", async () => {
    const confirmSpy = jest.spyOn(window, "confirm");
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getUsersByRole).toHaveBeenCalled();
    });

    const nurseRow = await screen.findByText("Nurse Joy");
    const nurseRowActions = within(nurseRow.closest("tr")).getAllByRole("button");

    fireEvent.click(nurseRowActions[0]);
    expect(await screen.findByText("Edit Nurse")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Skills (comma separated)"), {
      target: { value: "ICU, ER" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockDataService.updateNurse).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ skills: ["ICU", "ER"] }),
      );
    });

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(nurseRowActions[1]);
    expect(mockDataService.deleteNurse).not.toHaveBeenCalled();

    mockDataService.deleteNurse.mockRejectedValueOnce(new Error("delete-fail"));
    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(nurseRowActions[1]);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to delete nurse:", expect.any(Error));
    });

    confirmSpy.mockReturnValueOnce(true);
    mockDataService.deleteNurse.mockResolvedValueOnce({});
    fireEvent.click(nurseRowActions[1]);
    await waitFor(() => {
      expect(mockDataService.deleteNurse).toHaveBeenCalled();
      expect(mockDataService.getRequests.mock.calls.length).toBeGreaterThan(1);
    });
    confirmSpy.mockRestore();
  });

  test("can edit and delete requests, including save and delete failures", async () => {
    const confirmSpy = jest.spyOn(window, "confirm");
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getRequests).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Active Requests" }));

    const requestRow = await screen.findByText("#1");
    const requestActions = within(requestRow.closest("tr")).getAllByRole("button");

    fireEvent.click(requestActions[0]);
    expect(await screen.findByText("Edit Request")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Duration (hrs)"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockDataService.updateRequest).toHaveBeenCalled();
    });

    mockDataService.updateRequest.mockRejectedValueOnce(new Error("update-fail"));
    fireEvent.click(requestActions[0]);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to save request:", expect.any(Error));
    });

    confirmSpy.mockReturnValueOnce(false);
  fireEvent.click(requestActions[1]);
    expect(mockDataService.deleteRequest).not.toHaveBeenCalled();

    mockDataService.deleteRequest.mockRejectedValueOnce(new Error("delete-request-fail"));
    confirmSpy.mockReturnValueOnce(true);
    await act(async () => {
      fireEvent.click(requestActions[1]);
    });
    await waitFor(() => {
      expect(mockDataService.deleteRequest).toHaveBeenCalled();
    });

    confirmSpy.mockReturnValueOnce(true);
    mockDataService.deleteRequest.mockResolvedValueOnce({});
    fireEvent.click(requestActions[1]);
    await waitFor(() => {
      expect(mockDataService.deleteRequest).toHaveBeenCalled();
      expect(mockDataService.getRequests.mock.calls.length).toBeGreaterThan(1);
    });
    confirmSpy.mockRestore();
  });

  test("opens and closes nurse and credentials dialogs", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getUsersByRole).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Nurse" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Add New Nurse")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Nurse" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Add New Nurse")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Nurse" }));
    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Single" },
    });
    fireEvent.change(screen.getByLabelText("Skills (comma separated)"), {
      target: { value: "ICU" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Nurse Created Successfully!")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Nurse Created Successfully!")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Nurse" }));
    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Second Nurse" },
    });
    fireEvent.change(screen.getByLabelText("Skills (comma separated)"), {
      target: { value: "ICU" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Nurse Created Successfully!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => {
      expect(screen.queryByText("Nurse Created Successfully!")).toBeNull();
    });
  });

  test("refresh countdown triggers periodic data refresh", async () => {
    jest.useFakeTimers();

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getRequests).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(31000);
    });

    await waitFor(() => {
      expect(mockDataService.getRequests.mock.calls.length).toBeGreaterThan(1);
    });

    jest.useRealTimers();
  });

  test("renders empty states when refresh payloads are not arrays", async () => {
    mockDataService.getRequests.mockResolvedValueOnce({ bad: true });
    mockDataService.getUsersByRole.mockResolvedValueOnce("not-an-array");
    mockDataService.getShifts.mockResolvedValueOnce(null);

    render(<AdminDashboard />);

    expect(await screen.findByText("No nurses found.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Active Requests" }));
    expect(await screen.findByText("No active requests found.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Scheduled Requests" }));
    expect(await screen.findByText("No shifts scheduled yet.")).toBeTruthy();
  });

  test("handles nurse save errors and default register names", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("register-failed"));
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getUsersByRole).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Nurse" }));
    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Error Nurse" },
    });
    fireEvent.change(screen.getByLabelText("Skills (comma separated)"), {
      target: { value: "ICU" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to save nurse:", expect.any(Error));
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Add New Nurse")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Nurse" }));
    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Skills (comma separated)"), {
      target: { value: "ICU" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockDataService.createNurse).toHaveBeenCalled();
    });

    const registerCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/register"),
    );
    const registerCall = registerCalls[registerCalls.length - 1];
    expect(registerCall).toBeTruthy();
    expect(JSON.parse(registerCall[1].body)).toEqual(
      expect.objectContaining({
        firstName: "Nurse",
        lastName: "Staff",
      }),
    );
  });

  test("covers id and patient-name fallbacks across tabs", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

    mockDataService.getRequests.mockResolvedValueOnce([
      {
        id: 55,
        patient_id: 900,
        patient_first_name: "",
        patient_last_name: "",
        required_skills: "ER",
        shift_date: "invalid-date",
        duration: 2,
      },
      {
        id: 58,
        patient_id: 903,
        patient_first_name: "Valid",
        patient_last_name: "Date",
        required_skills: "IV",
        shift_date: "2025-02-11T09:00:00.000Z",
        duration: 2,
        status: "PENDING",
      },
      {
        id: 59,
        patient_id: 904,
        patient_first_name: "Mix",
        patient_last_name: "Order",
        required_skills: "Wound Care",
        shift_date: "2025-02-13T09:00:00.000Z",
        duration: 3,
        status: "PENDING",
      },
      {
        id: 56,
        patient_id: 901,
        patient_first_name: "Done",
        patient_last_name: "Case",
        required_skills: "IV",
        shift_date: "2025-02-09T09:00:00.000Z",
        duration: 1,
        status: "completed",
      },
      {
        id: 57,
        patient_id: 902,
        patient_first_name: "",
        patient_last_name: "",
        required_skills: "ICU",
        shift_date: "2025-02-10T09:00:00.000Z",
        duration: 1,
        status: "canceled",
      },
    ]);

    mockDataService.getUsersByRole.mockResolvedValueOnce([
      { id: "x-1", name: "Nurse Lower", skills: ["ER"], available: true },
      { ID: 8, name: "Nurse Upper", skills: ["ICU"], available: false },
      { name: "No Id Nurse", skills: ["Ward"], available: true },
    ]);

    mockDataService.getShifts.mockResolvedValueOnce([
      {
        id: "s-1",
        nurse_id: "x-1",
        request_id: 55,
        start_date_time: "invalid-date",
        end_date_time: "invalid-date",
      },
      {
        id: "s-2",
        nurse_id: "",
        request_id: 58,
        start_date_time: "2025-02-12T09:00:00.000Z",
        end_date_time: "2025-02-12T11:00:00.000Z",
      },
      {
        id: "s-3",
        request_id: 59,
        start_date_time: "2025-02-13T09:00:00.000Z",
        end_date_time: "2025-02-13T12:00:00.000Z",
      },
    ]);

    render(<AdminDashboard />);

    fireEvent.click(await screen.findByRole("tab", { name: "Active Requests" }));
    expect(await screen.findByText("#55")).toBeTruthy();
    expect(screen.getByText("Patient #900")).toBeTruthy();
    fireEvent.click(screen.getByText(/Date & Time/));
    fireEvent.click(screen.getByText(/Date & Time/));

    const activeRow = await screen.findByText("#55");
    const activeActions = within(activeRow.closest("tr")).getAllByRole("button");
    fireEvent.click(activeActions[1]);
    expect(mockDataService.deleteRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Completed Requests" }));
    expect(await screen.findByText("#56")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Cancelled Requests" }));
    expect(await screen.findByText("#57")).toBeTruthy();
    expect(screen.getByText("Patient #902")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Scheduled Requests" }));
    expect(await screen.findByText("Nurse Lower")).toBeTruthy();
    expect(screen.getAllByText("No Id Nurse").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/Timing/));
    fireEvent.click(screen.getByText(/Timing/));

    fireEvent.click(screen.getByRole("tab", { name: "Nurses" }));
    const idOnlyNurse = await screen.findByText("Nurse Upper");
    const idOnlyNurseActions = within(idOnlyNurse.closest("tr")).getAllByRole("button");
    fireEvent.click(idOnlyNurseActions[1]);
    expect(mockDataService.deleteNurse).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});