import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Button,
  Stack,
  Collapse
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Timeline as TimelineIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  Analytics as AnalyticsIcon,
  Assessment as AssessmentIcon,
  AccountTree as BpmnIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";

interface ResourceRow {
  "Resource ID": string;
  "Resource name": string;
  "Utilization Ratio": string;
  "Tasks Allocated": string;
  "Worked Time (seconds)": string;
  "Available Time (seconds)": string;
  "Pool ID": string;
  "Pool name": string;
}

interface TaskRow {
  "Name": string;
  "Count": string;
  "Avg Duration": string;
  "Total Duration": string;
  "Avg Waiting Time": string;
  "Total Waiting Time": string;
  "Avg Processing Time": string;
  "Total Processing Time": string;
  "Avg Cycle Time": string;
  "Total Cycle Time": string;
  "Total Cost": string;
  [key: string]: string;
}

interface ScenarioRow {
  "KPI": string;
  "Min": string;
  "Max": string;
  "Average": string;
  "Accumulated Value": string;
  "Trace Ocurrences": string;
}

interface EventDistribution {
  activity: string;
  event_id: string;
  distribution_name: string;
  distribution_params: Array<{
    value: number;
  }>;
}

interface SimulationParameters {
  parameters: {
    event_distribution: EventDistribution[];
    [key: string]: any;
  };
  [key: string]: any;
}

interface ProsimosStats {
  stats_path: string;
  log_path: string;
  parsed_stats: {
    metadata: {
      started_at: string;
      completed_at: string;
    };
    "Resource Utilization": {
      headers: string[];
      rows: ResourceRow[];
    };
    "Individual Task Statistics": {
      headers: string[];
      rows: TaskRow[];
    };
    "Overall Scenario Statistics": {
      headers: string[];
      rows: ScenarioRow[];
    };
  };
}

