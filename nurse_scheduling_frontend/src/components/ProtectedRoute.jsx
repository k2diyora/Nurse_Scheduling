import { Navigate } from "react-router-dom";
import { getRole } from "../utils/auth";

export default function ProtectedRoute({ role, children }) {
  const userRole = getRole();
  if (!userRole || (role && userRole !== role)) {
    return <Navigate to="/" />;
  }
  return children;
}
