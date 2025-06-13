import React, { useState, useEffect } from "react";
import { Popover, Paper, Checkbox, Button, Stack, List, ListItem, ListItemIcon, ListItemText, Divider, Box, Typography } from "@mui/material";
import { ButtonBase } from "@mui/material";
interface Props {
  anchorEl: HTMLElement | null;
  open: boolean;
  activities: string[];
  selected: string[];
  onClose: () => void;
  onApply: (selected: string[]) => void;
}

const ActivitiesPopover: React.FC<Props> = ({ anchorEl, open, activities, selected, onClose, onApply }) => {
  const [localSelected, setLocalSelected] = useState<string[]>([]);

  useEffect(() => {
    setLocalSelected(selected);
  }, [selected]);

  const handleToggle = (activity: string) => {
    setLocalSelected((prev) => (prev.includes(activity) ? prev.filter((a) => a !== activity) : [...prev, activity]));
  };

  const handleApply = () => {
    onApply(localSelected);
    onClose();
  };

  const allChecked = localSelected.length === activities.length;
  const someChecked = localSelected.length > 0 && localSelected.length < activities.length;

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
    >
      <Paper style={{ padding: 16, minWidth: 300, maxHeight: 400, overflowY: "auto" }}>
        <Box
          display="flex"
          alignItems="center"
          mb={1}
        >
          <Checkbox
            checked={allChecked}
            indeterminate={someChecked}
            onChange={(e) => setLocalSelected(e.target.checked ? activities : [])}
          />
          <Typography fontWeight="bold">Tüm Aktiviteler</Typography>
        </Box>

        <Divider />

        <List dense>
          {activities.map((activity) => (
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
              <ListItemText primary={activity} />
            </ListItem>
          ))}
        </List>

        <Divider style={{ marginTop: 8 }} />

        <Stack
          direction="row"
          justifyContent="flex-end"
          spacing={1}
          mt={2}
        >
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleApply}
          >
            Apply
          </Button>
        </Stack>
      </Paper>
    </Popover>
  );
};

export default ActivitiesPopover;
