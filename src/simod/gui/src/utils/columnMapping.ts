export const CASE_ID_VARIANTS = [
  'case_id', 'case id', 'caseid', 'case-id',
  'Case_ID', 'Case ID', 'CaseID', 'Case-ID',
  'Case_Id', 'Case Id', 'CaseId', 'Case-Id',
  'CASE_ID', 'CASE ID', 'CASE-ID', 'CASEID'
];

export const ACTIVITY_VARIANTS = [
  'activity', 'Activity', 'ACTIVITY',
  'activity_name', 'Activity_Name', 'ActivityName', 'ACTIVITY_NAME',
  'task', 'Task', 'TASK',
  'event', 'Event', 'EVENT'
];

export const RESOURCE_VARIANTS = [
  'resource', 'Resource', 'RESOURCE',
  'user', 'User', 'USER',
  'performer', 'Performer', 'PERFORMER',
  'actor', 'Actor', 'ACTOR'
];

export const ROLE_VARIANTS = [
  'role', 'Role', 'ROLE',
  'position', 'Position', 'POSITION',
  'group', 'Group', 'GROUP'
];

export const TIME_COLUMN_SUFFIXES = [
  '_time', '_Time', '_TIME',
  'time', 'Time', 'TIME',
  'timestamp', 'Timestamp', 'TIMESTAMP',
  '_ts', '_TS'
];

/**
 * Case-insensitive column matching function
 * Normalizes both the column name and variant for comparison
 */
const normalizeColumnName = (name: string): string => {
  return name.toLowerCase().replace(/[_\s-]/g, '');
};

/**
 * Finds the actual column name for case ID from the data (case-insensitive)
 */
export const findCaseIdColumn = (columns: string[]): string | null => {
  for (const variant of CASE_ID_VARIANTS) {
    const normalizedVariant = normalizeColumnName(variant);
    const found = columns.find(col => 
      normalizeColumnName(col) === normalizedVariant
    );
    if (found) return found;
  }
  return null;
};

/**
 * Finds the actual column name for activity from the data (case-insensitive)
 */
export const findActivityColumn = (columns: string[]): string | null => {
  for (const variant of ACTIVITY_VARIANTS) {
    const normalizedVariant = normalizeColumnName(variant);
    const found = columns.find(col => 
      normalizeColumnName(col) === normalizedVariant
    );
    if (found) return found;
  }
  return null;
};

/**
 * Finds the actual column name for resource from the data (case-insensitive)
 */
export const findResourceColumn = (columns: string[]): string | null => {
  for (const variant of RESOURCE_VARIANTS) {
    const normalizedVariant = normalizeColumnName(variant);
    const found = columns.find(col => 
      normalizeColumnName(col) === normalizedVariant
    );
    if (found) return found;
  }
  return null;
};

/**
 * Finds the actual column name for role from the data (case-insensitive)
 */
export const findRoleColumn = (columns: string[]): string | null => {
  for (const variant of ROLE_VARIANTS) {
    const normalizedVariant = normalizeColumnName(variant);
    const found = columns.find(col => 
      normalizeColumnName(col) === normalizedVariant
    );
    if (found) return found;
  }
  return null;
};

/**
 * Identifies timestamp columns based on suffix patterns (case-insensitive)
 */
export const findTimeColumns = (columns: string[]): string[] => {
  return columns.filter(col => 
    TIME_COLUMN_SUFFIXES.some(suffix => 
      col.toLowerCase().endsWith(suffix.toLowerCase())
    )
  );
};

/**
 * Creates a mapping of standard column names to actual column names
 */
export interface ColumnMapping {
  caseId: string | null;
  activity: string | null;
  resource: string | null;
  role: string | null;
  timeColumns: string[];
  systemColumns: string[];
  attributeColumns: string[];
  originalColumns: string[]; // Keep track of all original column names
}

export const createColumnMapping = (columns: string[]): ColumnMapping => {
  const caseId = findCaseIdColumn(columns);
  const activity = findActivityColumn(columns);
  const resource = findResourceColumn(columns);
  const role = findRoleColumn(columns);
  const timeColumns = findTimeColumns(columns);
  
  const systemColumns = [caseId, activity, resource, role].filter(Boolean) as string[];
  const attributeColumns = columns.filter(col => 
    !systemColumns.includes(col) && !timeColumns.includes(col)
  );
  
  return {
    caseId,
    activity,
    resource,
    role,
    timeColumns,
    systemColumns,
    attributeColumns,
    originalColumns: columns
  };
};

/**
 * Validates that required columns are found
 */
export const validateColumnMapping = (mapping: ColumnMapping): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!mapping.caseId) {
    errors.push('Case ID column not found. Expected variants: case_id, Case ID, CaseID, etc.');
  }
  
  if (!mapping.activity) {
    errors.push('Activity column not found. Expected variants: activity, Activity, task, event, etc.');
  }
  
  if (mapping.timeColumns.length === 0) {
    errors.push('No timestamp columns found. Expected columns ending with: _time, time, timestamp, etc.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
