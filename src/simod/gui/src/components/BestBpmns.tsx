import React, { useEffect, useState } from "react";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
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
  CircularProgress,
  Alert,
  Tooltip,
  Collapse,
  Snackbar,
} from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import StarIcon from '@mui/icons-material/Star';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';


interface BpmnResult {
  loss: number;
  status: string;
  output_dir: string;
  process_model_path: string;
  layout_bpmn_path: string;
}

const BestBpmns: React.FC = () => {
  const [results, setResults] = useState<BpmnResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [bpmnViewers, setBpmnViewers] = useState<Map<number, any>>(new Map());
  const [bpmnLoading, setBpmnLoading] = useState<Set<number>>(new Set());
  const [bpmnErrors, setBpmnErrors] = useState<Map<number, string>>(new Map());
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [pipelineCompleted, setPipelineCompleted] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const navigate = useNavigate();

  const loadBpmnDiagram = async (filePath: string, index: number, containerId: string) => {
    try {
      // Add to loading set
      setBpmnLoading(prev => {
        const newSet = new Set(prev);
        newSet.add(index);
        return newSet;
      });
      setBpmnErrors(prev => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });

      // Clean the file path for the API call
      const cleanPath = filePath.replace(/\\/g, '/');

      // Use the layout BPMN endpoint to read existing output_ prefixed file
      const apiUrl = `http://localhost:8000/api/layout-bpmn/${encodeURIComponent(cleanPath)}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load BPMN file: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.bpmn_xml) {
        throw new Error("No BPMN XML received from server");
      }
      
      // Wait for DOM to be ready and ensure unique container
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get container and ensure it's ready
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container with id ${containerId} not found`);
      }

      // Clear any existing content in the container completely
      container.innerHTML = '';
      container.classList.add(`viewer-${index}`); // Add unique class
      
      // Ensure container is visible and properly sized
      const containerStyle = container.style;
      containerStyle.display = 'block';
      containerStyle.height = '600px';
      containerStyle.width = '100%';
      
      // Create unique viewer instance with enhanced isolation
      const viewerConfig = { 
        container,
        keyboard: {
          bindTo: container
        },
        // Enhanced config to prevent viewer conflicts
        additionalModules: [],
        moddleExtensions: {},
        // Add unique canvas id to prevent conflicts
        canvas: {
          deferUpdate: false
        }
      };

      // Create completely isolated viewer instance
      const viewer = new NavigatedViewer(viewerConfig);
      
      // Import XML with error handling
      try {
        await viewer.importXML(data.bpmn_xml);
      } catch (importErr) {
        throw new Error(`Failed to import BPMN XML: ${importErr}`);
      }
      
      // Get canvas and auto-fit to screen
      const canvas = viewer.get("canvas") as any;
      
      // Function to fit diagram to screen with error handling
      const fitToScreen = () => {
        try {
          if (canvas && canvas.zoom) {
            canvas.zoom("fit-viewport", "auto");
          }
        } catch (err) {
          try {
            if (canvas && canvas.zoom) {
              canvas.zoom(0.7); // Manual zoom out as fallback
            }
          } catch (fallbackErr) {
            // Silent fallback if both methods fail
          }
        }
      };
      
      // Apply fit-to-screen with delays to ensure proper rendering
      setTimeout(() => {
        fitToScreen();
      }, 100);
      
      setTimeout(() => {
        fitToScreen();
      }, 300);
      
      // Auto fit-to-screen when container is resized
      const resizeObserver = new ResizeObserver(() => {
        setTimeout(fitToScreen, 100);
      });
      
      resizeObserver.observe(container);
      
      // Store resize observer for cleanup
      (viewer as any)._resizeObserver = resizeObserver;
      (viewer as any)._containerId = containerId;
      (viewer as any)._index = index;
      
      // Store viewer instance
      setBpmnViewers(prev => {
        const newMap = new Map(prev);
        newMap.set(index, viewer);
        return newMap;
      });
      
    } catch (err) {
      setBpmnErrors(prev => {
        const newMap = new Map(prev);
        newMap.set(index, `Failed to load BPMN: ${err instanceof Error ? err.message : String(err)}`);
        return newMap;
      });
    } finally {
      // Remove from loading set
      setBpmnLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  const handleViewBpmn = async (path: string, index: number) => {
    const isCurrentlyExpanded = expandedRows.has(index);
    
    if (isCurrentlyExpanded) {
      // Collapsing - destroy viewer if it exists
      const viewer = bpmnViewers.get(index);
      if (viewer) {
        try {
          // Cleanup resize observer
          const resizeObserver = (viewer as any)._resizeObserver;
          if (resizeObserver) {
            resizeObserver.disconnect();
          }
          
          // Get container and clear it completely
          const containerId = (viewer as any)._containerId;
          if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
              // Remove all event listeners and clear content
              container.innerHTML = '';
              container.classList.remove(`viewer-${index}`);
              // Reset container style
              container.style.display = 'none';
            }
          }
          
          // Clear viewer instance completely
          try {
            viewer.clear();
          } catch (clearErr) {
            // Ignore clear errors
          }
          
          // Destroy viewer
          viewer.destroy();
        } catch (err) {
          // Silent error handling for cleanup
        }
        
        setBpmnViewers(prev => {
          const newMap = new Map(prev);
          newMap.delete(index);
          return newMap;
        });
      }
    }
    
    toggleRowExpansion(index);
    
    if (!isCurrentlyExpanded) {
      // Expanding - load BPMN after a short delay to ensure DOM is ready
      setTimeout(() => {
        loadBpmnDiagram(path, index, `bpmn-container-${index}`);
      }, 100);
    }
  };

  const handleSelectBpmn = async (path: string) => {
    try {
      setIsPipelineRunning(true); // Show loading UI
      const res = await fetch("http://localhost:8000/select-model/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_path: path,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server error: ${res.status} ${res.statusText} - ${errorText}`);
      }
      
      const pollCompletion = async () => {
        const maxAttempts = 60;
        let attempt = 0;

        while (attempt < maxAttempts) {
          const response = await fetch("http://localhost:8000/pipeline/status");
          const data = await response.json();

          if (data?.completed) {
            return true;
          }

          await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3s
          attempt++;
        }

        return false;
      };
      
      const result = await res.json();
      
      // Show success notification
      setNotification({
        open: true,
        message: '✅ Model selected successfully! Redirecting to homepage...',
        severity: 'success'
      });

      const completed = await pollCompletion(); 
      if (completed) {
        setPipelineCompleted(true); // ✅ Pipeline completed successfully
        requestAnimationFrame(() => {
          setTimeout(() => {
            setPipelineCompleted(false);
            setIsPipelineRunning(false);
            navigate("/"); // Redirect to homepage after 3 seconds
          }, 3000); // 3 seconds delay before redirect
        });
      
      } else {
        throw new Error("Pipeline did not complete in time.");
      }

    } catch (err) {
      // Show error notification
      setNotification({
        open: true,
        message: `❌ Failed to select model: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error'
      });
    } 
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

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
          // Sort by loss (ascending order - lower is better)
          const sortedResults = data.results.sort((a: BpmnResult, b: BpmnResult) => a.loss - b.loss);
          setResults(sortedResults);
        } else {
          setError("Received invalid data format from the server");
        }
      })
      .catch((err) => {
        setError(`Failed to load results: ${err.message}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Cleanup viewers on unmount
  useEffect(() => {
    return () => {
      // Destroy all viewers when component unmounts
      bpmnViewers.forEach((viewer, index) => {
        if (viewer) {
          try {
            // Cleanup resize observer
            const resizeObserver = (viewer as any)._resizeObserver;
            if (resizeObserver) {
              resizeObserver.disconnect();
            }
            
            // Clear container
            const containerId = (viewer as any)._containerId;
            if (containerId) {
              const container = document.getElementById(containerId);
              if (container) {
                container.innerHTML = '';
                container.classList.remove(`viewer-${index}`);
              }
            }
            
            // Clear and destroy viewer
            try {
              viewer.clear();
            } catch (clearErr) {
              // Ignore clear errors
            }
            viewer.destroy();
          } catch (err) {
            // Silent cleanup error handling
          }
        }
      });
    };
  }, []);

  const toggleRowExpansion = (index: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(index)) {
      newExpandedRows.delete(index);
    } else {
      newExpandedRows.add(index);
    }
    setExpandedRows(newExpandedRows);
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
      return <Tooltip title="Best Model Selected By Simod"><Chip icon={<StarIcon />} label="Best" color="primary" size="small" /></Tooltip>;
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
  if (isPipelineRunning) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress size={60} />
        <Typography variant="h5" sx={{ ml: 3 }}>
          {pipelineCompleted ? '✅ Successfully completed!' : 'Running pipeline... Please wait.'}
        </Typography>
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
        Click "View BPMN" to display the auto-layouted diagram inline below each row.
      </Typography>
      
      <Card sx={{ mb: 4 }}>
        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell width="5%"><Typography variant="subtitle2">Rank</Typography></TableCell>
                <TableCell width="12%"><Typography variant="subtitle2">Loss</Typography></TableCell>
                <TableCell width="10%"><Typography variant="subtitle2">Status</Typography></TableCell>
                <TableCell width="48%"><Typography variant="subtitle2">Model Path</Typography></TableCell>
                <TableCell width="25%"><Typography variant="subtitle2">Actions</Typography></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result, index) => (
                <React.Fragment key={index}>
                  <TableRow 
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
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={expandedRows.has(index) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          onClick={() => {
                            handleViewBpmn(result.process_model_path, index);
                          }}
                        >
                          {expandedRows.has(index) ? 'Hide' : 'View'} BPMN
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            handleSelectBpmn(result.process_model_path);
                          }}
                        >
                          Select BPMN
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                  
                  {/* Inline BPMN Diagram Row */}
                  <TableRow>
                    <TableCell colSpan={5} sx={{ p: 0 }}>
                      <Collapse in={expandedRows.has(index)} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, backgroundColor: '#f8f9fa', borderTop: '1px solid #dee2e6' }}>
                          <Typography variant="h6" gutterBottom>
                            BPMN Diagram - Model #{index + 1}
                            {index === 0 && (
                              <Chip 
                                icon={<StarIcon />} 
                                label="Best Model" 
                                color="primary" 
                                size="small" 
                                sx={{ ml: 2 }} 
                              />
                            )}
                            <Chip 
                              label="Auto-Layouted" 
                              color="success" 
                              size="small" 
                              sx={{ ml: 1 }} 
                              variant="outlined"
                            />
                          </Typography>
                          <Paper elevation={2} sx={{ p: 1, backgroundColor: 'white' }}>
                            {bpmnLoading.has(index) && (
                              <Box sx={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                height: 400,
                                backgroundColor: '#f8f8f8',
                                borderRadius: 1
                              }}>
                                <Box sx={{ textAlign: 'center' }}>
                                  <CircularProgress />
                                  <Typography variant="body2" sx={{ mt: 2 }}>
                                    Loading BPMN diagram with auto layout...
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                            
                            {bpmnErrors.has(index) && (
                              <Box sx={{ p: 2 }}>
                                <Alert severity="error">
                                  {bpmnErrors.get(index)}
                                </Alert>
                              </Box>
                            )}
                            
                            <div 
                              id={`bpmn-container-${index}`} 
                              className={`bpmn-viewer-container-${index}`}
                              style={{ 
                                height: 600, 
                                width: '100%', 
                                background: "#ffffff",
                                borderRadius: '4px',
                                border: '2px solid #e0e0e0',
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'grab',
                                display: (!bpmnLoading.has(index) && !bpmnErrors.has(index)) ? 'block' : 'none',
                                isolation: 'isolate', // CSS isolation for better rendering
                                zIndex: 1 // Ensure proper stacking
                              }} 
                              onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
                              onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
                              onMouseLeave={(e) => e.currentTarget.style.cursor = 'grab'}
                            />
                            
                            {!bpmnLoading.has(index) && !bpmnErrors.has(index) && expandedRows.has(index) && (
                              <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'center' }}>
                                <Button 
                                  size="small" 
                                  variant="outlined"
                                  onClick={() => {
                                    const viewer = bpmnViewers.get(index);
                                    if (viewer) {
                                      const canvas = viewer.get("canvas");
                                      canvas.zoom(canvas.zoom() * 1.2); // Zoom in
                                    }
                                  }}
                                >
                                  Zoom In
                                </Button>
                                <Button 
                                  size="small" 
                                  variant="outlined"
                                  onClick={() => {
                                    const viewer = bpmnViewers.get(index);
                                    if (viewer) {
                                      const canvas = viewer.get("canvas");
                                      canvas.zoom(canvas.zoom() * 0.8); // Zoom out
                                    }
                                  }}
                                >
                                  Zoom Out
                                </Button>
                                <Button 
                                  size="small" 
                                  variant="outlined"
                                  onClick={() => {
                                    const viewer = bpmnViewers.get(index);
                                    if (viewer) {
                                      const canvas = viewer.get("canvas");
                                      canvas.zoom("fit-viewport", "auto");
                                    }
                                  }}
                                >
                                  Auto Fit
                                </Button>
                                <Button 
                                  size="small" 
                                  variant="outlined"
                                  onClick={() => {
                                    const viewer = bpmnViewers.get(index);
                                    if (viewer) {
                                      const canvas = viewer.get("canvas");
                                      canvas.zoom(1.0); // Reset to 100%
                                      canvas.viewbox({ x: 0, y: 0, width: 800, height: 600 });
                                    }
                                  }}
                                >
                                  Reset View
                                </Button>
                              </Box>
                            )}
                          </Paper>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BestBpmns;