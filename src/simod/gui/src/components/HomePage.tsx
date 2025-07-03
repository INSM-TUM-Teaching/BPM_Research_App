import { useState, useRef } from "react";
import { Stack, Box, Typography, CircularProgress } from "@mui/material";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

function HomePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State to hold the selected file
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // State for loading indicator
  const [isLoading, setIsLoading] = useState(false);
  // State for upload status messages
  const [uploadStatus, setUploadStatus] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Handler for when the hidden file input changes
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus(null); // Clear previous status messages
    }
  };

  // Handler to trigger the hidden file input
  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  // Handler to upload the file to the backend
  const handleFileUpload = async () => {
    if (!selectedFile) {
      setUploadStatus({ message: 'Please select a file first.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch("http://localhost:8000/api/event-log/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'File upload failed');
      }

      const result = await response.json();
      setUploadStatus({ message: `Success: ${result.message}`, type: 'success' });

      // On successful upload, navigate to the event log filtering page
      navigate("/eventlog");

    } catch (error: any) {
      setUploadStatus({ message: `Error: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <div>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          p={2}
        >
          <Stack spacing={4} alignItems="center" width="100%" maxWidth="600px">
            <Typography variant="h3" component="h1" textAlign="center">
             SIMOD GUI
            </Typography>

            {/* --- Event Log Upload Section --- */}
            <Box
              border={1}
              borderColor="grey.300"
              borderRadius={2}
              p={3}
              width="100%"
              textAlign="center"
            >
              <Typography variant="h5" component="h2" gutterBottom>
                Start by Uploading an Event Log
              </Typography>

              {/* Hidden file input, triggered by the button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept=".csv,.csv.gz"
              />

              <Stack direction="row" spacing={2} justifyContent="center" alignItems="center">
                <Button
                  variant="outlined"
                  onClick={handleSelectFileClick}
                  disabled={isLoading}
                >
                  Select Event Log
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleFileUpload}
                  disabled={!selectedFile || isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                >
                  {isLoading ? 'Uploading...' : 'Upload and Continue'}
                </Button>
              </Stack>

              {selectedFile && (
                <Typography variant="body1" mt={2} color="text.secondary">
                  Selected: <strong>{selectedFile.name}</strong>
                </Typography>
              )}

              {uploadStatus && (
                <Typography
                  variant="body2"
                  mt={2}
                  color={uploadStatus.type === 'error' ? 'error.main' : 'success.main'}
                >
                  {uploadStatus.message}
                </Typography>
              )}
            </Box>
          </Stack>
        </Box>
      </div>
    </div>
  );
}

export default HomePage;