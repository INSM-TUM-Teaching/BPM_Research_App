import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircularProgress, Typography, Box } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

const ResourceModelLoading = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Resource Model Optimization");
  const [dots, setDots] = useState('');

  // Animated dots effect
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  useEffect(() => {
    const checkPipelineCompletion = async () => {
      const maxAttempts = 150; // 5 minutes at 2-second intervals
      let attempt = 0;

      while (attempt < maxAttempts && loading) {
        try {
          const pipelineResponse = await fetch("http://localhost:8000/pipeline/status");
          const pipelineData = await pipelineResponse.json();
          
          if (pipelineData?.completed) {
            // Pipeline is complete
            setLoading(false);
            setMessage("Resource Model Optimization completed successfully!");
            
            // Navigate to results after showing success message
            setTimeout(() => {
              navigate("/results");
            }, 2000);
            return;
          }

          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempt++;
          
        } catch (error) {
          console.error("Pipeline check error:", error);
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempt++;
        }
      }

      // Timeout reached
      if (loading) {
        setLoading(false);
        setMessage("Optimization is taking longer than expected. Please check manually.");
      }
    };

    checkPipelineCompletion();
  }, [navigate, loading]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      height="100vh"
      bgcolor="#fff"
    >
      {loading ? (
        <>
          <CircularProgress size={60} sx={{ color: "#1976d2", mb: 4 }} />
          <Typography variant="h6" align="center" color="textPrimary">
            {message}{dots}
          </Typography>
        </>
      ) : (
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

export default ResourceModelLoading;
