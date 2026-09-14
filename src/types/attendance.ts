export type IOType = 'I' | 'O';

export interface RawScanRecord {
  empId: string;
  io: IOType;
  dateStr: string;
  timeHHMM: string;
  timeSS: string;
  timestamp: Date;
  rawText: string;
}

export interface EmployeeInfo {
  empId: string;
  dept?: string;
  nameTH?: string;
  nameEN?: string;
  position?: string;
  category?: string;
  mor?: string;
  costCenter?: string;
  manager?: string;
  machine?: string;
  pbu?: string;
  function?: string;
  pos?: string;
  sheet?: string;
  sourceFile?: string;
}

export type ShiftType = 1 | 2 | 3;

export type ManpowerStatusType = 'EXACT' | 'OVER' | 'REPLACEMENT' | 'UNASSIGNED';

export interface ParsedShiftRecord {
  id: string;
  empId: string;
  nameTH: string;
  nameEN: string;
  dept: string;
  position: string;
  category?: string;
  machine?: string;
  shift: ShiftType;
  shiftLabel: string;
  dateStr: string;
  inTime: Date | null;
  outTime: Date | null;
  inTimeFormatted: string;
  outTimeFormatted: string;
  officialStart: Date;
  officialEnd: Date;
  effectiveWorkHours: number;
  normalWorkHours: number;
  otHours: number;
  otNote: string;
  otCategory: 'NONE' | 'SCHEDULED' | 'OVERSTAFF' | 'REPLACEMENT';
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave?: boolean;
  earlyLeaveHours?: number;
  isEarlyScan: boolean;
  isPreShiftReliefOt?: boolean;
  hasMissingPunch: boolean;
  missingPunchType?: 'MISSING_IN' | 'MISSING_OUT';
  manpowerStatus: ManpowerStatusType;
  manpowerStatusLabel: string;
}

export interface ShiftSummary {
  shift: ShiftType;
  shiftName: string;
  timeRange: string;
  totalWorkers: number;
  totalNormalHours: number;
  totalOtWorkers: number;
  totalOtHours: number;
  totalLateWorkers: number;
  totalMissingPunch: number;
}

export interface DepartmentSummary {
  dept: string;
  deptName: string;
  totalWorkers: number;
  totalNormalHours: number;
  totalOtWorkers: number;
  totalOtHours: number;
  totalLateWorkers: number;
  shift1Workers: number;
  shift2Workers: number;
  shift3Workers: number;
}

export interface ManpowerComparisonRow {
  id?: number;
  positionName: string;
  costCenter: string;
  
  shift1Target: number;
  shift1Actual: number;
  shift1Regular?: number;
  shift1OtHC?: number;
  shift1OtHours?: number;
  shift1Gap: number;
  shift1Status: 'EXACT' | 'OVER' | 'UNDER';
  
  shift2Target: number;
  shift2Actual: number;
  shift2Regular?: number;
  shift2OtHC?: number;
  shift2OtHours?: number;
  shift2Gap: number;
  shift2Status: 'EXACT' | 'OVER' | 'UNDER';
  
  shift3Target: number;
  shift3Actual: number;
  shift3Regular?: number;
  shift3OtHC?: number;
  shift3OtHours?: number;
  shift3Gap: number;
  shift3Status: 'EXACT' | 'OVER' | 'UNDER';
}

export interface OtCategorySummary {
  scheduledOtWorkers: number;
  scheduledOtHours: number;
  overstaffOtWorkers: number;
  overstaffOtHours: number;
  replacementOtWorkers: number;
  replacementOtHours: number;
  totalOtHours: number;
}

export interface OverallKPIs {
  totalWorkers: number;
  totalNormalWorkHours: number;
  totalOtWorkers: number;
  totalOtHours: number;
  totalLateWorkers: number;
  totalMissingPunches: number;
  uniqueDepartmentsCount: number;
  scanDateFormatted: string;
  overstaffWorkersCount: number;
  understaffPositionsCount: number;
  overstaffOtHoursTotal: number;
  replacementOtHoursTotal: number;
}
