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
  pallets: number;
  ohpaHoursPerTon: number;
  ohpaHoursPerPallet: number;
}

export interface OhpaDeptMetrics {
  dept: string;
  isContractor?: boolean;
  headcount: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
  percentageOfTotalHours: number;
}

export interface OhpaSummary {
  productionDay: string;
  // Total Plant (GY + Contractor)
  totalEmployeesCount: number;
  totalNormalHours: number;
  totalOtHours: number;
  totalWorkingHours: number;

  // Goodyear Breakdown
  gyEmployeesCount: number;
  gyNormalHours: number;
  gyOtHours: number;
  gyTotalHours: number;
  gyOhpaHoursPerTon: number;

  // Contractor Breakdown
  contractorEmployeesCount: number;
  contractorNormalHours: number;
  contractorOtHours: number;
  contractorTotalHours: number;
  contractorOhpaHoursPerTon: number;

  // Tonnage & OHPA
  totalTonnageKg: number;
  totalTonnageTon: number;
  totalPallets: number;
  overallOhpaHoursPerTon: number;
  overallOhpaHoursPerPallet: number;

  shifts: OhpaShiftMetrics[];
  departmentBreakdown: OhpaDeptMetrics[];
}
