import React, { useState, useEffect } from "react";
import { Popover, Box, Checkbox, FormControlLabel, FormGroup, Button, Typography, Divider } from "@mui/material";

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

  useEffect(() => {
    // setLocalSelection(selected); This selects all
    setLocalSelection([]);
  }, [selected]);

  const toggleCase = (caseId: string) => {
    setLocalSelection((prev) => (prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]));
  };

  const handleApply = () => {
    onApply(localSelection);
    onClose();
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
          <Typography
            variant="subtitle1"
            fontWeight="bold"
            gutterBottom
          >
            Select Cases
          </Typography>
        </Box>

        {/* Scrollable checkbox list */}
        <Box
          px={2}
          style={{ maxHeight: 300, overflowY: "auto" }}
        >
          <FormGroup>
            {cases.map((caseId) => (
              <FormControlLabel
                key={caseId}
                control={
                  <Checkbox
                    checked={localSelection.includes(caseId)}
                    onChange={() => toggleCase(caseId)}
                  />
                }
                label={caseId}
              />
            ))}
          </FormGroup>
        </Box>

        <Divider />

        {/* Sticky footer for Apply */}
        <Box
          p={2}
          display="flex"
          justifyContent="flex-end"
          sx={{ bgcolor: "background.paper" }}
        >
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
