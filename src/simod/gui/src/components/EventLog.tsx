import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, 
  Button, Stack, CircularProgress, Typography, Pagination, Box, Tooltip, 
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, 
  Alert, Snackbar
} from "@mui/material";
import { parseISO } from "date-fns";
import DateTimeRangePicker from "./DateTimeRangePicker";
import ActivitiesPopover from "./ActivitiesPopover";
import CasesPopover from "./CasesPopover";
import AttributePopover from "./AttributePopover";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FolderIcon from '@mui/icons-material/Folder';
import CategoryIcon from '@mui/icons-material/Category';
import TuneIcon from '@mui/icons-material/Tune';
import InfoIcon from '@mui/icons-material/Info';
import { useNavigate } from "react-router-dom";
//////##/////////////

const EventLog: React.FC = () => {
  // States for data management
  const [allEventLogs, setAllEventLogs] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  // Add min/max date states
  const [minLogDate, setMinLogDate] = useState<Date | null>(null);
  const [maxLogDate, setMaxLogDate] = useState<Date | null>(null);
  
  // States for filters
  const [activityAnchorEl, setActivityAnchorEl] = useState<null | HTMLElement>(null);
  const [caseAnchorEl, setCaseAnchorEl] = useState<null | HTMLElement>(null);
  const [attributeAnchorEl, setAttributeAnchorEl] = useState<null | HTMLElement>(null);
  const [allActivities, setAllActivities] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [allCaseIds, setAllCaseIds] = useState<string[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [attributeColumns, setAttributeColumns] = useState<string[]>([]);
  const [attributeFilters, setAttributeFilters] = useState<any[]>([]);
  
  // States for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  
  // States for Continue operations
  const [continueLoading, setContinueLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [continueSuccess, setContinueSuccess] = useState<string | null>(null);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterLoading, setFilterLoading] = useState(false);

  // Filter impact states - tracking records removed at each step
  const [dateRemovedCount, setDateRemovedCount] = useState<number>(0);
  const [activityRemovedCount, setActivityRemovedCount] = useState<number>(0);
  const [caseRemovedCount, setCaseRemovedCount] = useState<number>(0);
  const [attributeRemovedCount, setAttributeRemovedCount] = useState<number>(0);

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
      console.log("Resetting pipeline state...");
      await fetch("http://localhost:8000/pipeline/reset", {
        method: "POST"
      });
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
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    
    logs.forEach((row: any) => {
      if (row.activity) activitiesSet.add(row.activity);
      if (row.case_id !== undefined && row.case_id !== null) casesSet.add(row.case_id);
      
      // Extract dates - check all potential date fields
      const dateFields = ['start_time', 'end_time', 'enabled_time'];
      dateFields.forEach(field => {
        if (row[field]) {
          try {
            const date = parseISO(row[field]);
            if (!isNaN(date.getTime())) {
              if (!minDate || date < minDate) minDate = date;
              if (!maxDate || date > maxDate) maxDate = date;
            }
          } catch (e) {
            // Skip invalid dates
          }
        }
      });
    });
    
    setAllActivities(Array.from(activitiesSet) as string[]);
    setSelectedActivities(Array.from(activitiesSet) as string[]);
    setAllCaseIds(Array.from(casesSet) as string[]);
    setSelectedCaseIds(Array.from(casesSet) as string[]);
    
    // Set min and max dates for the date range picker
    setMinLogDate(minDate);
    setMaxLogDate(maxDate);
    
    // If date range isn't set yet, initialize it with the full log range
    if (!dateRange[0] || !dateRange[1]) {
      setDateRange([minDate, maxDate]);
    }
    
    // Calculate activity usage
    const activityUsage: { [activity: string]: number } = {};
    const casesWithActivity: { [activity: string]: Set<string> } = {};
    
    logs.forEach((row: any) => {
      if (row.activity && row.case_id !== undefined && row.case_id !== null) {
        if (!casesWithActivity[row.activity]) {
          casesWithActivity[row.activity] = new Set();
        }
        casesWithActivity[row.activity].add(row.case_id);
      }
    });
    
    // Convert sets to counts
    Object.keys(casesWithActivity).forEach(activity => {
      activityUsage[activity] = casesWithActivity[activity].size;
    });
    
    setActivityUsage(activityUsage);
    
    // Extract attribute columns (columns that come after timestamp columns)
    if (logs.length > 0) {
      const allColumns = Object.keys(logs[0]);
      const timestampColumns = ['start_time', 'end_time', 'enabled_time'];
      const systemColumns = ['case_id', 'activity', 'resource', 'role']; // Core system columns
      
      // Find attribute columns: columns that are not timestamp columns or system columns
      const attributeCols = allColumns.filter(col => 
        !timestampColumns.includes(col) && 
        !systemColumns.includes(col)
      );
      
      setAttributeColumns(attributeCols);
    }
  };

  // State for activity usage data
  const [activityUsage, setActivityUsage] = useState<{ [activity: string]: number }>({});

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
  }, [selectedActivities, selectedCaseIds, dateRange, attributeFilters]);

  // Move the cases calculation to a separate useMemo
  const casesWithExcludedActivities = useMemo(() => {
    // Always use case-level filtering logic for activities
    if (allActivities.length > selectedActivities.length) {
      const excludedActivities = allActivities.filter(activity => !selectedActivities.includes(activity));
      const casesSet = new Set<any>();
      
      // Find all cases that contain any excluded activities
      allEventLogs.forEach(log => {
        if (log.activity && 
            excludedActivities.includes(log.activity) && 
            log.case_id !== undefined && log.case_id !== null && 
            !casesSet.has(log.case_id)) {
          casesSet.add(log.case_id);
        }
      });
      
      return casesSet;
    }
    
    return new Set<any>();
  }, [allEventLogs, selectedActivities, allActivities]);

  // Helper function to check if a case passes attribute filters
  const passesAttributeFilters = useCallback((log: any) => {
    if (!attributeFilters.length) return true;
    
    return attributeFilters.every(filter => {
      const value = log[filter.column];
      
      if (value === undefined || value === null || value === '') {
        return true; // Skip filtering for missing values
      }
      
      if (filter.type === 'categorical') {
        return filter.selectedValues?.includes(String(value)) ?? true;
      } else if (filter.type === 'numeric') {
        const numValue = Number(value);
        if (isNaN(numValue)) return true;
        
        const [min, max] = filter.selectedRange || [filter.min || 0, filter.max || 100];
        return numValue >= min && numValue <= max;
      }
      
      return true;
    });
  }, [attributeFilters]);

  // Calculate filtered logs by applying date, activity, and status filters
  const filteredLogs = useMemo(() => {
    const [start, end] = dateRange;
    
    return allEventLogs.filter((log) => {
      // Case check
      const inCase = selectedCaseIds.length === 0 || 
                    (log.case_id !== undefined && log.case_id !== null && 
                     selectedCaseIds.includes(log.case_id));
      
      // For activity filtering, always exclude cases that have excluded activities
      const notInExcludedCases = log.case_id === undefined || log.case_id === null || 
                                !casesWithExcludedActivities.has(log.case_id);
      
      // Attribute filtering
      const passesAttributes = passesAttributeFilters(log);
      
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
      
      // Always use case-level filtering for activities and attributes
      return inCase && inDate && notInExcludedCases && passesAttributes;
    });
  }, [allEventLogs, dateRange, selectedActivities, selectedCaseIds, casesWithExcludedActivities, attributeFilters]);

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
  
  const navigate = useNavigate();

  // After confirming Continue operation
  const handleConfirmContinue = async () => {
  setConfirmDialogOpen(false);
  setContinueLoading(true);
  setContinueError(null);
  setContinueSuccess(null);

   const payload = {
        data: filteredLogs
    };

  try {

    const response = await fetch("http://localhost:8000/api/event-log/filtered", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
            // If the server returns an error (like 4xx or 5xx), throw an error.
            throw new Error(result.detail || `Server returned status ${response.status}`);
        }

        // --- STEP 2: Handle Success ---
        // The wrapper script will now see the 'completed_filtering' status and proceed.
        const successMsg = `Success! Simod will now continue with the filtered log (${result.row_count} records).`;
        setContinueSuccess(successMsg);
        console.log("Filtering successful:", result);

        // Optional: Navigate the user to a loading/waiting page after a short delay.
        setTimeout(() => {
            navigate("/loading"); // Or any other appropriate page
        }, 2000); // 2-second delay to let the user read the success message.

    } catch (err: any) {
        // --- STEP 3: Handle Errors ---
        console.error("Failed to save filtered log and continue:", err);
        setContinueError(err.message || "An unknown error occurred.");
    } finally {
        // --- STEP 4: Reset Loading State ---
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

  // Create wrapper functions for filters to show loading state

  // For activities filter
  const handleApplyActivities = (selected: string[]) => {
    setFilterLoading(true);
    setActivityAnchorEl(null);
    
    setTimeout(() => {
      setSelectedActivities(selected);
      setFilterLoading(false);
    }, 600);
  };

  // For cases filter
  const handleApplyCases = (selected: string[]) => {
    // First show loading
    setFilterLoading(true);
    
    // Close the popover immediately
    setCaseAnchorEl(null);
    
    // Then apply filter with a delay to ensure loading is visible
    setTimeout(() => {
      setSelectedCaseIds(selected);
      setFilterLoading(false);
    }, 600); // Longer timeout for visibility
  };

  // Add this handler for date range changes
  const handleDateRangeChange = (newRange: [Date | null, Date | null]) => {
    setFilterLoading(true);
    setTimeout(() => {
      setDateRange(newRange);
      setFilterLoading(false);
    }, 600);
  };

  // For attribute filters
  const handleApplyAttributeFilters = (filters: any[]) => {
    setFilterLoading(true);
    setAttributeAnchorEl(null);
    
    setTimeout(() => {
      setAttributeFilters(filters);
      setFilterLoading(false);
    }, 600);
  };

  // When opening the cases popover
  const openCasesPopover = (event: React.MouseEvent<HTMLElement>) => {
    setCaseAnchorEl(event.currentTarget);
  };

  // When closing the cases popover
  const closeCasesPopover = () => {
    setCaseAnchorEl(null);
  };

  // Add this function just before the return statement in your component
  const isFilterActive = () => {
    // If any filters are active, return true
    const allActivitiesSelected = selectedActivities.length === allActivities.length && 
      allActivities.every(a => selectedActivities.includes(a));
      
    const allCasesSelected = selectedCaseIds.length === allCaseIds.length && 
      allCaseIds.every(c => selectedCaseIds.includes(c));
    
    // Check date range - consider it unfiltered if it's the full range or not set
    let dateRangeIsFullRange = true;
    if (dateRange[0] && dateRange[1] && minLogDate && maxLogDate) {
      // Check if date range matches the min-max range (within 1 second tolerance)
      const startDiff = Math.abs(dateRange[0].getTime() - minLogDate.getTime());
      const endDiff = Math.abs(dateRange[1].getTime() - maxLogDate.getTime());
      dateRangeIsFullRange = startDiff < 1000 && endDiff < 1000;
    }
    
    // Check if attribute filters are active
    const attributeFiltersActive = attributeFilters.some(filter => {
      if (filter.type === 'categorical') {
        return (filter.selectedValues?.length || 0) < (filter.values?.length || 0);
      } else {
        return (filter.selectedRange?.[0] !== filter.min || filter.selectedRange?.[1] !== filter.max);
      }
    });
    
    return !allActivitiesSelected || !allCasesSelected || !dateRangeIsFullRange || attributeFiltersActive;
  };

  // Calculate filter impact - tracking records removed at each step
  useEffect(() => {
    if (allEventLogs.length === 0) return;

    let currentCount = allEventLogs.length;
    let dateRemoved = 0;
    let activityRemoved = 0;
    let attributeRemoved = 0;
    let caseRemoved = 0;

    // Step 1: Apply date filter
    const [start, end] = dateRange;
    let afterDateFilter = allEventLogs;
    
    if (start && end) {
      afterDateFilter = allEventLogs.filter(log => {
        if (!log.start_time) return true;
        try {
          const logDate = parseISO(log.start_time);
          return logDate.getTime() >= start.getTime() && logDate.getTime() <= end.getTime();
        } catch (e) {
          return true;
        }
      });
      dateRemoved = currentCount - afterDateFilter.length;
      currentCount = afterDateFilter.length;
    }

    // Step 2: Apply attribute filter (case-level)
    let afterAttributeFilter = afterDateFilter;
    const hasActiveAttributeFilters = attributeFilters.some(filter => {
      if (filter.type === 'categorical') {
        return (filter.selectedValues?.length || 0) < (filter.values?.length || 0);
      } else {
        return (filter.selectedRange?.[0] !== filter.min || filter.selectedRange?.[1] !== filter.max);
      }
    });
    
    if (hasActiveAttributeFilters) {
      afterAttributeFilter = afterDateFilter.filter(log => passesAttributeFilters(log));
      attributeRemoved = currentCount - afterAttributeFilter.length;
      currentCount = afterAttributeFilter.length;
    }

    // Step 3: Apply activity filter (case-level)
    let afterActivityFilter = afterAttributeFilter;
    if (selectedActivities.length < allActivities.length) {
      afterActivityFilter = afterAttributeFilter.filter(log => {
        return log.case_id === undefined || log.case_id === null || 
               !casesWithExcludedActivities.has(log.case_id);
      });
      activityRemoved = currentCount - afterActivityFilter.length;
      currentCount = afterActivityFilter.length;
    }

    // Step 4: Apply case filter
    let afterCaseFilter = afterActivityFilter;
    if (selectedCaseIds.length < allCaseIds.length) {
      afterCaseFilter = afterActivityFilter.filter(log => 
        log.case_id === undefined || log.case_id === null || 
        selectedCaseIds.includes(log.case_id)
      );
      caseRemoved = currentCount - afterCaseFilter.length;
    }

    // Update states
    setDateRemovedCount(dateRemoved);
    setActivityRemovedCount(activityRemoved);
    setAttributeRemovedCount(attributeRemoved);
    setCaseRemovedCount(caseRemoved);
  }, [allEventLogs, dateRange, selectedActivities, selectedCaseIds, 
      allActivities, allCaseIds, casesWithExcludedActivities, attributeFilters, passesAttributeFilters]);

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
          {/* Date range picker with loading indicator */}
          <Box position="relative" display="inline-block" sx={{ mr: 1, mb: 1 }}>
            <DateTimeRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              minDate={minLogDate}
              maxDate={maxLogDate}
            />
            {filterLoading && (
              <Box 
                position="absolute" 
                top="0" 
                left="0" 
                width="100%" 
                height="100%" 
                display="flex" 
                alignItems="center" 
                justifyContent="center"
                bgcolor="rgba(255,255,255,0.7)"
                borderRadius={1}
                zIndex={5}
              >
                <CircularProgress size={20} />
              </Box>
            )}
          </Box>

          {/* Activities button with loading indicator */}
          <Box position="relative" display="inline-block" sx={{ mr: 1, mb: 1 }}>
            <Button
              variant="outlined" 
              onClick={(e) => setActivityAnchorEl(e.currentTarget)}
              startIcon={<CategoryIcon />}
            >
              Activities {selectedActivities.length !== allActivities.length ? ` (${selectedActivities.length}/${allActivities.length})` : ''}
            </Button>
            {filterLoading && activityAnchorEl === null && (
              <Box 
                position="absolute" 
                top="0" 
                left="0" 
                width="100%" 
                height="100%" 
                display="flex" 
                alignItems="center" 
                justifyContent="center"
                bgcolor="rgba(255,255,255,0.7)"
                borderRadius={1}
                zIndex={5}
              >
                <CircularProgress size={20} />
              </Box>
            )}
          </Box>

          {/* Cases button with loading indicator */}
          <Box position="relative" display="inline-block" sx={{ mr: 1, mb: 1 }}>
            <Button
              variant="outlined"
              onClick={(e) => setCaseAnchorEl(e.currentTarget)}
              startIcon={<FolderIcon />}
            >
              Cases {selectedCaseIds.length !== allCaseIds.length ? ` (${selectedCaseIds.length}/${allCaseIds.length})` : ''}
            </Button>
            {filterLoading && caseAnchorEl === null && (
              <Box 
                position="absolute" 
                top="0" 
                left="0" 
                width="100%" 
                height="100%" 
                display="flex" 
                alignItems="center" 
                justifyContent="center"
                bgcolor="rgba(255,255,255,0.7)"
                borderRadius={1}
                zIndex={5}
              >
                <CircularProgress size={20} />
              </Box>
            )}
          </Box>

          {/* Attribute Filters button with loading indicator */}
          {attributeColumns.length > 0 && (
            <Box position="relative" display="inline-block" sx={{ mb: 1 }}>
              <Button
                variant="outlined"
                onClick={(e) => setAttributeAnchorEl(e.currentTarget)}
                startIcon={<TuneIcon />}
              >
                Attributes {attributeFilters.some(f => 
                  f.type === 'categorical' ? 
                    (f.selectedValues?.length || 0) < (f.values?.length || 0) :
                    (f.selectedRange?.[0] !== f.min || f.selectedRange?.[1] !== f.max)
                ) ? ' (filtered)' : ''}
              </Button>
              {filterLoading && attributeAnchorEl === null && (
                <Box 
                  position="absolute" 
                  top="0" 
                  left="0" 
                  width="100%" 
                  height="100%" 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center"
                  bgcolor="rgba(255,255,255,0.7)"
                  borderRadius={1}
                  zIndex={5}
                >
                  <CircularProgress size={20} />
                </Box>
              )}
            </Box>
          )}
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

      {/* Filtering summary with detailed tooltip */}
      {allEventLogs.length > 0 && (
        <Box sx={{ mb: 2, mt: -1, display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            {isFilterActive() ? (
              <>
                <b>Filter active:</b> Showing {filteredLogs.length} / {allEventLogs.length} records ({((filteredLogs.length / allEventLogs.length) * 100).toFixed(1)}%)
              </>
            ) : (
              <>
                <b>No filters active:</b> Showing all {allEventLogs.length} records (100%)
              </>
            )}
          </Typography>
          
          {/* Info icon with detailed filter tooltip */}
          {isFilterActive() && (
            <Tooltip 
              title={
                <div>
                  <b>Filter impact:</b><br />
                  {(() => {
                    const details = [];
                    if (dateRemovedCount > 0) details.push(`Time filter reduced records by ${dateRemovedCount}.`);
                    if (attributeRemovedCount > 0) details.push(`Attribute filter reduced records by ${attributeRemovedCount}.`);
                    if (activityRemovedCount > 0) details.push(`Activity filter reduced records by ${activityRemovedCount}.`);
                    if (caseRemovedCount > 0) details.push(`Case filter reduced records by ${caseRemovedCount}.`);
                    return details.length > 0 ? details.join(' ') : 'No records removed.';
                  })()}
                </div>
              } 
              arrow
            >
              <InfoIcon 
                color="info" 
                fontSize="small" 
                sx={{ ml: 1, cursor: 'pointer' }} 
              />
            </Tooltip>
          )}
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

      {filterLoading && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          bgcolor="rgba(255,255,255,0.7)"
          zIndex={1300}
        >
          <CircularProgress size={60} />
          <Typography variant="h6" style={{ marginTop: 16 }}>
            Applying Filters...
          </Typography>
        </Box>
      )}
      
      {/* Popovers */}
      <ActivitiesPopover
        open={Boolean(activityAnchorEl)}
        anchorEl={activityAnchorEl}
        activities={allActivities}
        selected={selectedActivities}
        onClose={() => setActivityAnchorEl(null)}
        onApply={handleApplyActivities}
        activityUsageData={activityUsage}
        allCaseIds={allCaseIds}
      />

      <CasesPopover
        open={Boolean(caseAnchorEl)}
        anchorEl={caseAnchorEl}
        cases={allCaseIds}
        selected={selectedCaseIds}
        onClose={() => setCaseAnchorEl(null)}
        onApply={handleApplyCases}
      />

      <AttributePopover
        open={Boolean(attributeAnchorEl)}
        anchorEl={attributeAnchorEl}
        eventLogs={allEventLogs}
        onClose={() => setAttributeAnchorEl(null)}
        onApply={handleApplyAttributeFilters}
        attributeColumns={attributeColumns}
      />
    </div>
  );
};

export default EventLog;