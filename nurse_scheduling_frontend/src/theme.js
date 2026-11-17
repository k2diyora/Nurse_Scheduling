import { createTheme } from "@mui/material/styles";

// Premium Healthcare Theme
const theme = createTheme({
  palette: {
    primary: {
      main: "#00A99D", // Teal-ish Green (Modern Healthcare)
      light: "#4DB6AC",
      dark: "#00796B",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#5C6BC0", // Soft Indigo
      light: "#8E99F3",
      dark: "#26418F",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F4F6F8", // Soft Grey-Blue background
      paper: "#FFFFFF",
    },
    text: {
      primary: "#2D3748", // Dark slate for better readability
      secondary: "#718096",
    },
    success: {
      main: "#48BB78",
    },
    warning: {
      main: "#ED8936",
    },
    error: {
      main: "#E53E3E",
    },
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
    h1: {
      fontWeight: 700,
      fontSize: "2.5rem",
      letterSpacing: "-0.015em",
    },
    h2: {
      fontWeight: 700,
      fontSize: "2rem",
      letterSpacing: "-0.01em",
    },
    h3: {
      fontWeight: 600,
      fontSize: "1.75rem",
    },
    h4: {
      fontWeight: 600,
      fontSize: "1.5rem",
    },
    button: {
      fontWeight: 600,
      textTransform: "none",
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          },
        },
        contained: {
          borderRadius: "50px", // Pill shaped buttons similar to modern apps
          padding: "8px 24px",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
          border: "1px solid rgba(0,0,0,0.05)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

export default theme;
