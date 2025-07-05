import React, { useState, useEffect } from "react";
import { 
  Popover, Box, Checkbox, FormControlLabel, FormGroup, Button, Typography, 
  Divider, TextField, InputAdornment, List, ListItem, ListItemIcon, ListItemText 
} from "@mui/material";
import { ButtonBase } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';

interface Props {
  open: boolean;
  anchorEl: HTMLElement | null;
  cases: string[];
  selected: string[];
  onClose: () => void;
  onApply: (selected: string[]) => void;
}

const CasesPopover: React.FC<Props> = ({ open, anchorEl, cases, selected, onClose, onApply }) => {
  const [localSelection, setLocalSelection] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    setLocalSelection(selected);
  }, [selected]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value.toLowerCase());
  };

  // Filter cases based on search query
  const filteredCases = cases.filter(caseId => {
  
    const caseIdStr = String(caseId);
    return caseIdStr.toLowerCase().includes(searchQuery);
  });

  const toggleCase = (caseId: string) => {
    setLocalSelection((prev) => (prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]));
  };

  const allFilteredChecked = filteredCases.length > 0 && 
    filteredCases.every(caseId => localSelection.includes(caseId));
  
  const someFilteredChecked = filteredCases.length > 0 &&
    filteredCases.some(caseId => localSelection.includes(caseId)) && 
    !allFilteredChecked;
  
  // Toggle all filtered cases
  const toggleAllFiltered = () => {
    if (allFilteredChecked) {
      // Remove all filtered cases
      setLocalSelection(prev => prev.filter(item => !filteredCases.includes(item)));
    } else {
      // Add all filtered cases
      const newSelection = [...localSelection];
      filteredCases.forEach(caseId => {
        if (!newSelection.includes(caseId)) {
          newSelection.push(caseId);
        }
      });
      setLocalSelection(newSelection);
    }
  };

  // Update the handleApply function to call onApply and then close
  const handleApply = () => {
    onApply(localSelection);
    // Don't close the popover here - the parent component will handle it
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
    >
      <Box width={320}>
        <Box p={2}>
          {/* Search Field */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search cases..."
            size="small"
            value={searchQuery}
            onChange={handleSearchChange}
            sx={{ mb: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
          <Box
            display="flex"
            alignItems="center"
            mt={1}
          >
            <Checkbox
              checked={allFilteredChecked}
              indeterminate={someFilteredChecked}
              onChange={toggleAllFiltered}
            />
            <Typography fontWeight="bold">
              {searchQuery ? `Filtered Cases (${filteredCases.length})` : "All Cases"}
            </Typography>
          </Box>
        </Box>

        <Divider />

        {/* Scrollable checkbox list */}
        <Box
          px={2}
          style={{ maxHeight: 300, overflowY: "auto" }}
        >
          <List dense>
            {filteredCases.length > 0 ? (
              filteredCases.map((caseId) => (
                <ListItem
                  key={String(caseId)}  // Make sure key is a string
                  component={ButtonBase}
                  dense
                  onClick={() => toggleCase(caseId)}
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={localSelection.includes(caseId)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText primary={String(caseId)} /> 
                </ListItem>
              ))
            ) : (
              <ListItem>
                <ListItemText primary="No matching cases found" />
              </ListItem>
            )}
          </List>
        </Box>

        <Divider />

        {/* Sticky footer for Apply */}
        <Box
          p={2}
          display="flex"
          justifyContent="space-between"
          sx={{ bgcolor: "background.paper" }}
        >
          <Typography variant="caption" color="textSecondary">
            {`Selected: ${localSelection.length}/${cases.length}`}
          </Typography>
          <Button
            variant="contained"
            onClick={handleApply}
          >
            Apply
          </Button>
        </Box>
      </Box>
    </Popover>
  );
};

export default CasesPopover;