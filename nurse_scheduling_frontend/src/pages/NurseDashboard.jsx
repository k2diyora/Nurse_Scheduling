import {
  ExitToApp,
  LocalHospital,
  Person,
  Settings,
} from "@mui/icons-material";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LogoutDialog from "../components/LogoutDialog";
import { mockDataService } from "../services/apiservices";
import {
  DEFAULT_NURSE_PASSWORD,
  clearMustChangePassword,
  getCurrentUser,
  logout,
  updateAccount,
} from "../utils/auth";

export default function NurseDashboard() {
  const [user, setUser] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [forcePasswordDialogOpen, setForcePasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== "nurse") {
      navigate("/");
      return;
    }
    setUser(currentUser);
    setForcePasswordDialogOpen(Boolean(currentUser.mustChangePassword));

    mockDataService
      .getClientsForNurse(currentUser)
      .then((clients) => setPatients(clients))
      .catch((err) => {
        console.error("Failed to load patients:", err);
        setPatients([]);
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogoutClick = () => setLogoutDialogOpen(true);

  const handleLogoutConfirm = () => {
    logout();
    navigate("/");
  };

  const handleForcePasswordUpdate = async () => {
    setPasswordError("");

    if (!newPassword || !confirmPassword) {
      setPasswordError("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password must match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword === DEFAULT_NURSE_PASSWORD) {
      setPasswordError(
        `Please choose a password different from ${DEFAULT_NURSE_PASSWORD}.`,
      );
      return;
    }

    setPasswordUpdateLoading(true);
    const result = await updateAccount(DEFAULT_NURSE_PASSWORD, newPassword, "");
    setPasswordUpdateLoading(false);

    if (!result.success) {
      setPasswordError(result.error || "Failed to update password.");
      return;
    }

    clearMustChangePassword();
    setUser((prev) => ({ ...prev, mustChangePassword: false }));
    setForcePasswordDialogOpen(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  if (!user) return null;

  return (
    <Box
      sx={{ flexGrow: 1, minHeight: "100vh", bgcolor: "background.default" }}
    >
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <LocalHospital sx={{ mr: 2 }} />
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, fontWeight: 600 }}
          >
            MedCare Nurse Portal
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="subtitle2">
              {user.name}
              {/* ({user.specialty}) */}
            </Typography>
            <Button
              color="inherit"
              onClick={() => navigate("/settings")}
              startIcon={<Settings />}
            >
              Settings
            </Button>
            <Button
              color="inherit"
              onClick={handleLogoutClick}
              startIcon={<ExitToApp />}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 6, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            color="text.primary"
            fontWeight={700}
            gutterBottom
          >
            Assigned Patients
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Manage care and schedules for your assigned patients.
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
          <CardContent sx={{ p: 0 }}>
            <TableContainer component={Paper} elevation={0}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead sx={{ bgcolor: "grey.50" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Patient Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Condition</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Schedule</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : patients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        <Typography color="text.secondary">
                          No patients assigned currently.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    patients.map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <Avatar
                              sx={{
                                bgcolor: "secondary.main",
                                width: 32,
                                height: 32,
                              }}
                            >
                              <Person fontSize="small" />
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2" fontWeight={600}>
                                {p.name}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>{p.condition}</TableCell>
                        <TableCell>
                          {new Date(p._raw?.shift_date).toLocaleString()}
                        </TableCell>
                        <TableCell>{p._raw?.duration}h</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        <LogoutDialog
          open={logoutDialogOpen}
          onClose={() => setLogoutDialogOpen(false)}
          onConfirm={handleLogoutConfirm}
        />

        <Dialog
          open={forcePasswordDialogOpen}
          disableEscapeKeyDown
          onClose={() => {}}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Change Password Required</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              For security, you must change the default nurse password before
              using the dashboard.
            </Typography>

            {passwordError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {passwordError}
              </Alert>
            )}

            <TextField
              fullWidth
              type="password"
              label="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button
              color="inherit"
              onClick={handleLogoutConfirm}
              disabled={passwordUpdateLoading}
            >
              Logout
            </Button>
            <Button
              variant="contained"
              onClick={handleForcePasswordUpdate}
              disabled={passwordUpdateLoading}
            >
              {passwordUpdateLoading ? "Updating..." : "Update Password"}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
