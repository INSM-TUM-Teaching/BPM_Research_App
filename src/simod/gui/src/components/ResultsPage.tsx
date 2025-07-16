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
  Collapse,
  Popover
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
  ExpandLess as ExpandLessIcon,
  HelpOutline as HelpOutlineIcon,
  Info as InfoIcon
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

interface GatewayProbability {
  gateway_id: string;
  probabilities: Array<{
    path_id: string;
    value: number;
  }>;
}

interface ResourceProfile {
  id: string;
  name: string;
  resource_list: Array<{
    id: string;
    name: string;
    amount: number;
    cost_per_hour: number;
    calendar: string;
    assignedTasks: string[];
  }>;
}

interface ResourceCalendar {
  id: string;
  name: string;
  time_periods: Array<{
    from: string;
    to: string;
    beginTime: string;
    endTime: string;
  }>;
}

interface TaskResourceDistribution {
  task_id: string;
  resources: Array<{
    resource_id: string;
    distribution_name: string;
    distribution_params: Array<{
      value: number;
    }>;
  }>;
}

interface SimulationParameters {
  parameters: {
    process_model: string;
    gateway_branching_probabilities: GatewayProbability[];
    arrival_time_calendar: Array<{
      from: string;
      to: string;
      beginTime: string;
      endTime: string;
    }>;
    arrival_time_distribution: {
      distribution_name: string;
      distribution_params: Array<{
        value: number;
      }>;
    };
    resource_profiles: ResourceProfile[];
    resource_calendars: ResourceCalendar[];
    task_resource_distribution: TaskResourceDistribution[];
    event_distribution: EventDistribution[];
    model_type: string;
    granule_size: {
      value: number;
      time_unit: string;
    };
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
  const [uploadedParams, setUploadedParams] = useState<any>(null);
  const [uploadedParamsError, setUploadedParamsError] = useState<string | null>(null);

  const [simulationParams, setSimulationParams] = useState<SimulationParameters | null>(null);
  const [simulationParamsLoading, setSimulationParamsLoading] = useState(false);
  const [simulationParamsError, setSimulationParamsError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({
    simulationParams: false,
    basicConfig: false,
    gatewayProbabilities: false,
    resourceProfiles: false,
    arrivalCalendar: false,
    resourceCalendars: false,
    eventDistribution: false,
    taskResourceDistribution: false,
    showAllTasks: false,
    processStats: false,
    resourceUtilization: false,
    taskAnalysis: false,
    summaryStats: false
  });
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [activityNames, setActivityNames] = useState<{[key: string]: string}>({});
  const navigate = useNavigate();

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleTaskClick = (event: React.MouseEvent<HTMLElement>, task: any) => {
    setPopoverAnchor(event.currentTarget);
    setSelectedTask(task);
  };

  const handlePopoverClose = () => {
    setPopoverAnchor(null);
    setSelectedTask(null);
  };

  const parseActivityNamesFromBPMN = async () => {
    if (!bpmnPath) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/bpmn/${encodeURIComponent(bpmnPath)}`);
      if (!response.ok) return;
      
      const data = await response.json();
      if (!data.bpmn_xml) return;
      
      // Parse BPMN XML to extract activity names
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.bpmn_xml, 'text/xml');
      
      const activityNameMap: {[key: string]: string} = {};
      
      // Get all task elements
      const tasks = xmlDoc.querySelectorAll('bpmn2\\:task, task');
      tasks.forEach(task => {
        const id = task.getAttribute('id');
        const name = task.getAttribute('name');
        if (id && name) {
          activityNameMap[id] = name;
        }
      });
      
      // Get all userTask elements
      const userTasks = xmlDoc.querySelectorAll('bpmn2\\:userTask, userTask');
      userTasks.forEach(task => {
        const id = task.getAttribute('id');
        const name = task.getAttribute('name');
        if (id && name) {
          activityNameMap[id] = name;
        }
      });
      
      // Get all serviceTask elements
      const serviceTasks = xmlDoc.querySelectorAll('bpmn2\\:serviceTask, serviceTask');
      serviceTasks.forEach(task => {
        const id = task.getAttribute('id');
        const name = task.getAttribute('name');
        if (id && name) {
          activityNameMap[id] = name;
        }
      });
      
      // Get all manualTask elements
      const manualTasks = xmlDoc.querySelectorAll('bpmn2\\:manualTask, manualTask');
      manualTasks.forEach(task => {
        const id = task.getAttribute('id');
        const name = task.getAttribute('name');
        if (id && name) {
          activityNameMap[id] = name;
        }
      });
      
      // Get all businessRuleTask elements
      const businessRuleTasks = xmlDoc.querySelectorAll('bpmn2\\:businessRuleTask, businessRuleTask');
      businessRuleTasks.forEach(task => {
        const id = task.getAttribute('id');
        const name = task.getAttribute('name');
        if (id && name) {
          activityNameMap[id] = name;
        }
      });
      
      // Get all scriptTask elements
      const scriptTasks = xmlDoc.querySelectorAll('bpmn2\\:scriptTask, scriptTask');
      scriptTasks.forEach(task => {
        const id = task.getAttribute('id');
        const name = task.getAttribute('name');
        if (id && name) {
          activityNameMap[id] = name;
        }
      });
      
      // Get all callActivity elements
      const callActivities = xmlDoc.querySelectorAll('bpmn2\\:callActivity, callActivity');
      callActivities.forEach(task => {
        const id = task.getAttribute('id');
        const name = task.getAttribute('name');
        if (id && name) {
          activityNameMap[id] = name;
        }
      });
      
      setActivityNames(activityNameMap);
    } catch (error) {
      console.error('Error parsing BPMN for activity names:', error);
    }
  };

  const getActivityName = (nodeId: string): string => {
    return activityNames[nodeId] || nodeId;
  };

  useEffect(() => {
    fetchProsimosStats();
    fetchBpmnPath();
    fetchUploadedParams();
  }, []);

  const fetchUploadedParams = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/upload-canonical-model/");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data && data.control_flow) {
        setUploadedParams(data.control_flow);
      } else {
        setUploadedParams(null);
      }
    } catch (err) {
      setUploadedParamsError(err instanceof Error ? err.message : "Failed to fetch uploaded parameters");
    }
  };

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

  const fetchSimulationParameters = async () => {
    try {
      setSimulationParamsLoading(true);
      setSimulationParamsError(null);
      
      const response = await fetch('http://localhost:8000/simulation-parameters/');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: SimulationParameters = await response.json();
      setSimulationParams(data);
    } catch (err) {
      setSimulationParamsError(err instanceof Error ? err.message : 'Failed to fetch simulation parameters');
    } finally {
      setSimulationParamsLoading(false);
    }
  };

  const handleSimulationParamsToggle = () => {
    if (!expandedSections.simulationParams && !simulationParams) {
      // Fetch data when expanding for the first time
      fetchSimulationParameters();
    }
    if (!expandedSections.simulationParams && bpmnPath && Object.keys(activityNames).length === 0) {
      // Parse BPMN for activity names when expanding for the first time
      parseActivityNamesFromBPMN();
    }
    toggleSection('simulationParams');
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
          <Typography variant="h3" component="h2" sx={{ 
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
      {/* Simulation Parameters Result */}
      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TimelineIcon sx={{ fontSize: 30, color: 'primary.main', mr: 2 }} />
              <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
                Simulation Parameters Result
              </Typography>
            </Box>
            <Button
              onClick={handleSimulationParamsToggle}
              variant="contained"
              startIcon={expandedSections.simulationParams ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              {expandedSections.simulationParams ? 'Hide' : 'View'} Details
            </Button>
          </Box>
          
          <Divider sx={{ mb: 3 }} />
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Complete simulation configuration including resource profiles, calendars, distributions, and gateway probabilities.
          </Typography>

          <Collapse in={expandedSections.simulationParams}>
            <Box sx={{ mt: 2 }}>
              {simulationParamsLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={30} />
                  <Typography sx={{ ml: 2 }}>Loading simulation parameters...</Typography>
                </Box>
              )}
              
              {simulationParamsError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {simulationParamsError}
                </Alert>
              )}
              
              {!simulationParamsLoading && !simulationParamsError && simulationParams && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  
                  {/* Arrival Time Calendar */}
                  {simulationParams.parameters.arrival_time_calendar && (
                    <Card elevation={2}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            Arrival Time Calendar
                          </Typography>
                          <IconButton 
                            onClick={() => toggleSection('arrivalCalendar')}
                            size="small"
                          >
                            {expandedSections.arrivalCalendar ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Box>
                        <Collapse in={expandedSections.arrivalCalendar}>
                          <TableContainer component={Paper} elevation={1}>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                                  <TableCell sx={{ fontWeight: 'bold' }}>Day</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold' }}>Begin Time</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold' }}>End Time</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold' }}>Duration</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {simulationParams.parameters.arrival_time_calendar.map((calendar, index) => (
                                  <TableRow key={index}>
                                    <TableCell>
                                      <Chip label={calendar.from} color="primary" variant="outlined" size="small" />
                                    </TableCell>
                                    <TableCell>{calendar.beginTime}</TableCell>
                                    <TableCell>{calendar.endTime}</TableCell>
                                    <TableCell>
                                      {(() => {
                                        const start = new Date(`2000-01-01T${calendar.beginTime}`);
                                        const end = new Date(`2000-01-01T${calendar.endTime}`);
                                        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                        return `${diffHours}h`;
                                      })()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Collapse>
                      </CardContent>
                    </Card>
                  )}

                  {/* Resource Calendars */}
                  {simulationParams.parameters.resource_calendars && simulationParams.parameters.resource_calendars.length > 0 && (
                    <Card elevation={2}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            Resource Calendars ({simulationParams.parameters.resource_calendars.length})
                          </Typography>
                          <IconButton 
                            onClick={() => toggleSection('resourceCalendars')}
                            size="small"
                          >
                            {expandedSections.resourceCalendars ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Box>
                        <Collapse in={expandedSections.resourceCalendars}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {simulationParams.parameters.resource_calendars.map((calendar, index) => (
                              <Card key={index} elevation={1} sx={{ border: '1px solid #e0e0e0' }}>
                                <CardContent sx={{ pb: 2 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                                      {calendar.name}
                                    </Typography>
                                    <Chip 
                                      label={`${calendar.time_periods.length} periods`}
                                      color="secondary"
                                      variant="outlined"
                                      size="small"
                                    />
                                  </Box>
                                  
                                  <Typography variant="caption" color="text.secondary" sx={{ 
                                    display: 'block',
                                    mb: 1,
                                    fontFamily: 'monospace',
                                    fontSize: '0.7rem'
                                  }}>
                                    ID: {calendar.id}
                                  </Typography>
                                  
                                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #f0f0f0' }}>
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow sx={{ backgroundColor: 'grey.50' }}>
                                          <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Day</TableCell>
                                          <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>From</TableCell>
                                          <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>To</TableCell>
                                          <TableCell sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Duration</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {calendar.time_periods.map((period, periodIndex) => (
                                          <TableRow key={periodIndex}>
                                            <TableCell>
                                              <Chip 
                                                label={period.from} 
                                                color="primary" 
                                                variant="outlined" 
                                                size="small"
                                                sx={{ fontSize: '0.7rem' }}
                                              />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '0.8rem' }}>{period.beginTime}</TableCell>
                                            <TableCell sx={{ fontSize: '0.8rem' }}>{period.endTime}</TableCell>
                                            <TableCell sx={{ fontSize: '0.8rem' }}>
                                              {(() => {
                                                const start = new Date(`2000-01-01T${period.beginTime}`);
                                                const end = new Date(`2000-01-01T${period.endTime}`);
                                                const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                                                return `${diffHours}h`;
                                              })()}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </TableContainer>
                                </CardContent>
                              </Card>
                            ))}
                          </Box>
                        </Collapse>
                      </CardContent>
                    </Card>
                  )}

                  {/* Event Distribution
                  {simulationParams.parameters.event_distribution && simulationParams.parameters.event_distribution.length > 0 && (
                    <Card elevation={2}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            Event Distribution ({simulationParams.parameters.event_distribution.length})
                          </Typography>
                          <IconButton 
                            onClick={() => toggleSection('eventDistribution')}
                            size="small"
                          >
                            {expandedSections.eventDistribution ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Box>
                        <Collapse in={expandedSections.eventDistribution}>
                          <TableContainer component={Paper} elevation={1}>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                                  <TableCell sx={{ fontWeight: 'bold' }}>Activity</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold' }}>Event ID</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold' }}>Distribution</TableCell>
                                  <TableCell sx={{ fontWeight: 'bold' }}>Parameters</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {simulationParams.parameters.event_distribution.map((event, index) => (
                                  <TableRow key={event.event_id || index}>
                                    <TableCell>
                                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
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
                        </Collapse>
                      </CardContent>
                    </Card>
                  )} */}

                  {/* Task Resource Distribution */}
                  {simulationParams.parameters.task_resource_distribution && (
                    <Card elevation={2}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            Task Resource Distribution ({simulationParams.parameters.task_resource_distribution.length})
                          </Typography>
                          <IconButton 
                            onClick={() => toggleSection('taskResourceDistribution')}
                            size="small"
                          >
                            {expandedSections.taskResourceDistribution ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        </Box>
                        <Collapse in={expandedSections.taskResourceDistribution}>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                            {simulationParams.parameters.task_resource_distribution
                              .slice(0, expandedSections.showAllTasks ? undefined : 8)
                              .map((task, index) => (
                              <Paper 
                                key={index} 
                                elevation={1} 
                                sx={{ 
                                  p: 2,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  '&:hover': {
                                    elevation: 3,
                                    transform: 'translateY(-1px)'
                                  }
                                }}
                                onClick={(e) => handleTaskClick(e, task)}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                    {getActivityName(task.task_id)}
                                  </Typography>
                                  <IconButton size="small" sx={{ p: 0.5 }}>
                                    <InfoIcon />
                                  </IconButton>
                                </Box>
                                
                                <Tooltip title={task.task_id} arrow>
                                  <Typography variant="caption" color="text.secondary" sx={{ 
                                    display: 'block',
                                    mb: 1,
                                    fontSize: '0.7rem',
                                    fontFamily: 'monospace',
                                    cursor: 'help',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    ID: {task.task_id.split('-')[0]}...
                                  </Typography>
                                </Tooltip>
                                
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {task.resources.length} resource(s) configured
                                </Typography>
                                
                               
                                
                              </Paper>
                            ))}
                          </Box>
                          {simulationParams.parameters.task_resource_distribution.length > 8 && (
                            <Box sx={{ mt: 3, textAlign: 'center' }}>
                              <Button
                                variant="outlined"
                                onClick={() => toggleSection('showAllTasks')}
                                startIcon={expandedSections.showAllTasks ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                size="small"
                              >
                                {expandedSections.showAllTasks 
                                  ? 'Show Less' 
                                  : `Show ${simulationParams.parameters.task_resource_distribution.length - 8} More Tasks`
                                }
                              </Button>
                            </Box>
                          )}
                        </Collapse>
                      </CardContent>
                    </Card>
                  )}

                  {/* Task Details Popover */}
                  <Popover
                    open={Boolean(popoverAnchor)}
                    anchorEl={popoverAnchor}
                    onClose={handlePopoverClose}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'left',
                    }}
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'left',
                    }}
                    PaperProps={{
                      sx: {
                        p: 2,
                        maxWidth: 400,
                        maxHeight: 500,
                        overflow: 'auto'
                      }
                    }}
                  >
                    {selectedTask && (
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                          Task Resource Details
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">Task Name:</Typography>
                          <Typography variant="body1" sx={{ 
                            fontWeight: 'medium',
                            mb: 1
                          }}>
                            {getActivityName(selectedTask.task_id)}
                          </Typography>
                          
                          <Typography variant="body2" color="text.secondary">Task ID:</Typography>
                          <Typography variant="body2" sx={{ 
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            wordBreak: 'break-all',
                            mb: 1
                          }}>
                            {selectedTask.task_id}
                          </Typography>
                        </Box>

                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                          Resources ({selectedTask.resources.length})
                        </Typography>
                        
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {selectedTask.resources.map((resource: any, rIndex: number) => (
                            <Paper key={rIndex} elevation={1} sx={{ p: 1.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                {resource.resource_id}
                              </Typography>
                              
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Chip 
                                  label={resource.distribution_name}
                                  color="primary"
                                  size="small"
                                  variant="outlined"
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {resource.distribution_params.length} parameters
                                </Typography>
                              </Box>
                              
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                Distribution Parameters:
                              </Typography>
                              
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {resource.distribution_params.map((param: any, pIndex: number) => (
                                  <Chip
                                    key={pIndex}
                                    label={`P${pIndex + 1}: ${formatParameter(param.value)}`}
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                ))}
                              </Box>
                            </Paper>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Popover>



                </Box>
              )}
              
              {!simulationParamsLoading && !simulationParamsError && !simulationParams && (
                <Alert severity="info">
                  No simulation parameters available.
                </Alert>
              )}
              
              {!simulationParamsLoading && !simulationParamsError && simulationParams && parsed_stats && (
                <Alert severity="info">
                  Simulation results are displayed above.
                </Alert>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Main Title */}
      <Box sx={{ mb: 3, textAlign: 'start' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h3" component="h1" sx={{ 
            fontWeight: 'bold',
            color: 'text.primary',
            textAlign:'start', 
            mb: 1
          }}>
            What if 100 cases
          </Typography>
          <Tooltip title="Prosimos simulation results with 100 cases - Shows performance metrics for a scenario with 100 process instances" arrow>
            <IconButton size="small" sx={{ mb: 1 }}>
              <HelpOutlineIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {/* Process Performance Metrics */}
      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AssessmentIcon sx={{ fontSize: 30, color: 'primary.main', mr: 2 }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
              Process Performance Metrics
            </Typography>
          </Box>
          <Divider sx={{ mb: 3 }} />
          {parsed_stats && parsed_stats["Overall Scenario Statistics"] && (
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 3,
              '@media (max-width: 768px)': {
                gridTemplateColumns: '1fr'
              }
            }}>
              {parsed_stats["Overall Scenario Statistics"].rows.map((row, index) => {
                const getKPIIcon = (kpi: string) => {
                  switch(kpi) {
                    case 'cycle_time': return <TimelineIcon sx={{ fontSize: 40, color: 'primary.main' }} />;
                    case 'processing_time': return <AssignmentIcon sx={{ fontSize: 40, color: 'success.main' }} />;
                    case 'idle_cycle_time': return <TimelineIcon sx={{ fontSize: 40, color: 'secondary.main' }} />;
                    case 'idle_processing_time': return <AssignmentIcon sx={{ fontSize: 40, color: 'error.main' }} />;
                    default: return <AnalyticsIcon sx={{ fontSize: 40, color: 'grey.600' }} />;
                  }
                };

                const getKPIColor = (kpi: string) => {
                  switch(kpi) {
                    case 'cycle_time': return 'primary.main';
                    case 'processing_time': return 'success.main';
                    case 'idle_cycle_time': return 'secondary.main';
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

                // Only show the 4 time-related KPIs
                if (!['cycle_time', 'processing_time', 'idle_cycle_time', 'idle_processing_time'].includes(row.KPI)) {
                  return null;
                }

                return (
                  <Card key={index} elevation={3} sx={{ 
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      elevation: 6,
                      transform: 'translateY(-2px)'
                    }
                  }}>
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      {getKPIIcon(row.KPI)}
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 'bold', 
                          mt: 1,
                          mb: 2,
                          color: getKPIColor(row.KPI)
                        }}
                      >
                        {formatKPIName(row.KPI)}
                      </Typography>
                      
                      <Typography 
                        variant="h4" 
                        sx={{ 
                          fontWeight: 'bold', 
                          mb: 1,
                          color: 'text.primary'
                        }}
                      >
                        {formatSeconds(row.Average)}
                      </Typography>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ mb: 2 }}
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
          )}
        </CardContent>
      </Card>

      {/* Control Flow Parameters*/}
      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AnalyticsIcon sx={{ fontSize: 30, color: 'primary.main', mr: 2 }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
              Control Flow Parameters
            </Typography>
          </Box>
          <Divider sx={{ mb: 3 }} />
          {uploadedParamsError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadedParamsError}
            </Alert>
          )}
          {!uploadedParams && !uploadedParamsError && (
            <Typography color="text.secondary">No uploaded parameters available.</Typography>
          )}
          {uploadedParams && (
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 3,
              mb: 3
            }}>
              {[
                {
                  label: "Mining Algorithm",
                  value: uploadedParams.mining_algorithm,
                  color: "primary.main",
                },
                {
                  label: "Epsilon",
                  value: uploadedParams.epsilon,
                  color: "success.main",
                },
                {
                  label: "Eta",
                  value: uploadedParams.eta,
                  color: "info.main",
                },
                {
                  label: "Prioritize Parallelism",
                  value: uploadedParams.prioritize_parallelism,
                  color: "warning.main",
                },
                {
                  label: "Replace OR Joins",
                  value: uploadedParams.replace_or_joins,
                  color: "error.main",
                  
                }
              ].map((param, idx) => (
                <Card key={idx} elevation={3} sx={{
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    elevation: 6,
                    transform: 'translateY(-2px)'
                  }
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 'bold',
                          ml: 1,
                          color: param.color
                        }}
                      >
                        {param.label}
                      </Typography>
                    </Box>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 'bold',
                        mb: 1,
                        color: 'text.primary',
                        textAlign: 'center'
                      }}
                    >
                      {param.value}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
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
                      <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                        {row["Resource name"]}
                      </Typography>
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

      {/* Individual Task Analysis */}
      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AnalyticsIcon sx={{ fontSize: 30, color: 'primary.main', mr: 2 }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
              Individual Task Analysis
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <AssessmentIcon sx={{ fontSize: 30, color: 'primary.main', mr: 2 }} />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
              Summary Statistics
            </Typography>
          </Box>
          <Divider sx={{ mb: 3 }} />
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
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default ResultsPage;