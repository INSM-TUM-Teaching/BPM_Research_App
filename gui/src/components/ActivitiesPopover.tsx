import React, { useState, useEffect } from "react";
import { 
  Popover, Paper, Checkbox, Button, Stack, List, ListItem, ListItemIcon, 
  ListItemText, Divider, Box, Typography, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  FormControl, RadioGroup, FormControlLabel, Radio
} from "@mui/material";
import { ButtonBase } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

// Export the ActivityFilterMode type
export type ActivityFilterMode = 'rows' | 'cases';

interface Props {
  anchorEl: HTMLElement | null;
  open: boolean;
  activities: string[];
  selected: string[];
  onClose: () => void;
  onApply: (selected: string[], filterMode?: ActivityFilterMode) => void;
  activityUsageData?: { [activity: string]: number };
  allCaseIds?: string[];
  filterMode?: ActivityFilterMode;
}

const ESSENTIAL_ACTIVITY_COLOR = '#900020';

const ActivitiesPopover: React.FC<Props> = ({ 
  anchorEl, 
  open, 
  activities, 
  selected, 
  onClose, 
  onApply,
  activityUsageData = {},
  allCaseIds = [],
  filterMode = 'rows'
}) => {
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [pendingSelection, setPendingSelection] = useState<string[]>([]);
  const [removedActivities, setRemovedActivities] = useState<string[]>([]);
  const [localFilterMode, setLocalFilterMode] = useState<ActivityFilterMode>(filterMode);

  // Calculate the total number of cases
  const totalCases = allCaseIds.length || 
    Math.max(...Object.values(activityUsageData), 0);

  // Function to calculate percentage
  const calculatePercentage = (count: number): string => {
    if (totalCases === 0) return "0%";
    const percentage = (count / totalCases) * 100;
    return `${percentage.toFixed(1)}%`;
  };

  // Function to check if an activity is essential (≥ 50% usage)
  const isEssentialActivity = (activity: string): boolean => {
    if (totalCases === 0) return false;
    const count = activityUsageData[activity] || 0;
    const percentage = (count / totalCases) * 100;
    return percentage >= 50;
  };

  useEffect(() => {
    setLocalSelected(selected);
  }, [selected]);
  
  useEffect(() => {
    setLocalFilterMode(filterMode);
  }, [filterMode]);

  const handleToggle = (activity: string) => {
    const newSelection = localSelected.includes(activity)
      ? localSelected.filter((a) => a !== activity) 
      : [...localSelected, activity];
    
    // If we're removing an activity, show confirmation
    if (localSelected.includes(activity)) {
      setPendingSelection(newSelection);
      setRemovedActivities([activity]);
      setShowConfirmDialog(true);
    } else {
      setLocalSelected(newSelection);
    }
  };

  // Modified to pass filter mode when applying
  const handleApply = () => {
    onApply(localSelected, localFilterMode);
  };

  const handleConfirmRemoval = () => {
    setShowConfirmDialog(false);
    setLocalSelected(pendingSelection);
  };

  const handleCancelRemoval = () => {
    setShowConfirmDialog(false);
    // Don't update the selection
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value.toLowerCase());
  };

  // Filter activities based on search query
  const filteredActivities = activities.filter(activity => {
    const activityStr = String(activity);
    return activityStr.toLowerCase().includes(searchQuery);
  });

  const allFilteredChecked = filteredActivities.length > 0 && 
    filteredActivities.every(activity => localSelected.includes(activity));
  
  const someFilteredChecked = filteredActivities.length > 0 &&
    filteredActivities.some(activity => localSelected.includes(activity)) && 
    !allFilteredChecked;

  // Toggle all filtered activities
  const toggleAllFiltered = () => {
    if (allFilteredChecked) {
      // We're removing activities, show confirmation
      const newSelection = localSelected.filter(item => !filteredActivities.includes(item));
      setPendingSelection(newSelection);
      setRemovedActivities(filteredActivities);
      setShowConfirmDialog(true);
    } else {
      // Add all filtered activities (no confirmation needed)
      const newSelection = [...localSelected];
      filteredActivities.forEach(activity => {
        if (!newSelection.includes(activity)) {
          newSelection.push(activity);
        }
      });
      setLocalSelected(newSelection);
    }
  };

  // Calculate total cases affected by removed activities
  const getCasesAffectedCount = (activities: string[]) => {
    const casesWithActivitiesOnly = new Set();
    
    activities.forEach(activity => {
      const caseCount = activityUsageData[activity] || 0;
      if (caseCount > 0) {
        // Just an approximation - in reality you need actual case IDs
        for (let i = 0; i < caseCount; i++) {
          casesWithActivitiesOnly.add(`case_${i}`);
        }
      }
    });
    
    return casesWithActivitiesOnly.size;
  };

  // Handle filter mode change
  const handleFilterModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalFilterMode(event.target.value as ActivityFilterMode);
  };

  return (
    <>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Paper style={{ padding: 16, minWidth: 300, maxHeight: 400, overflowY: "auto" }}>
          {/* Search Field */}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search activities..."
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
            flexDirection="column"
            mb={1}
          >
            <Box display="flex" alignItems="center" width="100%">
              <Checkbox
                checked={allFilteredChecked}
                indeterminate={someFilteredChecked}
                onChange={toggleAllFiltered}
              />
              <Typography fontWeight="bold">
                {searchQuery ? `Filtered Activities (${filteredActivities.length})` : "All Activities"}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ ml: 4, mt: -0.5, color: ESSENTIAL_ACTIVITY_COLOR }}>
              Essential activities (≥ 50% of cases) are red
            </Typography>
          </Box>

          <Divider />

          <List dense sx={{ maxHeight: 250, overflow: 'auto' }}>
            {filteredActivities.length > 0 ? (
              filteredActivities.map((activity) => (
                <ListItem
                  key={activity}
                  component={ButtonBase}
                  dense
                  onClick={() => handleToggle(activity)}
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={localSelected.includes(activity)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography 
                          variant="body2" 
                          color={isEssentialActivity(activity) ? ESSENTIAL_ACTIVITY_COLOR : 'inherit'}
                          fontWeight={isEssentialActivity(activity) ? 'medium' : 'normal'}
                        >
                          {activity}
                        </Typography>
                        {activityUsageData[activity] && (
                          <Typography 
                            variant="caption" 
                            color={isEssentialActivity(activity) ? ESSENTIAL_ACTIVITY_COLOR : 'textSecondary'}
                          >
                            {calculatePercentage(activityUsageData[activity])} of cases
                          </Typography>
                        )}
                      </Box>
                    } 
                  />
                </ListItem>
              ))
            ) : (
              <ListItem>
                <ListItemText primary="No matching activities found" />
              </ListItem>
            )}
          </List>

          <Divider style={{ marginTop: 8 }} />
          
          {/* Filter Mode Selection */}
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="subtitle2" display="flex" alignItems="center">
              <FilterAltIcon fontSize="small" sx={{ mr: 0.5 }} />
              Filter Mode:
            </Typography>
            <FormControl component="fieldset" size="small">
              <RadioGroup
                value={localFilterMode}
                onChange={handleFilterModeChange}
                row
              >
                <FormControlLabel 
                  value="rows" 
                  control={<Radio size="small" />} 
                  label={
                    <Typography variant="body2">
                      Filter rows only 
                      <Typography variant="caption" color="text.secondary" display="block">
                        Only hide rows with selected activities
                      </Typography>
                    </Typography>
                  }
                />
                <FormControlLabel 
                  value="cases" 
                  control={<Radio size="small" />} 
                  label={
                    <Typography variant="body2">
                      Filter entire cases
                      <Typography variant="caption" color="text.secondary" display="block">
                        Hide all rows from cases with these activities
                      </Typography>
                    </Typography>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Box>

          <Stack
            direction="row"
            justifyContent="space-between"
            spacing={1}
            mt={2}
          >
            <Typography variant="caption" color="textSecondary">
              {`Selected: ${localSelected.length}/${activities.length}`}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleApply}
              >
                Apply
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Popover>

      {/* Confirmation Dialog when removing activities */}
      <Dialog
        open={showConfirmDialog}
        onClose={handleCancelRemoval}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <WarningIcon color="warning" sx={{ mr: 1 }} />
            Remove {removedActivities.length > 1 ? 'Activities' : 'Activity'}?
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to remove the following {removedActivities.length > 1 ? 'activities' : 'activity'}:
          </DialogContentText>
          
          <List dense sx={{ mt: 1, bgcolor: '#f5f5f5', borderRadius: 1, p: 1 }}>
            {removedActivities.map(activity => (
              <ListItem key={activity}>
                <ListItemIcon>
                  <InfoIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary={<Typography
                    color={isEssentialActivity(activity) ? ESSENTIAL_ACTIVITY_COLOR : 'inherit'}
                    fontWeight={isEssentialActivity(activity) ? 'medium' : 'normal'}
                  >
                    {activity}
                  </Typography>}
                  secondary={`Found in ${calculatePercentage(activityUsageData[activity] || 0)} of cases`}
                />
              </ListItem>
            ))}
          </List>
          
          <Typography variant="body1" color="error" sx={{ mt: 2 }}>
            This will affect approximately {getCasesAffectedCount(removedActivities)} cases in your event log.
          </Typography>
          
          <Typography variant="body2" sx={{ mt: 1 }}>
            Are you sure you want to remove {removedActivities.length > 1 ? 'these activities' : 'this activity'} from your filter?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelRemoval}>No, Keep {removedActivities.length > 1 ? 'Them' : 'It'}</Button>
          <Button onClick={handleConfirmRemoval} variant="contained" color="primary">
            Yes, Remove {removedActivities.length > 1 ? 'Them' : 'It'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ActivitiesPopover;