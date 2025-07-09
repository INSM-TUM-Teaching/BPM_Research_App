// src/components/LoadingScreen.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircularProgress, Typography, Box } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import axios from "axios";

const LoadingScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Initializing...");

  useEffect(() => {
    const clearTop3Results = async () => { 
      try {
        // Step 1: DELETE to clear previous results
        const response = await axios.delete<{ message: string }>("http://localhost:8000/top-3-results/");
        if (response.data.message === "Top-3 results have been reset.") {
          setMessage("Generating Candidate BPMNs and Extracting Three Results");

          // Step 2: Start polling
          const interval = setInterval(async () => {
            try {
              const res = await axios.get<{ message?: string; results?: any[] }>("http://localhost:8000/top-3-results/");
              if (res.data.message !== "No results have been received yet.") {
                // Stop polling when actual results are available
                clearInterval(interval);

                // Update loading to false to show success message and icon
                setLoading(false);
                setMessage("Three results extracted successfully!");

                // Step 3: Redirect after short delay
                setTimeout(() => {
                  navigate("/top-3-results");
                }, 2000);
              }
            } catch (error) {
              console.error("Polling error:", error);
            }
          }, 2000); // Poll every 2 seconds
        }
      } catch (error) {
        setMessage("Error clearing previous state. Please try again.");
        setLoading(false); // also stop loading if error
        console.error("DELETE error:", error);
      }
    };

    clearTop3Results();
  }, [navigate]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      height="100vh"
      bgcolor="#fff"
    >
      {/* Show loading spinner and message when loading */}
      {loading ? (
        <>
          <CircularProgress size={60} sx={{ color: "#1976d2", mb: 4 }} />
          <Typography variant="h6" align="center" color="textPrimary">
            {message}
          </Typography>
        </>
      ) : (
        // Show green check icon and green success message when loading complete
        <>
          <CheckCircleIcon style={{ color: "green", fontSize: 40, marginBottom: 16 }} />
          <Typography variant="h6" align="center" style={{ color: "green" }}>
            {message}
          </Typography>
        </>
      )}
    </Box>
  );
};

export default LoadingScreen;
