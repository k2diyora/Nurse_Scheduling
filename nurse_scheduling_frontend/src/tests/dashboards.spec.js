import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
const mockedNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    Navigate: () => <div>Redirected</div>,
    useNavigate: () => mockedNavigate,
  }),
  { virtual: true },
);

jest.mock("../utils/auth", () => ({
  getRole: jest.fn(),
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
}));

jest.mock("../services/apiservices", () => ({
  mockDataService: {
    getRequests: jest.fn(),
    getUsersByRole: jest.fn(),
    getShifts: jest.fn(),
    updateNurse: jest.fn(),
    createNurse: jest.fn(),
    deleteNurse: jest.fn(),
    updateRequest: jest.fn(),
    createRequest: jest.fn(),
    deleteRequest: jest.fn(),
  },
}));

import ProtectedRoute from "../components/ProtectedRoute";
import AdminDashboard from "../pages/AdminDashboard";

const { getRole, getCurrentUser } = require("../utils/auth");
const { mockDataService } = require("../services/apiservices");

describe("dashboard and route behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataService.getRequests.mockResolvedValue([]);
    mockDataService.getUsersByRole.mockResolvedValue([]);
    mockDataService.getShifts.mockResolvedValue([]);
  });

  test("ProtectedRoute redirects when role is missing", () => {
    getRole.mockReturnValue(null);

    render(
      <ProtectedRoute role="admin">
        <div>Secret</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Redirected")).toBeTruthy();
    expect(screen.queryByText("Secret")).toBeNull();
  });

  test("ProtectedRoute renders children with expected role", () => {
    getRole.mockReturnValue("admin");

    render(
      <ProtectedRoute role="admin">
        <div>Secret</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("Secret")).toBeTruthy();
  });

  test("AdminDashboard renders primary tabs", async () => {
    getCurrentUser.mockReturnValue({ name: "Admin User", role: "admin" });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(mockDataService.getRequests).toHaveBeenCalled();
    });

    expect(screen.getByRole("tab", { name: "Nurses" })).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Active Requests" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Scheduled Requests" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Completed Requests" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Cancelled Requests" }),
    ).toBeTruthy();
  });
});
