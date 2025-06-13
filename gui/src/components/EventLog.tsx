import React, { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Stack, CircularProgress, Typography } from "@mui/material";
import { parseISO } from "date-fns";
import DateTimeRangePicker from "./DateTimeRangePicker";
import ActivitiesPopover from "./ActivitiesPopover";
import CasesPopover from "./CasesPopover";

const EventLog: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingFilter, setLoadingFilter] = useState(false);

  const [activityAnchorEl, setActivityAnchorEl] = useState<null | HTMLElement>(null);
  const [caseAnchorEl, setCaseAnchorEl] = useState<null | HTMLElement>(null);
  const [allActivities, setAllActivities] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [allCaseIds, setAllCaseIds] = useState<string[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingCsv(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        if (data.length > 0) {
          setHeaders(Object.keys(data[0]));
          setLogs(data);

          const activitiesSet = new Set<string>();
          const casesSet = new Set<string>();

          data.forEach((row) => {
            activitiesSet.add(row.activity);
            casesSet.add(row.case_id);
          });

          const uniqueActivities = Array.from(activitiesSet);
          const uniqueCases = Array.from(casesSet);

          setAllActivities(uniqueActivities);
          setSelectedActivities(uniqueActivities);
          setAllCaseIds(uniqueCases);
          setSelectedCaseIds(uniqueCases);
        }
        setLoadingCsv(false);
      },
    });
  };

  const filteredLogs = useMemo(() => {
    const [start, end] = dateRange;
    setLoadingFilter(true);

    const filtered = logs.filter((log) => {
      const inActivity = selectedActivities.includes(log.activity);
      const inCase = selectedCaseIds.includes(log.case_id);
      const inDate = !start || !end || (parseISO(log.start_time).getTime() >= start.getTime() && parseISO(log.start_time).getTime() <= end.getTime());
      return inActivity && inCase && inDate;
    });

    setTimeout(() => setLoadingFilter(false), 300);
    return filtered;
  }, [logs, dateRange, selectedActivities, selectedCaseIds]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px" }}>
      <Stack
        direction="row"
        spacing={2}
        style={{ marginBottom: "16px", flexWrap: "wrap" }}
      >
        <Button
          variant="contained"
          color="primary"
          onClick={(e) => setActivityAnchorEl(e.currentTarget)}
        >
          Activities
        </Button>

        <Button
          variant="contained"
          color="secondary"
          onClick={(e) => setCaseAnchorEl(e.currentTarget)}
        >
          Cases
        </Button>

        <DateTimeRangePicker
          value={dateRange}
          onChange={setDateRange}
        />

        <Button
          variant="contained"
          component="label"
        >
          Load CSV
          <input
            type="file"
            accept=".csv"
            hidden
            onChange={handleFileUpload}
          />
        </Button>
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

      {loadingCsv || loadingFilter ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            width: "100vw",
            backgroundColor: "rgba(255, 255, 255, 0.6)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <CircularProgress size={70} />
          <Typography
            variant="h6"
            style={{ marginTop: 16 }}
          >
            {loadingCsv ? "CSV yükleniyor..." : "Filtre uygulanıyor..."}
          </Typography>
        </div>
      ) : (
        filteredLogs.length > 0 && (
          <TableContainer
            component={Paper}
            style={{ width: "90%", maxHeight: "80%", overflowX: "auto" }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableCell
                      key={header}
                      style={{ fontWeight: "bold" }}
                    >
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLogs.map((row, idx) => (
                  <TableRow key={idx}>
                    {headers.map((header) => (
                      <TableCell key={header}>{row[header]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}
    </div>
  );
};

export default EventLog;
