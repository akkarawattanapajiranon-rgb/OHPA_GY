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
  normalHours: number;
  otHours: number;
  totalHours: number;
  tonnageKg: number;
  tonnageTon: number;
  pallets: number;
  ohpaHoursPerTon: number;
  ohpaHoursPerPallet: number;
}

export interface OhpaDeptMetrics {
  dept: string;
  headcount: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
  percentageOfTotalHours: number;
}

export interface OhpaSummary {
  productionDay: string;
  totalEmployeesCount: number;
  totalNormalHours: number;
  totalOtHours: number;
  totalWorkingHours: number;
  totalTonnageKg: number;
  totalTonnageTon: number;
  totalPallets: number;
  overallOhpaHoursPerTon: number;
  overallOhpaHoursPerPallet: number;
  shifts: OhpaShiftMetrics[];
  departmentBreakdown: OhpaDeptMetrics[];
}