const ResultsPage: React.FC = () => {
  const [stats, setStats] = useState<ProsimosStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bpmnPath, setBpmnPath] = useState<string | null>(null);
  const [bpmnExpanded, setBpmnExpanded] = useState(false);
  const [bpmnViewer, setBpmnViewer] = useState<any>(null);
  const [bpmnLoading, setBpmnLoading] = useState(false);
  const [bpmnError, setBpmnError] = useState<string | null>(null);
  const [eventDistribution, setEventDistribution] = useState<EventDistribution[]>([]);
  const [eventDistributionExpanded, setEventDistributionExpanded] = useState(false);
  const [eventDistributionLoading, setEventDistributionLoading] = useState(false);
  const [eventDistributionError, setEventDistributionError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProsimosStats();
    fetchBpmnPath();
  }, []);

  const fetchProsimosStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:8000/final-prosimos-stats');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  };

  const fetchBpmnPath = async () => {
    try {
      const response = await fetch('http://localhost:8000/final-bpmn-path/');
      if (response.ok) {
        const data = await response.json();
        setBpmnPath(data.path);
      }
    } catch (err) {
      console.log('BPMN path not available yet');
    }
  };

  const fetchEventDistribution = async () => {
    try {
      setEventDistributionLoading(true);
      setEventDistributionError(null);
      
      const response = await fetch('http://localhost:8000/simulation-parameters/');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: SimulationParameters = await response.json();
      setEventDistribution(data.parameters?.event_distribution || []);
    } catch (err) {
      setEventDistributionError(err instanceof Error ? err.message : 'Failed to fetch event distribution');
    } finally {
      setEventDistributionLoading(false);
    }
  };

  const handleEventDistributionToggle = () => {
    if (!eventDistributionExpanded && eventDistribution.length === 0) {
      // Fetch data when expanding for the first time
      fetchEventDistribution();
    }
    setEventDistributionExpanded(!eventDistributionExpanded);
  };

  const loadBpmnDiagram = async () => {
    if (!bpmnPath) return;

    try {
      setBpmnLoading(true);
      setBpmnError(null);

      // Read BPMN file directly from path
      const response = await fetch(`http://localhost:8000/api/bpmn/${encodeURIComponent(bpmnPath)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load BPMN file: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.bpmn_xml) {
        throw new Error("No BPMN XML received from server");
      }
      
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const container = document.getElementById('final-bpmn-container');
      if (!container) {
        throw new Error('BPMN container not found');
      }

      // Clear container
      container.innerHTML = '';
      container.style.display = 'block';
      container.style.height = '600px';
      container.style.width = '100%';
      
      // Create viewer
      const viewer = new NavigatedViewer({ 
        container,
        keyboard: {
          bindTo: container
        }
      });
      
      // Import XML
      await viewer.importXML(data.bpmn_xml);
      
      // Auto-fit
      const canvas = viewer.get("canvas") as any;
      setTimeout(() => {
        if (canvas && canvas.zoom) {
          canvas.zoom("fit-viewport", "auto");
        }
      }, 100);
      
      setBpmnViewer(viewer);
      
    } catch (err) {
      setBpmnError(`Failed to load BPMN: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBpmnLoading(false);
    }
  };

  const handleViewBpmn = async () => {
    const isCurrentlyExpanded = bpmnExpanded;
    
    if (isCurrentlyExpanded) {
      
      if (bpmnViewer) {
        try {
          const container = document.getElementById('final-bpmn-container');
          if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
          }
          bpmnViewer.destroy();
        } catch (err) {
          console.log('Error destroying viewer:', err);
        }
        setBpmnViewer(null);
      }
    }
    
    setBpmnExpanded(!isCurrentlyExpanded);
    
    if (!isCurrentlyExpanded && bpmnPath) {
      // Expanding - load BPMN
      setTimeout(() => {
        loadBpmnDiagram();
      }, 100);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bpmnViewer) {
        try {
          bpmnViewer.destroy();
        } catch (err) {
          console.log('Cleanup error:', err);
        }
      }
    };
  }, [bpmnViewer]);

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (startStr: string, endStr: string) => {
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      const diffMs = end.getTime() - start.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      if (diffHours > 0) {
        return `${diffHours}h ${diffMins}m`;
      }
      return `${diffMins}m`;
    } catch {
      return 'Unknown';
    }
  };

  const formatSeconds = (seconds: string) => {
    const sec = parseFloat(seconds);
    if (isNaN(sec)) return seconds;
    
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const remainingSeconds = Math.floor(sec % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const formatUtilization = (ratio: string) => {
    const num = parseFloat(ratio);
    if (isNaN(num)) return ratio;
    return `${(num * 100).toFixed(1)}%`;
  };

  const getUtilizationColor = (ratio: string) => {
    const num = parseFloat(ratio);
    if (isNaN(num)) return 'default';
    if (num >= 0.8) return 'error';
    if (num >= 0.6) return 'warning';
    if (num >= 0.3) return 'success';
    return 'info';
  };

  const formatCurrency = (cost: string) => {
    const num = parseFloat(cost);
    if (isNaN(num)) return cost;
    return `$${num.toFixed(2)}`;
  };

  const formatParameter = (value: number) => {
    if (value === 0) return '0';
    if (value < 1) return value.toFixed(4);
    if (value < 1000) return value.toFixed(2);
    if (value < 1000000) return `${(value / 1000).toFixed(1)}K`;
    if (value < 1000000000) return `${(value / 1000000).toFixed(1)}M`;
    return `${(value / 1000000000).toFixed(1)}B`;
  };

  const filterMeaningfulTasks = (tasks: TaskRow[]) => {
    return tasks.filter(task => 
      !task.Name.startsWith('Event_') && 
      parseFloat(task.Count) > 0 &&
      parseFloat(task["Total Processing Time"]) > 0
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ ml: 2 }}>
            Loading simulation results...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">Error Loading Results</Typography>
          <Typography>{error}</Typography>
        </Alert>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button variant="contained" onClick={fetchProsimosStats} startIcon={<RefreshIcon />}>
            Retry
          </Button>
          <Button variant="outlined" onClick={() => navigate('/')} startIcon={<HomeIcon />}>
            Go Home
          </Button>
        </Box>
      </Container>
    );
  }

  if (!stats) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">
          No simulation results available.
        </Alert>
      </Container>
    );
  }

  const { parsed_stats } = stats;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h3" component="h1" sx={{ 
            fontWeight: 'bold',
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Simulation Results
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh Results">
              <IconButton onClick={fetchProsimosStats} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {/* <Tooltip title="Download Results">
              <IconButton color="primary">
                <DownloadIcon />
              </IconButton>
            </Tooltip> */}
            <Button 
              variant="outlined" 
              onClick={() => navigate('/')}
              startIcon={<HomeIcon />}
            >
              Home
            </Button>
          </Box>
        </Box>
        
        <Alert sx={{ mb: 3,textAlign: 'left' }}>
          <Typography variant="h6">Simulation Completed Successfully!</Typography>
          <Typography>
            Your BPMN model has been successfully processed and simulated using Prosimos.
          </Typography>
        </Alert>
      </Box>

      {/* Final BPMN Model Viewer */}
      {bpmnPath && (
        <Card elevation={4} sx={{ mb: 4 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <BpmnIcon sx={{ fontSize: 30, color: 'primary.main', mr: 2 }} />
                <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
                  Final BPMN Model
                </Typography>
                <Chip 
                  label="Best Result" 
                  color="primary" 
                  size="small" 
                  sx={{ ml: 2 }} 
                />
              </Box>
              <Button
                variant="contained"
                startIcon={bpmnExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={handleViewBpmn}
              >
                {bpmnExpanded ? 'Hide' : 'View'} BPMN Diagram
              </Button>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This is the final BPMN model generated by Simod with the best performance metrics.
            </Typography>

            <Collapse in={bpmnExpanded} timeout="auto" unmountOnExit>
              <Paper elevation={2} sx={{ p: 2, backgroundColor: 'white' }}>
                {bpmnLoading && (
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
                        Loading final BPMN diagram...
                      </Typography>
                    </Box>
                  </Box>
                )}
                
                {bpmnError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {bpmnError}
                  </Alert>
                )}
                
                <div 
                  id="final-bpmn-container"
                  style={{ 
                    height: 600, 
                    width: '100%', 
                    background: "#ffffff",
                    borderRadius: '4px',
                    border: '2px solid #e0e0e0',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'grab',
                    display: (!bpmnLoading && !bpmnError) ? 'block' : 'none'
                  }} 
                  onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
                  onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
                  onMouseLeave={(e) => e.currentTarget.style.cursor = 'grab'}
                />
                
                {!bpmnLoading && !bpmnError && bpmnExpanded && bpmnViewer && (
                  <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => {
                        if (bpmnViewer) {
                          const canvas = bpmnViewer.get("canvas");
                          canvas.zoom(canvas.zoom() * 1.2);
                        }
                      }}
                    >
                      Zoom In
                    </Button>
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => {
                        if (bpmnViewer) {
                          const canvas = bpmnViewer.get("canvas");
                          canvas.zoom(canvas.zoom() * 0.8);
                        }
                      }}
                    >
                      Zoom Out
                    </Button>
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => {
                        if (bpmnViewer) {
                          const canvas = bpmnViewer.get("canvas");
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
                        if (bpmnViewer) {
                          const canvas = bpmnViewer.get("canvas");
                          canvas.zoom(1.0);
                          canvas.viewbox({ x: 0, y: 0, width: 800, height: 600 });
                        }
                      }}
                    >
                      Reset View
                    </Button>
                  </Box>
                )}
              </Paper>
            </Collapse>
          </CardContent>
        </Card>
      )}

      {/* Overall Scenario Statistics */}
      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AssessmentIcon sx={{ fontSize: 30, color: 'primary.main', mr: 2 }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
              Overall Process Statistics
            </Typography>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 3,
            mb: 3
          }}>
            {parsed_stats["Overall Scenario Statistics"].rows.filter(row => row.KPI !== 'idle_cycle_time')
            .map((row, index) => {
              const getKPIIcon = (kpi: string) => {
                switch(kpi) {
                  case 'cycle_time': return <TimelineIcon sx={{ fontSize: 24, color: 'primary.main' }} />;
                  case 'processing_time': return <AssignmentIcon sx={{ fontSize: 24, color: 'success.main' }} />;
                  case 'waiting_time': return <ScheduleIcon sx={{ fontSize: 24, color: 'warning.main' }} />;
                  case 'idle_time': return <PersonIcon sx={{ fontSize: 24, color: 'info.main' }} />;
                  case 'idle_processing_time': return <AssignmentIcon sx={{ fontSize: 24, color: 'error.main' }} />;
                  default: return <AnalyticsIcon sx={{ fontSize: 24, color: 'grey.600' }} />;
                }
              };

              const getKPIColor = (kpi: string) => {
                switch(kpi) {
                  case 'cycle_time': return 'primary.main';
                  case 'processing_time': return 'success.main';
                  case 'waiting_time': return 'warning.main';
                  case 'idle_time': return 'info.main';
                  case 'idle_processing_time': return 'error.main';
                  default: return 'grey.600';
                }
              };

              const formatKPIName = (kpi: string) => {
                return kpi.replace(/_/g, ' ')
                         .split(' ')
                         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                         .join(' ');
              };

              return (
                <Card key={index} elevation={3} sx={{ 
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    elevation: 6,
                    transform: 'translateY(-2px)'
                  }
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      {getKPIIcon(row.KPI)}
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 'bold', 
                          ml: 1,
                          color: getKPIColor(row.KPI)
                        }}
                      >
                        {formatKPIName(row.KPI)}
                      </Typography>
                    </Box>
                    
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        fontWeight: 'bold', 
                        mb: 1,
                        color: 'text.primary',
                        textAlign: 'center'
                      }}
                    >
                      {formatSeconds(row.Average)}
                    </Typography>
                    
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ textAlign: 'center', mb: 2 }}
                    >
                      Average per case
                    </Typography>
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      gap: 2
                    }}>
                      <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ fontWeight: 'bold' }}
                        >
                          Minimum
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 'medium',
                            color: 'success.main'
                          }}
                        >
                          {formatSeconds(row.Min)}
                        </Typography>
                      </Box>
                      
                      <Divider orientation="vertical" flexItem />
                      
                      <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ fontWeight: 'bold' }}
                        >
                          Maximum
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 'medium',
                            color: 'error.main'
                          }}
                        >
                          {formatSeconds(row.Max)}
                        </Typography>
                      </Box>
                    </Box>

                    
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* Resource Utilization Analysis */}
      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <PersonIcon sx={{ fontSize: 30, color: 'primary.main', mr: 2 }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
              Resource Utilization Analysis
            </Typography>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <TableContainer component={Paper} elevation={2}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Resource</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Utilization</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Tasks</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Worked Time</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Available Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsed_stats["Resource Utilization"].rows.map((row, index) => (
                  <TableRow 
                    key={index} 
                    sx={{ 
                      '&:nth-of-type(odd)': { backgroundColor: 'grey.50' },
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                          {row["Resource name"]}
                        </Typography>
                
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        
                        label={formatUtilization(row["Utilization Ratio"])}
                        color={getUtilizationColor(row["Utilization Ratio"]) as any}
                        variant="filled"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AssignmentIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                        {row["Tasks Allocated"]}
                      </Box>
                    </TableCell>
                    <TableCell>{formatSeconds(row["Worked Time (seconds)"])}</TableCell>
                    <TableCell>{formatSeconds(row["Available Time (seconds)"])}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Individual Task Statistics */}
      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AnalyticsIcon sx={{ fontSize: 30, color: 'primary.main', mr: 2 }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
              Individual Task Statistics
            </Typography>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <TableContainer component={Paper} elevation={2}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Task Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Count</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Avg Processing Time</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Avg Waiting Time</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Avg Cycle Time</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Total Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filterMeaningfulTasks(parsed_stats["Individual Task Statistics"].rows).map((row, index) => (
                  <TableRow 
                    key={index} 
                    sx={{ 
                      '&:nth-of-type(odd)': { backgroundColor: 'grey.50' },
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                        {row.Name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={row.Count}
                        color="primary"
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatSeconds(row["Avg Processing Time"])}</TableCell>
                    <TableCell>{formatSeconds(row["Avg Waiting Time"])}</TableCell>
                    <TableCell>{formatSeconds(row["Avg Cycle Time"])}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'success.main' }}>
                        {formatCurrency(row["Total Cost"])}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TimelineIcon sx={{ fontSize: 30, color: 'primary.main', mr: 2 }} />
              <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
                Event Distribution Details
              </Typography>
            </Box>
            <Button
              onClick={handleEventDistributionToggle}
              variant="contained"
              startIcon={eventDistributionExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              {eventDistributionExpanded ? 'Hide' : 'View'} Details
            </Button>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          <Collapse in={eventDistributionExpanded}>
            <Box sx={{ mt: 2 }}>
              {eventDistributionLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={30} />
                  <Typography sx={{ ml: 2 }}>Loading event distribution...</Typography>
                </Box>
              )}
              
              {eventDistributionError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {eventDistributionError}
                </Alert>
              )}
              
              {!eventDistributionLoading && !eventDistributionError && eventDistribution.length > 0 && (
                <TableContainer component={Paper} elevation={2}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'grey.100' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Activity</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Event ID</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Distribution</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Parameters</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {eventDistribution.map((event, index) => (
                        <TableRow 
                          key={event.event_id || index}
                          sx={{ 
                            '&:nth-of-type(odd)': { backgroundColor: 'grey.50' },
                            '&:hover': { backgroundColor: 'action.hover' }
                          }}
                        >
                          <TableCell>
                            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                              {event.activity}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={event.event_id} arrow>
                              <Typography variant="body2" sx={{ 
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                                color: 'text.secondary',
                                cursor: 'help',
                                maxWidth: '120px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {event.event_id.split('-')[0]}...
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={event.distribution_name}
                              color="secondary"
                              variant="filled"
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {event.distribution_params.map((param, paramIndex) => (
                                <Tooltip 
                                  key={paramIndex}
                                  title={`Parameter ${paramIndex + 1}: ${param.value}`}
                                  arrow
                                >
                                  <Chip
                                    label={formatParameter(param.value)}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    sx={{ fontSize: '0.7rem', cursor: 'help' }}
                                  />
                                </Tooltip>
                              ))}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              
              {!eventDistributionLoading && !eventDistributionError && eventDistribution.length === 0 && (
                <Alert severity="info">
                  No event distribution data available.
                </Alert>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Card elevation={4}>
        <CardContent>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold', mb: 3 }}>
            Summary Statistics
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            gap: 2, 
            flexWrap: 'wrap'
          }}>
            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary.main" sx={{ fontWeight: 'bold' }}>
                  {parsed_stats["Resource Utilization"].rows.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Resources
                </Typography>
              </Paper>
            </Box>
            
            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main" sx={{ fontWeight: 'bold' }}>
                  {parsed_stats["Resource Utilization"].rows.reduce((sum, row) => 
                    sum + parseInt(row["Tasks Allocated"]), 0
                  )}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Tasks
                </Typography>
              </Paper>
            </Box>
            
            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main" sx={{ fontWeight: 'bold' }}>
                  {(parsed_stats["Resource Utilization"].rows.reduce((sum, row) => 
                    sum + parseFloat(row["Utilization Ratio"]), 0
                  ) / parsed_stats["Resource Utilization"].rows.length * 100).toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Utilization
                </Typography>
              </Paper>
            </Box>
            
            <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
              <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="info.main" sx={{ fontWeight: 'bold' }}>
                  {filterMeaningfulTasks(parsed_stats["Individual Task Statistics"].rows).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Tasks
                </Typography>
              </Paper>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default ResultsPage;