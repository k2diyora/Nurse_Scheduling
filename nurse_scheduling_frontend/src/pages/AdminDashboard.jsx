import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LogoutDialog from "../components/LogoutDialog";
import { mockDataService } from "../services/apiservices";
import { getCurrentUser, logout } from "../utils/auth";

import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  Add,
  CancelOutlined,
  Delete,
  Edit,
  ExitToApp,
  CheckCircleOutline,
  LocalHospital,
  People,
  Schedule,
  Settings,
} from "@mui/icons-material";

// ── Light-blue palette constants ─────────────────────────────────────────────
const BLUE_MAIN = "#0288d1"; // AppBar
const BLUE_DARK = "#01579b"; // Tab band
const BLUE_LIGHT = "#e1f5fe"; // Table header bg
const BLUE_AVATAR = "#0288d1"; // Avatar bg (nurses)
const TEAL_AVATAR = "#00838f"; // Avatar bg (patients / shifts)
const SHIFTS_REFRESH_INTERVAL_SECONDS = 30;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL?.trim() || "/api";

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [requests, setRequests] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const [nurseDialogOpen, setNurseDialogOpen] = useState(false);
  const [editingNurse, setEditingNurse] = useState(null);
  const [nurseFormData, setNurseFormData] = useState({ name: "", skills: "" });

  const [openCredentialsDialog, setOpenCredentialsDialog] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  // Request Dialog State
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [requestSortAsc, setRequestSortAsc] = useState(false);
  const [shiftSortAsc, setShiftSortAsc] = useState(false);
  const [lastShiftsUpdated, setLastShiftsUpdated] = useState(null);
  const lastShiftsUpdatedLabel = "local time";
  const [shiftsRefreshCountdown, setShiftsRefreshCountdown] = useState(
    SHIFTS_REFRESH_INTERVAL_SECONDS,
  );
  const [requestFormData, setRequestFormData] = useState({
    patient_id: "",
    patient_first_name: "",
    patient_last_name: "",
    required_skills: "",
    shift_date: "",
    duration: "",
  });

  const navigate = useNavigate();

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqData, nurseData, shiftData] = await Promise.all([
        mockDataService.getRequests(),
        mockDataService.getUsersByRole("nurse"),
        mockDataService.getShifts(),
      ]);
      setRequests(Array.isArray(reqData) ? reqData : []);
      setNurses(Array.isArray(nurseData) ? nurseData : []);
      setShifts(Array.isArray(shiftData) ? shiftData : []);
      setLastShiftsUpdated(new Date());
      setShiftsRefreshCountdown(SHIFTS_REFRESH_INTERVAL_SECONDS);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      navigate("/");
      return;
    }
    setUser(currentUser);
    refreshData();
  }, [navigate, refreshData]);

  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => {
      setShiftsRefreshCountdown((prev) => {
        if (prev <= 1) {
          refreshData();
          return SHIFTS_REFRESH_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [user, refreshData]);

  const handleLogoutConfirm = () => {
    logout();
    navigate("/");
  };
  const handleTabChange = (_, v) => setTabValue(v);

  // ── Nurse Handlers ────────────────────────────────────────────────────────
  const handleOpenNurseDialog = (nurse = null) => {
    if (nurse) {
      setEditingNurse(nurse);
      setNurseFormData({
        name: nurse.name,
        skills: Array.isArray(nurse.skills)
          ? nurse.skills.join(", ")
          : nurse.skills || "",
      });
    } else {
      setEditingNurse(null);
      setNurseFormData({ name: "", skills: "" });
    }
    setNurseDialogOpen(true);
  };

  const handleSaveNurse = async () => {
    const payload = {
      ...nurseFormData,
      skills: nurseFormData.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (editingNurse) {
        await mockDataService.updateNurse(
          editingNurse.id || editingNurse.ID,
          payload,
        );
      } else {
        const firstName = nurseFormData.name.split(" ")[0] || "Nurse";
        const lastName =
          nurseFormData.name.split(" ").slice(1).join(" ") || "Staff";
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@nurse.internal`;
        const password = "nursepass";

        await fetch(`${API_BASE_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            password,
            confirmPassword: password,
            role: "nurse",
          }),
        });

        await mockDataService.createNurse(payload);
        setCreatedCredentials({ email, password });
        setOpenCredentialsDialog(true);
      }
      refreshData();
      setNurseDialogOpen(false);
    } catch (err) {
      console.error("Failed to save nurse:", err);
    }
  };

  const handleDeleteNurse = async (id) => {
    if (!window.confirm("Are you sure you want to delete this nurse?")) return;
    try {
      await mockDataService.deleteNurse(id);
      refreshData();
    } catch (err) {
      console.error("Failed to delete nurse:", err);
    }
  };

  // ── Request Handlers ──────────────────────────────────────────────────────
  const handleOpenRequestDialog = (req = null) => {
    if (req) {
      setEditingRequest(req);
      setRequestFormData({
        patient_id: req.patient_id,
        patient_first_name: req.patient_first_name,
        patient_last_name: req.patient_last_name,
        required_skills: Array.isArray(req.required_skills)
          ? req.required_skills.join(", ")
          : req.required_skills || "",
        shift_date: req.shift_date
          ? new Date(req.shift_date).toISOString().slice(0, 16)
          : "",
        duration: req.duration,
      });
    } else {
      setEditingRequest(null);
      setRequestFormData({
        patient_id: "",
        patient_first_name: "",
        patient_last_name: "",
        required_skills: "",
        shift_date: "",
        duration: "",
      });
    }
    setRequestDialogOpen(true);
  };

  const handleSaveRequest = async () => {
    const payload = {
      ...requestFormData,
      patient_id: parseInt(requestFormData.patient_id),
      duration: parseInt(requestFormData.duration),
      required_skills: requestFormData.required_skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      shift_date: new Date(requestFormData.shift_date).toISOString(),
    };
    try {
      editingRequest
        ? await mockDataService.updateRequest(
            editingRequest.ID || editingRequest.id,
            payload,
          )
        : await mockDataService.createRequest(payload);
      refreshData();
      setRequestDialogOpen(false);
    } catch (err) {
      console.error("Failed to save request:", err);
    }
  };

  const handleDeleteRequest = async (id) => {
    if (!window.confirm("Are you sure you want to delete this request?"))
      return;
    try {
      await mockDataService.deleteRequest(id);
      refreshData();
    } catch (err) {
      console.error("Failed to delete request:", err);
    }
  };

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const dateA = new Date(a.shift_date).getTime() || 0;
      const dateB = new Date(b.shift_date).getTime() || 0;
      return requestSortAsc ? dateA - dateB : dateB - dateA;
    });
  }, [requests, requestSortAsc]);

  const sortedShifts = useMemo(() => {
    return [...shifts].sort((a, b) => {
      const dateA = new Date(a.start_date_time).getTime() || 0;
      const dateB = new Date(b.start_date_time).getTime() || 0;
      return shiftSortAsc ? dateA - dateB : dateB - dateA;
    });
  }, [shifts, shiftSortAsc]);

  const normalizeRequestStatus = (status) =>
    String(status || "").trim().toUpperCase();

  const completedRequests = useMemo(
    () =>
      sortedRequests.filter(
        (r) => normalizeRequestStatus(r.status) === "COMPLETED",
      ),
    [sortedRequests],
  );

  const cancelledRequests = useMemo(
    () =>
      sortedRequests.filter((r) => {
        const status = normalizeRequestStatus(r.status);
        return status === "CANCELLED" || status === "CANCELED";
      }),
    [sortedRequests],
  );

  const activeRequests = useMemo(
    () =>
      sortedRequests.filter((r) => {
        const status = normalizeRequestStatus(r.status);
        return status !== "COMPLETED" && status !== "CANCELLED" && status !== "CANCELED";
      }),
    [sortedRequests],
  );

  const toggleRequestSort = () => setRequestSortAsc((prev) => !prev);
  const toggleShiftSort = () => setShiftSortAsc((prev) => !prev);
  // ── Helpers ───────────────────────────────────────────────────────────────
  const getNurseName = (id) => {
    const nurse = nurses.find(
      (n) => String(n.ID ?? n.id ?? "") === String(id ?? ""),
    );
    if (!nurse) return "Unassigned nurse";

    return (
      nurse.name ||
      `${nurse.first_name || ""} ${nurse.last_name || ""}`.trim() ||
      `${nurse.firstName || ""} ${nurse.lastName || ""}`.trim() ||
      "Unnamed nurse"
    );
  };
  const getPatientName = (req) =>
    `${req.patient_first_name || ""} ${req.patient_last_name || ""}`.trim() ||
    `Patient #${req.patient_id}`;

  // Avatar with initials
  const InitialsAvatar = ({ name, bgColor }) => (
    <Avatar
      sx={{
        bgcolor: bgColor,
        width: 32,
        height: 32,
        fontSize: "0.75rem",
        fontWeight: 700,
      }}
    >
      {name?.charAt(0)?.toUpperCase() || "?"}
    </Avatar>
  );

  // Shared empty/loading states
  const LoadingRow = ({ cols }) => (
    <TableRow>
      <TableCell colSpan={cols} align="center" sx={{ py: 4 }}>
        <CircularProgress size={28} sx={{ color: BLUE_MAIN }} />
      </TableCell>
    </TableRow>
  );
  const EmptyRow = ({ cols, msg }) => (
    <TableRow>
      <TableCell colSpan={cols} align="center" sx={{ py: 3 }}>
        <Typography color="text.secondary">{msg}</Typography>
      </TableCell>
    </TableRow>
  );

  if (!user) return null;

  return (
    <Box sx={{ flexGrow: 1, minHeight: "100vh", bgcolor: "#f0f7ff" }}>
      {/* ── AppBar ── */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: BLUE_MAIN }}>
        <Toolbar>
          <LocalHospital sx={{ mr: 2 }} />
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, fontWeight: 600 }}
          >
            MedCare Admin Portal
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="subtitle2">{user.name}</Typography>
            <Button
              color="inherit"
              onClick={() => navigate("/settings")}
              startIcon={<Settings />}
            >
              Settings
            </Button>
            <Button
              color="inherit"
              onClick={() => setLogoutDialogOpen(true)}
              startIcon={<ExitToApp />}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>

        {/* ── Tab band ── */}
        <Box sx={{ bgcolor: BLUE_DARK }}>
          <Container maxWidth="lg">
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              textColor="inherit"
              TabIndicatorProps={{
                style: {
                  backgroundColor: "#80d8ff",
                  height: 3,
                  borderRadius: "3px 3px 0 0",
                },
              }}
              sx={{
                "& .MuiTab-root": {
                  minHeight: 52,
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  textTransform: "none",
                  letterSpacing: 0.3,
                  opacity: 0.72,
                  px: 3,
                  gap: 0.75,
                  "&.Mui-selected": { opacity: 1, fontWeight: 600 },
                },
              }}
            >
              <Tab
                icon={<People fontSize="small" />}
                iconPosition="start"
                label="Nurses"
              />
              <Tab
                icon={<LocalHospital fontSize="small" />}
                iconPosition="start"
                label="Active Requests"
              />
              <Tab
                icon={<Schedule fontSize="small" />}
                iconPosition="start"
                label="Scheduled Requests"
              />
              <Tab
                icon={<CheckCircleOutline fontSize="small" />}
                iconPosition="start"
                label="Completed Requests"
              />
              <Tab
                icon={<CancelOutlined fontSize="small" />}
                iconPosition="start"
                label="Cancelled Requests"
              />
            </Tabs>
          </Container>
        </Box>
      </AppBar>

      {/* ── Main Content ── */}
      <Container maxWidth="lg" sx={{ mt: 6, mb: 4 }}>
        {/* ── Nurses Tab ── */}
        {tabValue === 0 && (
          <Box>
            <Box
              sx={{
                mb: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <Box>
                <Typography
                  variant="h4"
                  color="text.primary"
                  fontWeight={700}
                  gutterBottom
                >
                  Nurse Management
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  Add, edit, and manage nurses on the platform.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenNurseDialog()}
                sx={{
                  mb: 0.5,
                  bgcolor: BLUE_MAIN,
                  "&:hover": { bgcolor: BLUE_DARK },
                }}
              >
                Add Nurse
              </Button>
            </Box>

            <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
              <CardContent sx={{ p: 0 }}>
                <TableContainer component={Paper} elevation={0}>
                  <Table sx={{ minWidth: 650 }}>
                    <TableHead sx={{ bgcolor: BLUE_LIGHT }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, color: BLUE_DARK }}>
                          Name
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: BLUE_DARK }}>
                          Skills
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: BLUE_DARK }}>
                          Status
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: 600, color: BLUE_DARK }}
                          align="right"
                        >
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <LoadingRow cols={4} />
                      ) : nurses.length === 0 ? (
                        <EmptyRow cols={4} msg="No nurses found." />
                      ) : (
                        nurses.map((n) => (
                          <TableRow key={n.id || n.ID} hover>
                            <TableCell>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2,
                                }}
                              >
                                <InitialsAvatar
                                  name={n.name}
                                  bgColor={BLUE_AVATAR}
                                />
                                <Typography
                                  variant="subtitle2"
                                  fontWeight={600}
                                >
                                  {n.name}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {Array.isArray(n.skills)
                                ? n.skills.join(", ")
                                : n.specialty || "No skills listed"}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={n.available ? "Available" : "On Shift"}
                                color={n.available ? "success" : "default"}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Edit">
                                <IconButton
                                  onClick={() => handleOpenNurseDialog(n)}
                                  size="small"
                                  sx={{ color: BLUE_MAIN }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  onClick={() =>
                                    handleDeleteNurse(n.id || n.ID)
                                  }
                                  color="error"
                                  size="small"
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* ── Active Requests Tab ── */}
        {tabValue === 1 && (
          <Box>
            <Box
              sx={{
                mb: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <Box>
                <Typography
                  variant="h4"
                  color="text.primary"
                  fontWeight={700}
                  gutterBottom
                >
                  Active Clinic Requests
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  Review and manage open and in-progress nursing requests.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => handleOpenRequestDialog()}
                sx={{
                  mb: 0.5,
                  bgcolor: BLUE_MAIN,
                  "&:hover": { bgcolor: BLUE_DARK },
                }}
              >
                Create Request
              </Button>
            </Box>

            <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
              <CardContent sx={{ p: 0 }}>
                <TableContainer component={Paper} elevation={0}>
                  <Table sx={{ minWidth: 650 }}>
                    <TableHead sx={{ bgcolor: BLUE_LIGHT }}>
                      <TableRow>
                        {[
                          "ID",
                          "Patient",
                          "Requirements",
                          "Date & Time",
                          "Duration",
                          "Status",
                          "Actions",
                        ].map((h, i) => (
                          <TableCell
                            key={h}
                            sx={{
                              fontWeight: 600,
                              color: BLUE_DARK,
                              cursor:
                                h === "Date & Time" ? "pointer" : "default",
                            }}
                            align={i === 6 ? "right" : "left"}
                            onClick={
                              h === "Date & Time"
                                ? toggleRequestSort
                                : undefined
                            }
                          >
                            {h}{" "}
                            {h === "Date & Time"
                              ? requestSortAsc
                                ? "▲"
                                : "▼"
                              : ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <LoadingRow cols={7} />
                      ) : activeRequests.length === 0 ? (
                        <EmptyRow cols={7} msg="No active requests found." />
                      ) : (
                        activeRequests.map((r) => (
                          <TableRow key={r.ID || r.id} hover>
                            <TableCell>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                #{r.ID || r.id}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2,
                                }}
                              >
                                <InitialsAvatar
                                  name={r.patient_first_name}
                                  bgColor={TEAL_AVATAR}
                                />
                                <Typography
                                  variant="subtitle2"
                                  fontWeight={600}
                                >
                                  {getPatientName(r)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {Array.isArray(r.required_skills)
                                ? r.required_skills.join(", ")
                                : r.required_skills}
                            </TableCell>
                            <TableCell>
                              {new Date(r.shift_date).toLocaleString()}
                            </TableCell>
                            <TableCell>{r.duration}h</TableCell>
                            <TableCell>
                              <Chip
                                label={r.status}
                                color={
                                  r.status === "COMPLETED"
                                    ? "success"
                                    : r.status === "PENDING"
                                      ? "warning"
                                      : "primary"
                                }
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Edit">
                                <IconButton
                                  onClick={() => handleOpenRequestDialog(r)}
                                  size="small"
                                  sx={{ color: BLUE_MAIN }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  onClick={() =>
                                    handleDeleteRequest(r.ID || r.id)
                                  }
                                  color="error"
                                  size="small"
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* ── Completed Requests Tab ── */}
        {tabValue === 3 && (
          <Box>
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h4"
                color="text.primary"
                fontWeight={700}
                gutterBottom
              >
                Completed Requests
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Historical view of completed nursing requests.
              </Typography>
            </Box>

            <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
              <CardContent sx={{ p: 0 }}>
                <TableContainer component={Paper} elevation={0}>
                  <Table sx={{ minWidth: 650 }}>
                    <TableHead sx={{ bgcolor: BLUE_LIGHT }}>
                      <TableRow>
                        {["ID", "Patient", "Requirements", "Date & Time", "Duration", "Status"].map(
                          (h) => (
                            <TableCell key={h} sx={{ fontWeight: 600, color: BLUE_DARK }}>
                              {h}
                            </TableCell>
                          ),
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <LoadingRow cols={6} />
                      ) : completedRequests.length === 0 ? (
                        <EmptyRow cols={6} msg="No completed requests found." />
                      ) : (
                        completedRequests.map((r) => (
                          <TableRow key={r.ID || r.id} hover>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                #{r.ID || r.id}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <InitialsAvatar
                                  name={r.patient_first_name}
                                  bgColor={TEAL_AVATAR}
                                />
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {getPatientName(r)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {Array.isArray(r.required_skills)
                                ? r.required_skills.join(", ")
                                : r.required_skills}
                            </TableCell>
                            <TableCell>{new Date(r.shift_date).toLocaleString()}</TableCell>
                            <TableCell>{r.duration}h</TableCell>
                            <TableCell>
                              <Chip label={r.status} color="success" size="small" />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* ── Cancelled Requests Tab ── */}
        {tabValue === 4 && (
          <Box>
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h4"
                color="text.primary"
                fontWeight={700}
                gutterBottom
              >
                Cancelled Requests
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Historical view of cancelled nursing requests.
              </Typography>
            </Box>

            <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
              <CardContent sx={{ p: 0 }}>
                <TableContainer component={Paper} elevation={0}>
                  <Table sx={{ minWidth: 650 }}>
                    <TableHead sx={{ bgcolor: BLUE_LIGHT }}>
                      <TableRow>
                        {[
                          "ID",
                          "Patient",
                          "Requirements",
                          "Date & Time",
                          "Duration",
                          "Status",
                          "Reason",
                        ].map(
                          (h) => (
                            <TableCell key={h} sx={{ fontWeight: 600, color: BLUE_DARK }}>
                              {h}
                            </TableCell>
                          ),
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <LoadingRow cols={7} />
                      ) : cancelledRequests.length === 0 ? (
                        <EmptyRow cols={7} msg="No cancelled requests found." />
                      ) : (
                        cancelledRequests.map((r) => (
                          <TableRow key={r.ID || r.id} hover>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                #{r.ID || r.id}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <InitialsAvatar
                                  name={r.patient_first_name}
                                  bgColor={TEAL_AVATAR}
                                />
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {getPatientName(r)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {Array.isArray(r.required_skills)
                                ? r.required_skills.join(", ")
                                : r.required_skills}
                            </TableCell>
                            <TableCell>{new Date(r.shift_date).toLocaleString()}</TableCell>
                            <TableCell>{r.duration}h</TableCell>
                            <TableCell>
                              <Chip label={r.status} color="error" size="small" />
                            </TableCell>
                            <TableCell>Couldn&apos;t complete the request</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* ── Shifts Tab ── */}
        {tabValue === 2 && (
          <Box>
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h4"
                color="text.primary"
                fontWeight={700}
                gutterBottom
              >
                Active & Upcoming Shifts
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Overview of all scheduled and ongoing nurse shifts.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last updated:{" "}
                {lastShiftsUpdated
                  ? `${lastShiftsUpdated.toLocaleTimeString()} (${lastShiftsUpdatedLabel}) - next refresh in ${shiftsRefreshCountdown}s`
                  : `Waiting for first refresh... (${lastShiftsUpdatedLabel}) - refresh in ${shiftsRefreshCountdown}s`}
              </Typography>
            </Box>

            <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
              <CardContent sx={{ p: 0 }}>
                <TableContainer component={Paper} elevation={0}>
                  <Table sx={{ minWidth: 650 }}>
                    <TableHead sx={{ bgcolor: BLUE_LIGHT }}>
                      <TableRow>
                        {["Nurse", "Patient", "Timing", "Duration"].map((h) => (
                          <TableCell
                            key={h}
                            sx={{
                              fontWeight: 600,
                              color: BLUE_DARK,
                              cursor: h === "Timing" ? "pointer" : "default",
                            }}
                            onClick={
                              h === "Timing" ? toggleShiftSort : undefined
                            }
                          >
                            {h}{" "}
                            {h === "Timing" ? (shiftSortAsc ? "▲" : "▼") : ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <LoadingRow cols={4} />
                      ) : shifts.length === 0 ? (
                        <EmptyRow cols={4} msg="No shifts scheduled yet." />
                      ) : (
                        sortedShifts.map((s) => {
                          const req = requests.find(
                            (r) => (r.ID || r.id) === s.request_id,
                          );
                          const nurseName = getNurseName(s.nurse_id);
                          return (
                            <TableRow key={s.ID || s.id} hover>
                              <TableCell>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 2,
                                  }}
                                >
                                  <InitialsAvatar
                                    name={nurseName}
                                    bgColor={BLUE_AVATAR}
                                  />
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight={600}
                                  >
                                    {nurseName}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                {req
                                  ? getPatientName(req)
                                  : `Request #${s.request_id}`}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {new Date(s.start_date_time).toLocaleString()}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  to{" "}
                                  {new Date(
                                    s.end_date_time,
                                  ).toLocaleTimeString()}
                                </Typography>
                              </TableCell>
                              <TableCell>{req ? req.duration : "?"}h</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}
      </Container>

      {/* ── Nurse Dialog ── */}
      <Dialog
        open={nurseDialogOpen}
        onClose={() => setNurseDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editingNurse ? "Edit Nurse" : "Add New Nurse"}
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            label="Full Name"
            sx={{ mb: 2, mt: 1 }}
            value={nurseFormData.name}
            onChange={(e) =>
              setNurseFormData({ ...nurseFormData, name: e.target.value })
            }
          />
          <TextField
            fullWidth
            label="Skills (comma separated)"
            helperText="e.g. IV, Wound Care, Pediatrics"
            value={nurseFormData.skills}
            onChange={(e) =>
              setNurseFormData({ ...nurseFormData, skills: e.target.value })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNurseDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveNurse}
            sx={{ bgcolor: BLUE_MAIN, "&:hover": { bgcolor: BLUE_DARK } }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Request Dialog ── */}
      <Dialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editingRequest ? "Edit Request" : "New Nursing Request"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Patient ID"
                type="number"
                value={requestFormData.patient_id}
                onChange={(e) =>
                  setRequestFormData({
                    ...requestFormData,
                    patient_id: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="First Name"
                value={requestFormData.patient_first_name}
                onChange={(e) =>
                  setRequestFormData({
                    ...requestFormData,
                    patient_first_name: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Last Name"
                value={requestFormData.patient_last_name}
                onChange={(e) =>
                  setRequestFormData({
                    ...requestFormData,
                    patient_last_name: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Required Skills"
                value={requestFormData.required_skills}
                onChange={(e) =>
                  setRequestFormData({
                    ...requestFormData,
                    required_skills: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid item xs={8}>
              <TextField
                fullWidth
                label="Shift Date & Time"
                type="datetime-local"
                InputLabelProps={{ shrink: true }}
                value={requestFormData.shift_date}
                onChange={(e) =>
                  setRequestFormData({
                    ...requestFormData,
                    shift_date: e.target.value,
                  })
                }
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Duration (hrs)"
                type="number"
                value={requestFormData.duration}
                onChange={(e) =>
                  setRequestFormData({
                    ...requestFormData,
                    duration: e.target.value,
                  })
                }
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveRequest}
            sx={{ bgcolor: BLUE_MAIN, "&:hover": { bgcolor: BLUE_DARK } }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Credentials Created Dialog */}
      <Dialog
        open={openCredentialsDialog}
        onClose={() => setOpenCredentialsDialog(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ color: "#0288d1", fontWeight: "bold" }}>
          Nurse Created Successfully!
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            The nurse profile and login credentials have been generated. Please
            securely share these default credentials with the nurse:
          </Typography>
          {createdCredentials && (
            <Box
              sx={{
                bgcolor: "#e1f5fe",
                p: 2,
                borderRadius: 2,
                border: "1px solid #0288d1",
              }}
            >
              <Typography variant="body2">
                <strong>Email:</strong> {createdCredentials.email}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Password:</strong> {createdCredentials.password}
              </Typography>
            </Box>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 2 }}
          >
            The nurse must change this password on their next login.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOpenCredentialsDialog(false)}
            variant="contained"
            sx={{ bgcolor: "#0288d1", "&:hover": { bgcolor: "#01579b" } }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <LogoutDialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </Box>
  );
}
