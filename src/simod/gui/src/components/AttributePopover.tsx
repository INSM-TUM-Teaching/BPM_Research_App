import React, { useState, useEffect } from "react";
import { 
  Popover, Paper, Checkbox, Button, Stack, List, ListItem, ListItemText, 
  Divider, Box, Typography, TextField, InputAdornment, Slider, Accordion,
  AccordionSummary, AccordionDetails, Tooltip, FormControlLabel
} from "@mui/material";
import { ButtonBase } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface AttributeFilter {
  column: string;
  type: 'categorical' | 'numeric';
  values?: string[]; // For categorical
  selectedValues?: string[]; // For categorical
  range?: [number, number]; // For numeric
  selectedRange?: [number, number]; // For numeric
  min?: number; // For numeric
  max?: number; // For numeric
}

interface Props {
  anchorEl: HTMLElement | null;
  open: boolean;
  eventLogs: any[];
  onClose: () => void;
  onApply: (filters: AttributeFilter[]) => void;
  attributeColumns: string[];
}

const AttributePopover: React.FC<Props> = ({ 
  anchorEl, 
  open, 
  eventLogs,
  onClose, 
  onApply,
  attributeColumns
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [attributeFilters, setAttributeFilters] = useState<AttributeFilter[]>([]);

  // Initialize attribute filters when component mounts or data changes
  useEffect(() => {
    if (eventLogs.length === 0 || attributeColumns.length === 0) {
      setAttributeFilters([]);
      return;
    }

    const filters: AttributeFilter[] = attributeColumns.map(column => {
      const values = eventLogs
        .map(log => log[column])
        .filter(val => val !== undefined && val !== null && val !== '');
      
      // Check if column is numeric
      const numericValues = values.map(val => Number(val)).filter(val => !isNaN(val));
      const isNumeric = numericValues.length > 0 && numericValues.length === values.length;
      
      if (isNumeric) {
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        return {
          column,
          type: 'numeric',
          min,
          max,
          range: [min, max],
          selectedRange: [min, max]
        };
      } else {
        const uniqueValues = Array.from(new Set(values.map(String))).sort();
        return {
          column,
          type: 'categorical',
          values: uniqueValues,
          selectedValues: [...uniqueValues]
        };
      }
    });

    setAttributeFilters(filters);
  }, [eventLogs, attributeColumns]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value.toLowerCase());
  };

  // Filter attributes based on search query
  const filteredAttributes = attributeFilters.filter(filter => {
    return filter.column.toLowerCase().includes(searchQuery);
  });

  const handleCategoricalChange = (column: string, value: string, checked: boolean) => {
    setAttributeFilters(prev => prev.map(filter => {
      if (filter.column === column && filter.type === 'categorical') {
        const newSelectedValues = checked 
          ? [...(filter.selectedValues || []), value]
          : (filter.selectedValues || []).filter(v => v !== value);
        return { ...filter, selectedValues: newSelectedValues };
      }
      return filter;
    }));
  };

  const handleNumericChange = (column: string, newRange: number | number[]) => {
    const range = Array.isArray(newRange) ? newRange : [newRange, newRange];
    setAttributeFilters(prev => prev.map(filter => {
      if (filter.column === column && filter.type === 'numeric') {
        return { ...filter, selectedRange: [range[0], range[1]] };
      }
      return filter;
    }));
  };

  const handleSelectAllCategorical = (column: string, selectAll: boolean) => {
    setAttributeFilters(prev => prev.map(filter => {
      if (filter.column === column && filter.type === 'categorical') {
        return { 
          ...filter, 
          selectedValues: selectAll ? [...(filter.values || [])] : [] 
        };
      }
      return filter;
    }));
  };

  const handleApply = () => {
    onApply(attributeFilters);
    onClose();
  };

  const handleReset = () => {
    // Reset all filters to their default values
    setAttributeFilters(prev => prev.map(filter => {
      if (filter.type === 'categorical') {
        return { ...filter, selectedValues: [...(filter.values || [])] };
      } else {
        return { ...filter, selectedRange: [filter.min || 0, filter.max || 0] };
      }
    }));
  };

  const getActiveFiltersCount = () => {
    return attributeFilters.filter(filter => {
      if (filter.type === 'categorical') {
        return (filter.selectedValues?.length || 0) < (filter.values?.length || 0);
      } else {
        return (filter.selectedRange?.[0] !== filter.min || filter.selectedRange?.[1] !== filter.max);
      }
    }).length;
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
    >
      <Paper style={{ padding: 16, minWidth: 400, maxHeight: 600, overflowY: "auto" }}>
        {/* Header */}
        <Box display="flex" alignItems="center" mb={2}>
          <Typography variant="h6" component="h2" flexGrow={1}>
            Attribute Filters
          </Typography>
          <Tooltip title="Filter by case-level attributes. When you exclude values, all cases (and their events) with those values will be removed from the event log." arrow>
            <InfoIcon color="info" fontSize="small" sx={{ ml: 1 }} />
          </Tooltip>
        </Box>

        {/* Search Field */}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search attributes..."
          size="small"
          value={searchQuery}
          onChange={handleSearchChange}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        {/* Info Box */}
        <Box sx={{ mb: 2, p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1, border: '1px solid #bbdefb' }}>
          <Typography variant="body2" color="text.secondary" display="flex" alignItems="flex-start">
            <InfoIcon fontSize="small" sx={{ mr: 0.5, mt: 0.1, color: 'primary.main' }} />
            Case-level filtering: Excluding attribute values removes entire cases (all events for those cases) from the log.
          </Typography>
        </Box>

        {/* Attribute Filters */}
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {attributeColumns.length === 0 ? (
            /* No attributes detected message */
            <Box sx={{ 
              textAlign: 'center', 
              py: 4, 
              px: 2, 
              bgcolor: '#fff3e0', 
              borderRadius: 1, 
              border: '1px solid #ffcc02' 
            }}>
              <InfoIcon sx={{ fontSize: 48, color: '#ff9800', mb: 2 }} />
              <Typography variant="h6" gutterBottom color="text.primary">
                No Attributes Detected
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No attribute columns were found in your event log after the timestamp columns.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Possible reasons:</strong>
                <br />• Your event log format may not be compatible
                <br />• No case-level attributes exist in the data
              </Typography>
              <Typography variant="caption" sx={{ mt: 2, display: 'block', fontStyle: 'italic' }}>
                Attribute columns should come after timestamp columns (like start_time, end_time) 
                and represent case-level properties (age, priority, department, etc.)
              </Typography>
            </Box>
          ) : filteredAttributes.length > 0 ? (
            filteredAttributes.map((filter) => (
              <Accordion key={filter.column} defaultExpanded={filteredAttributes.length <= 3}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" width="100%">
                    <Typography variant="subtitle1" flexGrow={1}>
                      {filter.column}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {filter.type === 'categorical' 
                        ? `${filter.selectedValues?.length || 0}/${filter.values?.length || 0} selected`
                        : `${filter.selectedRange?.[0] || 0}–${filter.selectedRange?.[1] || 0}`
                      }
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {filter.type === 'categorical' ? (
                    <Box>
                      {/* Select All/None for categorical */}
                      <Box display="flex" gap={1} mb={1}>
                        <Button 
                          size="small" 
                          onClick={() => handleSelectAllCategorical(filter.column, true)}
                          disabled={filter.selectedValues?.length === filter.values?.length}
                        >
                          Select All
                        </Button>
                        <Button 
                          size="small" 
                          onClick={() => handleSelectAllCategorical(filter.column, false)}
                          disabled={filter.selectedValues?.length === 0}
                        >
                          Clear All
                        </Button>
                      </Box>
                      
                      {/* Categorical values */}
                      <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {filter.values?.map((value) => (
                          <ListItem key={value} dense>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={filter.selectedValues?.includes(value) || false}
                                  onChange={(e) => handleCategoricalChange(filter.column, value, e.target.checked)}
                                  size="small"
                                />
                              }
                              label={
                                <Typography variant="body2">
                                  {value}
                                </Typography>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  ) : (
                    <Box>
                      {/* Numeric range slider */}
                      <Typography variant="body2" color="textSecondary" mb={1}>
                        Range: {filter.min} – {filter.max}
                      </Typography>
                      
                      <Box px={1}>
                        <Slider
                          value={filter.selectedRange || [filter.min || 0, filter.max || 0]}
                          onChange={(_, newValue) => handleNumericChange(filter.column, newValue)}
                          valueLabelDisplay="auto"
                          min={filter.min || 0}
                          max={filter.max || 100}
                          marks={[
                            { value: filter.min || 0, label: String(filter.min || 0) },
                            { value: filter.max || 100, label: String(filter.max || 100) }
                          ]}
                        />
                      </Box>
                      
                      <Typography variant="body2" color="primary" mt={1}>
                        Selected: {filter.selectedRange?.[0]} – {filter.selectedRange?.[1]}
                        {filter.selectedRange?.[0] === filter.selectedRange?.[1] && (
                          <span style={{ marginLeft: 8, fontStyle: 'italic' }}>
                            (exact value)
                          </span>
                        )}
                      </Typography>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            ))
          ) : (
            <Typography variant="body2" color="textSecondary" textAlign="center" py={2}>
              {searchQuery ? 'No matching attributes found' : 'No attribute columns found'}
            </Typography>
          )}
        </Box>

        <Divider style={{ marginTop: 16, marginBottom: 16 }} />
        
        {/* Action Buttons */}
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          {attributeColumns.length === 0 ? (
            /* No attributes - only show close button */
            <Box sx={{ width: '100%', textAlign: 'center' }}>
              <Button variant="outlined" onClick={onClose} sx={{ minWidth: 120 }}>
                Close
              </Button>
            </Box>
          ) : (
            /* Normal attribute filtering buttons */
            <>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  {getActiveFiltersCount()} filter{getActiveFiltersCount() !== 1 ? 's' : ''} active
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button onClick={handleReset} disabled={getActiveFiltersCount() === 0}>
                  Reset
                </Button>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleApply}>
                  Apply
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </Paper>
    </Popover>
  );
};

export default AttributePopover;
