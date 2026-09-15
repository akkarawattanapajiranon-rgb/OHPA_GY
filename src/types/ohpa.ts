export interface StockingTonnageCategoryRow {
  code: string;
  categoryName: string;
  mtdTonnage: number;
  mtdPallets: number;
  shift1Tonnage: number;
  shift1Pallets: number;
  shift2Tonnage: number;
  shift2Pallets: number;
  shift3Tonnage: number;
  shift3Pallets: number;
  dailyTotalTonnage: number;
  dailyTotalPallets: number;
}

export interface StockingTonnageDateOption {
  value: string; // e.g. "20260914000000"
  label: string; // e.g. "14/09/2026"
  selected?: boolean;
}

export interface StockingTonnageReport {
  productionDay: string; // e.g. "14/09/2026"
  productionDayValue: string; // e.g. "20260914000000"
  availableDates: StockingTonnageDateOption[];
  rows: StockingTonnageCategoryRow[];
  total: StockingTonnageCategoryRow | null;
  fetchedAt?: string;
  isMock?: boolean;
}

export interface OhpaShiftMetrics {
  shift: 1 | 2 | 3;
  shiftLabel: string;
  headcount: number;
  gyHeadcount: number;
  contractorHeadcount: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
  gyTotalHours: number;
  contractorTotalHours: number;
  tonnageKg: number;
  tonnageTon: number;
  tonnageLbs: number;
  pallets: number;
  opahLbsPerHour: number;
}

export interface MonthlyStaffMetrics {
  count: number;
  hoursPerPerson: number;
  totalHours: number;
  dayName: string;
}

export interface OhpaDeptMetrics {
  dept: string;
  isContractor?: boolean;
  isMonthly?: boolean;
  isExcluded6320?: boolean;
  headcount: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
  percentageOfTotalHours: number;
}

export interface OhpaSummary {
  productionDay: string;
  // Total Plant (GY + Contractor + Monthly, excluding Dept 6320)
  totalEmployeesCount: number;
  totalNormalHours: number;
  totalOtHours: number;
  totalWorkingHours: number;

  // Goodyear Breakdown (excluding 6320)
  gyEmployeesCount: number;
  gyNormalHours: number;
  gyOtHours: number;
  gyTotalHours: number;
  gyOpahLbsPerHour: number;

  // Contractor Breakdown (excluding 6320)
  contractorEmployeesCount: number;
  contractorNormalHours: number;
  contractorOtHours: number;
  contractorTotalHours: number;
  contractorOpahLbsPerHour: number;

  // Monthly Staff (62 persons: Mon-Fri 8h, Sat 4h, Sun 0h)
  monthlyStaff: MonthlyStaffMetrics;

  // Excluded Dept 6320 Stats
  excluded6320GyCount: number;
  excluded6320GyHours: number;
  excluded6320ContCount: number;
  excluded6320ContHours: number;

  // Tonnage & OPAH
  totalTonnageKg: number;
  totalTonnageTon: number;
  totalTonnageLbs: number;
  totalPallets: number;
  overallOpahLbsPerHour: number;

  shifts: OhpaShiftMetrics[];
  departmentBreakdown: OhpaDeptMetrics[];
}


