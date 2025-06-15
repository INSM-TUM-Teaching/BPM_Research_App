import React, { useState, useMemo, useEffect } from "react";
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, 
  Button, Stack, CircularProgress, Typography, Pagination, FormControl,
  InputLabel, Select, MenuItem, Box, Tooltip, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, Alert, Snackbar
} from "@mui/material";
import { parseISO } from "date-fns";
import DateTimeRangePicker from "./DateTimeRangePicker";
import ActivitiesPopover from "./ActivitiesPopover";
import CasesPopover from "./CasesPopover";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
//////##

const EventLog: React.FC = () => {
  // States for data management
  const [allEventLogs, setAllEventLogs] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // States for filters
  const [activityAnchorEl, setActivityAnchorEl] = useState<null | HTMLElement>(null);
  const [caseAnchorEl, setCaseAnchorEl] = useState<null | HTMLElement>(null);
  const [allActivities, setAllActivities] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [allCaseIds, setAllCaseIds] = useState<string[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  
  // States for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  
  // States for Continue operations
  const [continueLoading, setContinueLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [continueSuccess, setContinueSuccess] = useState<string | null>(null);
  const [continueError, setContinueError] = useState<string | null>(null);


  const fetchAllEventLogs = async () => {
  setLoading(true);
  setError(null);
  
  try {
    // First check if API (to get complete data) exists
    let completeEndpoint = false;
    try {
      const testResponse = await fetch("http://localhost:8000/api/event-log/full", { method: 'HEAD' });
      completeEndpoint = testResponse.ok;
    } catch {
      completeEndpoint = false;
    }
    
    // If full endpoint exists, we can use it directly (preferred)
    if (completeEndpoint) {
      console.log("Fetching all data at once...");
      const response = await fetch("http://localhost:8000/api/event-log/full");
      if (!response.ok) {
        throw new Error('Could not fetch event log data');
      }
      
      const data = await response.json();
      if (data.status !== 'success') {
        throw new Error('Invalid API response');
      }
      
      setAllEventLogs(data.data || []);
      
      // Determine columns
      if (data.data && data.data.length > 0) {
        setHeaders(Object.keys(data.data[0]));
      } else if (data.columns) {
        setHeaders(data.columns);
      }
      
      // Extract activity and case IDs
      extractMetadata(data.data);
    } 
    // If full endpoint doesn't exist, we'll fetch all pages sequentially and combine the data
    else {
      console.log("Fetching all data page by page...");
      // Fetch first page and learn total row count
      const firstPageResponse = await fetch("http://localhost:8000/api/event-log?limit=1000&offset=0");
      if (!firstPageResponse.ok) {
        throw new Error('Could not fetch event log data');
      }
      
      const firstPageData = await firstPageResponse.json();
      if (firstPageData.status !== 'success' || !firstPageData.total_rows) {
        throw new Error('Invalid API response');
      }
      
      // Calculate how many requests we need from total rows and page size
      const totalRows = firstPageData.total_rows;
      const batchSize = 1000;
      const batchCount = Math.ceil(totalRows / batchSize);
      
      console.log(`Total ${totalRows} records, ${batchCount} pages will be fetched...`);
      
      // Store first page data
      let allLogs: any[] = [...firstPageData.data];
      
      // Fetch other pages (if any)
      if (batchCount > 1) {
        // Inform user about progress
        setError(`Page 1 of ${batchCount} pages loaded...`);
        
        for (let i = 1; i < batchCount; i++) {
          const offset = i * batchSize;
          console.log(`Fetching page ${i+1}/${batchCount} (${offset}-${offset+batchSize})...`);
          setError(`Loading page ${i+1} of ${batchCount}...`);
          
          const pageResponse = await fetch(`http://localhost:8000/api/event-log?limit=${batchSize}&offset=${offset}`);
          if (!pageResponse.ok) {
            throw new Error(`Could not fetch page ${i+1}`);
          }
          
          const pageData = await pageResponse.json();
          if (pageData.status !== 'success') {
            throw new Error(`Invalid API response for page ${i+1}`);
          }
          
          // Combine results
          allLogs = [...allLogs, ...pageData.data];
        }
        
        setError(null); // Loading complete, clear error message
      }
      
      console.log(`Total ${allLogs.length} records loaded successfully.`);
      setAllEventLogs(allLogs);
      
      // Determine columns
      if (allLogs.length > 0) {
        setHeaders(Object.keys(allLogs[0]));
      }
      
      // Extract activity and case IDs
      extractMetadata(allLogs);
    }
  } catch (err: any) {
    setError(err.message);
    console.error('Error fetching event log:', err);
  } finally {
    setLoading(false);
  }
};

  // Helper function to extract Activity and Case ID lists from dataset
  const extractMetadata = (logs: any[]) => {
    const activitiesSet = new Set<string>();
    const casesSet = new Set<string>();
    
    logs.forEach((row: any) => {
      if (row.activity) activitiesSet.add(row.activity);
      if (row.case_id) casesSet.add(row.case_id);
    });
    
    const uniqueActivities = Array.from(activitiesSet) as string[];
    const uniqueCases = Array.from(casesSet) as string[];
    
    setAllActivities(uniqueActivities);
    setSelectedActivities(uniqueActivities);
    setAllCaseIds(uniqueCases);
    setSelectedCaseIds(uniqueCases);
  };

  // Initial load
  useEffect(() => {
    fetchAllEventLogs();

    // Check Simod status and learn if it's waiting
    checkSimodWaiting();
  }, []); 
  
  // Check if Simod is waiting
  const checkSimodWaiting = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/simod/status");
      const data = await response.json();
      
      if (data.status === "waiting_for_filter") {
        // Simod is waiting - do nothing, continue normal flow
        console.log("Simod is waiting for filtering, filter and continue.");
      }
    } catch (err) {
      // If status API doesn't exist, continue with normal flow
      console.log("Could not check Simod status, continuing with normal flow.");
    }
  };

  // Return to page 1 when filters are applied
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedActivities, selectedCaseIds, dateRange]);

  // Calculate filtered logs by applying date, activity, and status filters
  const filteredLogs = useMemo(() => {
    const [start, end] = dateRange;
    
    return allEventLogs.filter((log) => {
      const inActivity = selectedActivities.length === 0 || 
                        (log.activity && selectedActivities.includes(log.activity));
      
      const inCase = selectedCaseIds.length === 0 || 
                    (log.case_id && selectedCaseIds.includes(log.case_id));
      
      // Date check
      let inDate = true;
      if (start && end && log.start_time) {
        try {
          const logDate = parseISO(log.start_time);
          inDate = logDate.getTime() >= start.getTime() && logDate.getTime() <= end.getTime();
        } catch (e) {
          // Date conversion error, skip filtering
          console.warn("Date conversion error:", log.start_time);
        }
      }
      
      return inActivity && inCase && inDate;
    });
  }, [allEventLogs, dateRange, selectedActivities, selectedCaseIds]);

  // Paginated data
  const pagedLogs = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    return filteredLogs.slice(startIdx, endIdx);
  }, [filteredLogs, currentPage, pageSize]);

  // Total number of pages
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

  // Handle page change
  const handlePageChange = (event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (event: any) => {
    const newSize = parseInt(event.target.value, 10);
    setPageSize(newSize);
    setCurrentPage(1); // Return to page 1 when page size changes
  };
  
  // Function that runs when Continue button is clicked
  const saveFilteredLogsAndContinue = async () => {
    setContinueLoading(true);
    setContinueError(null);
    
    try {
      console.log(`Sending ${filteredLogs.length} filtered records...`);
      
      // Send filtered data to API
      const response = await fetch("http://localhost:8000/api/event-log/filtered", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: filteredLogs })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("API response error:", response.status, errorData);
        throw new Error(`API error (${response.status}): ${errorData}`);
      }
      
      const result = await response.json();
      
      // Notify that filtering is complete
      await fetch("http://localhost:8000/api/simod/set-status", {
        method: "POST", 
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "completed_filtering" })
      });
      
      // Send continue signal to Simod
      await fetch("http://localhost:8000/api/simod/continue", {
        method: "POST", 
        headers: {
          "Content-Type": "application/json",
        }
      });
      
      setContinueSuccess(`Simod is continuing with filtered event log containing ${result.row_count} records.`);
    } catch (err: any) {
      setContinueError(err.message || "An error occurred during the process.");
    } finally {
      setContinueLoading(false);
    }
  };
  
  // When Continue button is clicked
  const handleContinueClick = () => {
    // Check filtered data count
    if (filteredLogs.length === 0) {
      setContinueError("There must be filtered data to continue.");
      return;
    }
    
    // Open confirmation dialog
    setConfirmDialogOpen(true);
  };
  
  // After confirming Continue operation
  const handleConfirmContinue = async () => {
    setConfirmDialogOpen(false);
    setContinueLoading(true);
    setContinueError(null);
    
    try {
      // Save filtered data and send continue signal to Simod
      await saveFilteredLogsAndContinue();
      
      // Show success message (no need to do anything here as the message is already set in saveFilteredLogsAndContinue)
    } catch (err: any) {
      setContinueError(err.message || "An error occurred during the process.");
    } finally {
      setContinueLoading(false);
    }
  };
  
  // Close success message
  const handleSuccessClose = () => {
    setContinueSuccess(null);
  };
  
  // Close error message
  const handleErrorClose = () => {
    setContinueError(null);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "16px" }}>
      <Stack
        direction="row"
        spacing={2}
        style={{ marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}
        justifyContent="space-between"
        alignItems="center"
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Button
            variant="contained"
            color="primary"
            onClick={(e) => setActivityAnchorEl(e.currentTarget)}
            disabled={loading || !allEventLogs.length}
            size="small"
          >
            Activities ({selectedActivities.length})
          </Button>

          <Button
            variant="contained"
            color="secondary"
            onClick={(e) => setCaseAnchorEl(e.currentTarget)}
            disabled={loading || !allEventLogs.length}
            size="small"
          >
            Cases ({selectedCaseIds.length})
          </Button>

          <DateTimeRangePicker
            value={dateRange}
            onChange={setDateRange}
          />

          <Button
            variant="contained"
            onClick={fetchAllEventLogs}
            disabled={loading}
            size="small"
          >
            Refresh
          </Button>
          
          <FormControl size="small" style={{ minWidth: 120 }}>
            <InputLabel>Records Per Page</InputLabel>
            <Select
              value={pageSize}
              onChange={handlePageSizeChange}
              label="Records Per Page"
              disabled={loading}
            >
              <MenuItem value={50}>50 records</MenuItem>
              <MenuItem value={100}>100 records</MenuItem>
              <MenuItem value={250}>250 records</MenuItem>
              <MenuItem value={500}>500 records</MenuItem>
              <MenuItem value={1000}>1000 records</MenuItem>
            </Select>
          </FormControl>
        </Stack>
        
        {/* Continue button - right aligned */}
        <Tooltip title="Continue to Simod using filtered data">
          <span> {/* Wrapped with span because Tooltip doesn't work with disabled buttons */}
            <Button
              variant="contained"
              color="success"
              size="medium"
              onClick={handleContinueClick}
              disabled={loading || continueLoading || filteredLogs.length === 0}
              startIcon={<PlayArrowIcon />}
              sx={{ height: 40 }}
            >
              {continueLoading ? <CircularProgress size={24} color="inherit" /> : "Continue with Filtered Data"}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <ActivitiesPopover
        open={Boolean(activityAnchorEl)}
        anchorEl={activityAnchorEl}
        activities={allActivities}
        selected={selectedActivities}
        onClose={() => setActivityAnchorEl(null)}
        onApply={(selected) => setSelectedActivities(selected)}
      />

      <CasesPopover
        open={Boolean(caseAnchorEl)}
        anchorEl={caseAnchorEl}
        cases={allCaseIds}
        selected={selectedCaseIds}
        onClose={() => setCaseAnchorEl(null)}
        onApply={(selected) => setSelectedCaseIds(selected)}
      />

      {/* Filtering summary */}
      {filteredLogs.length !== allEventLogs.length && allEventLogs.length > 0 && (
        <Box sx={{ mb: 2, mt: -1 }}>
          <Typography variant="body2" color="textSecondary">
            <b>Filter active:</b> Showing {filteredLogs.length} / {allEventLogs.length} records ({((filteredLogs.length / allEventLogs.length) * 100).toFixed(1)}%)
          </Typography>
        </Box>
      )}

      {/* Pagination control - top */}
      {totalPages > 1 && (
        <Stack 
          direction="row" 
          spacing={2} 
          justifyContent="center" 
          alignItems="center"
          style={{ marginBottom: "16px" }}
        >
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
            disabled={loading}
          />
          <Typography variant="body2" color="textSecondary">
            Records {(currentPage-1)*pageSize+1}-{Math.min(currentPage*pageSize, filteredLogs.length)} of {filteredLogs.length}
          </Typography>
        </Stack>
      )}

      {loading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "50vh",
          }}
        >
          <CircularProgress size={70} />
          <Typography
            variant="h6"
            style={{ marginTop: 16 }}
          >
            Loading event log data...
          </Typography>
        </div>
      ) : error ? (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#ffebee",
            borderRadius: "4px",
            margin: "20px 0",
            width: "100%"
          }}
        >
          <Typography variant="h6" color="error">
            Error
          </Typography>
          <Typography>{error}</Typography>
          <Button 
            variant="contained" 
            onClick={fetchAllEventLogs}
            style={{ marginTop: "10px" }}
          >
            Try Again
          </Button>
        </div>
      ) : pagedLogs.length > 0 ? (
        // Scrollable table container - fills all available space
        <TableContainer 
          component={Paper}
          style={{ 
            width: "100%", 
            height: `calc(100vh - ${totalPages > 1 ? 200 : 150}px)`, // Leave room for pagination elements above and below
            overflowY: "auto", // Vertical scrolling
            overflowX: "auto"  // Horizontal scrolling
          }}
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableCell
                    key={header}
                    style={{ 
                      fontWeight: "bold",
                      backgroundColor: "#f5f5f5", // Background color for headers
                      position: "sticky",
                      top: 0,
                      zIndex: 1
                    }}
                  >
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedLogs.map((row, idx) => (
                <TableRow 
                  key={idx}
                  hover // Change color on hover
                  style={{ 
                    backgroundColor: idx % 2 === 0 ? "white" : "#fafafa" // Alternate row coloring
                  }}
                >
                  {headers.map((header) => (
                    <TableCell key={header} style={{ maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row[header]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="h6" style={{ textAlign: "center", marginTop: "40px" }}>
          {allEventLogs.length === 0 ? "No event log data found. Check API connection." : "No filtered results found."}
        </Typography>
      )}
      
      {/* Pagination control - bottom */}
      {totalPages > 1 && (
        <Stack 
          direction="row" 
          spacing={2} 
          justifyContent="center" 
          alignItems="center"
          style={{ marginTop: "16px" }}
        >
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
            disabled={loading}
          />
        </Stack>
      )}
      
      {/* Data amount indicator */}
      {pagedLogs.length > 0 && (
        <Typography 
          variant="body2" 
          style={{ marginTop: "8px", textAlign: "right", color: "gray" }}
        >
          Showing {pagedLogs.length} records on page (from {filteredLogs.length} filtered records, out of {allEventLogs.length} total records)
        </Typography>
      )}
      
      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Continue to Simod</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Filtered event log ({filteredLogs.length} records) will be sent to Simod and the process will continue.
            <br /><br />
            Do you want to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmContinue} 
            color="primary" 
            variant="contained"
            autoFocus
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Success message */}
      <Snackbar 
        open={!!continueSuccess} 
        autoHideDuration={6000} 
        onClose={handleSuccessClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSuccessClose} severity="success">
          {continueSuccess}
        </Alert>
      </Snackbar>
      
      {/* Error message */}
      <Snackbar 
        open={!!continueError} 
        autoHideDuration={6000} 
        onClose={handleErrorClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleErrorClose} severity="error">
          {continueError}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default EventLog;