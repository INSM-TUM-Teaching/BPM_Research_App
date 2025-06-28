import React, { useEffect, useState, useRef } from "react";
import Viewer from "bpmn-js/lib/Viewer";
import { useNavigate } from "react-router-dom";
import { 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Typography,
  Button,
  Box,
  Card,
  Chip,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  CircularProgress,
  Alert,
  Tooltip,
} from "@mui/material";
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import StarIcon from '@mui/icons-material/Star';
import CloseIcon from '@mui/icons-material/Close';


interface BpmnResult {
  loss: number;
  status: string;
  output_dir: string;
  process_model_path: string;
  layout_bpmn_path: string;
}

const BpmnViewer: React.FC<{ filePath: string }> = ({ filePath }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const viewer = new Viewer({ container: ref.current });

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const viewer = new Viewer({ container: ref.current! });

        const filename = filePath.replace(/\\/g, '/');  
        console.log("Fetching BPMN:", filename);

        // Try to load from server - this assumes your server serves BPMN files
        const response = await fetch(`http://localhost:8000/api/bpmn/${filename}`);
        if (!response.ok) {

          throw new Error(`Failed to load BPMN file: ${response.status}`);
        }
        
        const { bpmn_xml } = await response.json();
        await viewer.importXML(bpmn_xml);
        
        const canvas = viewer.get("canvas") as any;
        canvas.zoom("fit-viewport");
      } catch (err) {
        console.error("BPMN load failed:", err);
        setError(`Failed to load BPMN: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => viewer.destroy();
  }, [filePath]);

  return (
    <div>
      <div ref={ref} style={{ height: 500, width: '100%', background: "#f8f8f8" }} />
      {loading && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </div>
  );
};

const BestBpmns: React.FC = () => {
  const [results, setResults] = useState<BpmnResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBpmn, setSelectedBpmn] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    
    fetch("http://localhost:8000/top-3-results/")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`API request failed with status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.results && Array.isArray(data.results)) {
          setResults(data.results);
        } else {
          setError("Received invalid data format from the server");
        }
      })
      .catch((err) => {
        console.error("Failed to load top 3 results:", err);
        setError(`Failed to load results: ${err.message}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handlePreview = (path: string) => {
    const cleanPath = path
      .replace(/^static[\\/]+best_bpmns[\\/]+/, "")  // 
      .replace(/\\/g, "/");                          // 
    setSelectedBpmn(cleanPath);
    setPreviewOpen(true);
  };
  const handleDoubleClickBpmn = () => {
    if (selectedBpmn) {
      navigate(`/bpmn/${encodeURIComponent(selectedBpmn)}`);
    }
  };
  const handleClosePreview = () => {
    setPreviewOpen(false);
  };

  const formatPath = (path: string) => {
    const parts = path.split('\\');
    // Get the last 3 parts or fewer if the path is shorter
    return parts.slice(Math.max(0, parts.length - 3)).join('\\');
  };

  const getStatusChip = (status: string) => {
    if (status.toLowerCase() === "ok") {
      return <Chip icon={<CheckCircleIcon />} label="OK" color="success" size="small" />;
    }
    return <Chip icon={<ErrorIcon />} label={status} color="error" size="small" />;
  };

  const getBestIndicator = (index: number) => {
    if (index === 0) {
      return <Tooltip title="Best model (lowest loss)"><Chip icon={<StarIcon />} label="Best" color="primary" size="small" /></Tooltip>;
    }
    return null;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading top 3 BPMN models...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <StarIcon sx={{ mr: 1, color: '#FFD700' }} /> 
        Top 3 BPMN Models
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        The table below shows the top 3 BPMN models ranked by their loss value. Lower loss indicates a better model fit.
      </Typography>
      
      <Card sx={{ mb: 4 }}>
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell width="5%"><Typography variant="subtitle2">Rank</Typography></TableCell>
                <TableCell width="12%"><Typography variant="subtitle2">Loss</Typography></TableCell>
                <TableCell width="10%"><Typography variant="subtitle2">Status</Typography></TableCell>
                <TableCell width="58%"><Typography variant="subtitle2">Model Path</Typography></TableCell>
                <TableCell width="15%"><Typography variant="subtitle2">Actions</Typography></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result, index) => (
                <TableRow 
                  key={index} 
                  hover 
                  sx={{ 
                    '&:nth-of-type(odd)': { backgroundColor: '#fafafa' },
                    '&:hover': { backgroundColor: '#f0f7ff' }
                  }}
                >
                  <TableCell>
                    <Typography variant="body1" fontWeight={index === 0 ? 'bold' : 'normal'}>
                      #{index + 1} {getBestIndicator(index)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1" fontWeight={index === 0 ? 'bold' : 'normal'}>
                      {result.loss.toFixed(4)}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(result.status)}</TableCell>
                  <TableCell>
                    <Tooltip title={result.process_model_path}>
                      <Typography variant="body2" sx={{ 
                        maxWidth: '100%', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }}>
                        {formatPath(result.process_model_path)}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handlePreview(result.layout_bpmn_path)}
                      >
                        Preview
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      
      {/* BPMN Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">BPMN Model Preview</Typography>
          <IconButton onClick={handleClosePreview}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent 
          sx={{ p: 0 }} 
          onDoubleClick={handleDoubleClickBpmn}
          style={{ cursor: 'zoom-in' }}
        >
          {selectedBpmn && <BpmnViewer filePath={selectedBpmn} />}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={handleClosePreview}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BestBpmns;