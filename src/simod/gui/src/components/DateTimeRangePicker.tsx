import React, { useRef, useState, useEffect } from "react";
import { DateRange } from "react-date-range";
import { enUS } from "date-fns/locale";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { 
  Box, 
  TextField, 
  Popper, 
  ClickAwayListener, 
  Button, 
  Stack, 
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from "@mui/material";
import { format, differenceInDays } from "date-fns";
import WarningIcon from '@mui/icons-material/Warning';

interface Props {
  value: [Date | null, Date | null];
  onChange: (range: [Date | null, Date | null]) => void;
  minDate: Date | null;
  maxDate: Date | null;
}

const DateTimeRangePicker: React.FC<Props> = ({ value, onChange, minDate, maxDate }) => {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState<[Date, Date]>([
    value[0] ?? (minDate ?? new Date()),
    value[1] ?? (maxDate ?? new Date())
  ]);
  
  // Add state for narrow timeframe warning
  const [showNarrowTimeframeWarning, setShowNarrowTimeframeWarning] = useState(false);
  const [pendingRange, setPendingRange] = useState<[Date, Date] | null>(null);
  
  // Update temp range when value changes externally
  useEffect(() => {
    if (value[0] && value[1]) {
      setTempRange([value[0], value[1]]);
    }
  }, [value]);

  // Close the popper when warning dialog opens
  useEffect(() => {
    if (showNarrowTimeframeWarning) {
      setOpen(false);
    }
  }, [showNarrowTimeframeWarning]);

  const toggleOpen = () => {
    // Initialize with current values or min/max log dates
    setTempRange([
      value[0] ?? (minDate ?? new Date()),
      value[1] ?? (maxDate ?? new Date())
    ]);
    setOpen((prev) => !prev);
  };
  
  const close = () => setOpen(false);

  const handleSelect = (ranges: any) => {
    const range = ranges.selection;
    setTempRange([range.startDate, range.endDate]);
  };

  // Function to check if selected range is too narrow
  const isRangeTooNarrow = (startDate: Date, endDate: Date): boolean => {
    const daysDifference = differenceInDays(endDate, startDate);
    return daysDifference < 7; // Less than 7 days is considered too narrow
  };

  const handleApply = () => {
    // Check if the selected range is too narrow
    if (isRangeTooNarrow(tempRange[0], tempRange[1])) {
      setPendingRange(tempRange);
      // First close the popper, then show the dialog
      setOpen(false);
      // Use setTimeout to ensure popper is closed before dialog opens
      setTimeout(() => {
        setShowNarrowTimeframeWarning(true);
      }, 100);
    } else {
      // Range is acceptable, apply it directly
      onChange(tempRange);
      close();
    }
  };

  // Handle confirm on narrow timeframe warning
  const handleConfirmNarrowTimeframe = () => {
    if (pendingRange) {
      onChange(pendingRange);
      setPendingRange(null);
    }
    setShowNarrowTimeframeWarning(false);
  };

  // Handle cancel on narrow timeframe warning
  const handleCancelNarrowTimeframe = () => {
    setShowNarrowTimeframeWarning(false);
    setPendingRange(null);
    // We don't reopen the picker here - user needs to click again if they want to
  };

  const handleClear = () => {
    // Reset to min/max log dates
    if (minDate && maxDate) {
      const newRange: [Date | null, Date | null] = [minDate, maxDate];
      onChange(newRange);
    }
    close();
  };

  // Format display text
  let formatted = "Select Time Range";
  if (value[0] && value[1]) {
    formatted = `${format(value[0], "yyyy-MM-dd")} → ${format(value[1], "yyyy-MM-dd")}`;
    
    // Check if using full date range
    const isFullRange = minDate && maxDate && 
                        value[0].getTime() <= minDate.getTime() && 
                        value[1].getTime() >= maxDate.getTime();
    
    if (isFullRange) {
      formatted = "Full Date Range";
    }
  }

  return (
    <Box>
      <TextField
        inputRef={anchorRef}
        value={formatted}
        onClick={toggleOpen}
        inputProps={{ readOnly: true }}
        size="small"
        variant="outlined"
        style={{ minWidth: 250 }}
        disabled={!minDate || !maxDate}
      />

      {/* Date Range Picker Popper */}
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        modifiers={[{ name: "zIndex", enabled: true }]}
        sx={{ zIndex: 1200 }}  // Lower z-index than dialog
      >
        <ClickAwayListener onClickAway={close}>
          <Box sx={{ bgcolor: "background.paper", p: 2, border: "1px solid #ccc" }}>
            <DateRange
              onChange={handleSelect}
              moveRangeOnFirstSelection={false}
              editableDateInputs={true}
              locale={enUS}
              ranges={[
                {
                  startDate: tempRange[0],
                  endDate: tempRange[1],
                  key: "selection",
                },
              ]}
              direction="horizontal"
              minDate={minDate ?? undefined}
              maxDate={maxDate ?? undefined}
            />
            <Stack
              direction="row"
              spacing={2}
              justifyContent="space-between"
              mt={2}
            >
              <Button
                onClick={handleClear}
                size="small"
                variant="outlined"
              >
                Reset to Full Range
              </Button>
              <Stack direction="row" spacing={1}>
                <Button
                  onClick={close}
                  size="small"
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleApply}
                  size="small"
                >
                  Apply
                </Button>
              </Stack>
            </Stack>
          </Box>
        </ClickAwayListener>
      </Popper>

      {/* Narrow Timeframe Warning Dialog */}
      <Dialog
        open={showNarrowTimeframeWarning}
        onClose={handleCancelNarrowTimeframe}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        sx={{ zIndex: 1300 }}  // Higher z-index than popper
      >
        <DialogTitle id="alert-dialog-title" sx={{ display: 'flex', alignItems: 'center' }}>
          <WarningIcon color="warning" sx={{ mr: 1 }} />
          Narrow Timeframe Warning
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            You have selected a very narrow timeframe (less than 7 days):
            <Box sx={{ mt: 1, mb: 2, fontWeight: 'bold' }}>
              {pendingRange && `${format(pendingRange[0], "yyyy-MM-dd")} → ${format(pendingRange[1], "yyyy-MM-dd")}`}
            </Box>
            
            This may significantly reduce your dataset and could affect analysis results.
            Are you sure you want to apply this filter?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelNarrowTimeframe}>
            Cancel
          </Button>
          <Button onClick={handleConfirmNarrowTimeframe} variant="contained" color="warning" autoFocus>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DateTimeRangePicker;