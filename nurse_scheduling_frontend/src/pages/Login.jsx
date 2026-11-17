import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Email,
  LocalHospital,
  Lock,
  Person,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import { login, registerUser } from "../utils/auth";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState("nurse");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async () => {
    if (
      !email ||
      !password ||
      (isRegister && (!firstName || !lastName || !confirmPassword))
    ) {
      setError("Please fill in all fields");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (isRegister) {
        const success = registerUser({
          firstName,
          lastName,
          email,
          password,
          confirmPassword,
          role,
        });

        if (!success) {
          setError("User already exists with this email");
          setLoading(false);
          return;
        }

        // Reset fields after successful registration
        setIsRegister(false);
        setFirstName("");
        setLastName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setError("Registration successful. Please login.");
        setLoading(false);
        return;
      }

      const success = await login(role, email, password);

      if (!success) {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
        return;
      }

      if (role === "admin") {
        navigate("/admin");
      } else if (role === "nurse") {
        navigate("/nurse");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        p: 2,
      }}
    >
      <Card
        sx={{
          minWidth: 400,
          maxWidth: 450,
          borderRadius: 3,
          boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
        }}
        elevation={0}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                margin: "0 auto",
                backgroundColor: "primary.main",
                mb: 2,
              }}
            >
              <LocalHospital sx={{ fontSize: 32 }} />
            </Avatar>

            <Typography variant="h4" fontWeight={600} color="primary.main">
              MedCare
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Healthcare Management System
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }}>
            <Chip
              label={isRegister ? "Register" : "Login"}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Divider>

          {/* Role Selection */}
          <FormControl fullWidth sx={{ mb: 2.5 }}>
            <TextField
              select
              label="Select Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color="action" />
                  </InputAdornment>
                ),
              }}
            >
              <MenuItem value="nurse">Nurse</MenuItem>
              <MenuItem value="admin">Administrator</MenuItem>
            </TextField>
          </FormControl>

          {!isRegister && role === "nurse" && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Default Nurse Login
              </Typography>
              <Typography variant="body2">
                Email format: firstname.lastname@nurse.internal
              </Typography>
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary", fontStyle: "italic", mb: 0.5 }}
              >
                Example: jane.doe@nurse.internal
              </Typography>
              <Typography variant="body2">
                Password: nursepass
              </Typography>
            </Alert>
          )}

          {/* Register Fields */}
          {isRegister && (
            <>
              <TextField
                label="First Name"
                fullWidth
                sx={{ mb: 2 }}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />

              <TextField
                label="Last Name"
                fullWidth
                sx={{ mb: 2 }}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </>
          )}

          {/* Email */}
          <TextField
            label="Email Address"
            fullWidth
            sx={{ mb: 2.5 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyPress}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email color="action" />
                </InputAdornment>
              ),
            }}
          />

          {/* Password */}
          <TextField
            label={isRegister ? "Create Password" : "Password"}
            type={showPassword ? "text" : "password"}
            fullWidth
            sx={{ mb: 2 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyPress}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock color="action" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Confirm Password */}
          {isRegister && (
            <TextField
              label="Confirm Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              sx={{ mb: 2 }}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
              }}
            />
          )}

          {/* Error / Success Message */}
          {error && (
            <Alert
              severity={
                error === "Registration successful. Please login."
                  ? "success"
                  : "error"
              }
              sx={{ mt: 2, borderRadius: 2 }}
              onClose={() => setError("")}
            >
              {error}
            </Alert>
          )}

          {/* Button */}
          <Button
            variant="contained"
            fullWidth
            size="large"
            sx={{
              mt: 3,
              mb: 2,
              py: 1.5,
              borderRadius: 2,
              textTransform: "none",
              fontSize: "1.1rem",
              fontWeight: 600,
            }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                {isRegister ? "Registering..." : "Signing In..."}
              </>
            ) : isRegister ? (
              "Register"
            ) : (
              "Sign In"
            )}
          </Button>

          {/* Footer */}
          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Button
              variant="text"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
            >
              {isRegister
                ? "Already have an account? Login"
                : "New user? Register here"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}