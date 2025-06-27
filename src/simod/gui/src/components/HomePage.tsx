import { Stack } from "@mui/material";
import Button from "@mui/material/Button";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";

function HomePage() {
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <div>
        <h1 style={{ textAlign: "center" }}>Home Page</h1>
        <Stack
          direction="row"
          spacing={2}
          justifyContent="center"
        >
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/editor")} // Navigate to /editor
          >
            Go to Editor
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/eventlog")} // Navigate to /eventlog
          >
            Go to Event Log
          </Button>
                    <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/top-3-results")} // Navigate to /best-bpmns
          >
            Go to Best BPMNs
          </Button>
        </Stack>
      </div>
    </div>
  );
}
export default HomePage;