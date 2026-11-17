import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock(
  "react-router-dom",
  () => ({
    BrowserRouter: ({ children }) => <div>{children}</div>,
    Routes: ({ children }) => <div>{children}</div>,
    Route: ({ element }) => element,
  }),
  { virtual: true },
);

jest.mock("../pages/Login", () => () => <div>Login Page</div>);
jest.mock("../pages/NurseDashboard", () => () => <div>Nurse Dashboard</div>);
jest.mock("../pages/AdminDashboard", () => () => <div>Admin Dashboard</div>);
jest.mock("../pages/AccountSettings", () => () => <div>Settings Page</div>);
jest.mock("../components/ProtectedRoute", () => ({ children }) => children);

import App from "../App";

describe("App", () => {
  test("renders root route content", () => {
    render(<App />);
    expect(screen.getByText("Login Page")).toBeTruthy();
  });
});
