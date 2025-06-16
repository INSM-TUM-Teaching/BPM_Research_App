import React, { useState, useEffect } from "react";
import { 
  Popover, Paper, Checkbox, Button, Stack, List, ListItem, ListItemIcon, 
  ListItemText, Divider, Box, Typography, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from "@mui/material";
import { ButtonBase } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';

interface Props {
  anchorEl: HTMLElement | null;
  open: boolean;
  activities: string[];
  selected: string[];
  onClose: () => void;
  onApply: (selected: string[]) => void;
  activityUsageData?: { [activity: string]: number };
  allCaseIds?: string[];
}

const ActivitiesPopover: React.FC<Props> = ({ 
  anchorEl, 
  open, 
  activities, 
  selected, 
  onClose, 
  onApply,
  activityUsageData = {},
  allCaseIds = []
}) => {
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [pendingSelection, setPendingSelection] = useState<string[]>([]);
  const [removedActivities, setRemovedActivities] = useState<string[]>([]);

  useEffect(() => {
    setLocalSelected(selected);
  }, [selected]);

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

  // Modified to not show confirmation when applying
  const handleApply = () => {
    // Just apply the changes directly without confirmation
    onApply(localSelected);
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
            alignItems="center"
            mb={1}
          >
            <Checkbox
              checked={allFilteredChecked}
              indeterminate={someFilteredChecked}
              onChange={toggleAllFiltered}
            />
            <Typography fontWeight="bold">
              {searchQuery ? `Filtered Activities (${filteredActivities.length})` : "All Activities"}
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
                        <Typography variant="body2">{activity}</Typography>
                        {activityUsageData[activity] && (
                          <Typography variant="caption" color="textSecondary">
                            {activityUsageData[activity]} cases
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
                  primary={activity}
                  secondary={`Found in ${activityUsageData[activity] || 0} cases`}
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