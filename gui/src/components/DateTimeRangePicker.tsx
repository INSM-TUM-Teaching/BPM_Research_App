import React, { useRef, useState } from "react";
import { DateRange } from "react-date-range";
import { enUS } from "date-fns/locale";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { Box, TextField, Popper, ClickAwayListener, Button, Stack } from "@mui/material";
import { format } from "date-fns";

interface Props {
  value: [Date | null, Date | null];
  onChange: (range: [Date | null, Date | null]) => void;
}

const DateTimeRangePicker: React.FC<Props> = ({ value, onChange }) => {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [tempRange, setTempRange] = useState<[Date, Date]>([value[0] ?? new Date(), value[1] ?? new Date()]);

  const toggleOpen = () => {
    setTempRange([value[0] ?? new Date(), value[1] ?? new Date()]); // reset temp on open
    setOpen((prev) => !prev);
  };
  const close = () => setOpen(false);

  const handleSelect = (ranges: any) => {
    const range = ranges.selection;
    setTempRange([range.startDate, range.endDate]);
  };

  const handleApply = () => {
    onChange(tempRange);
    close();
  };

  const formatted = value[0] && value[1] ? `${format(value[0], "yyyy-MM-dd")} → ${format(value[1], "yyyy-MM-dd")}` : "Select Time Range";

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
      />

      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        modifiers={[{ name: "zIndex", enabled: true }]}
        sx={{ zIndex: 1500 }}
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
            />
            <Stack
              direction="row"
              spacing={2}
              justifyContent="flex-end"
              mt={2}
            >
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
          </Box>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
};

export default DateTimeRangePicker;
