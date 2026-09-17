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
  monthlyHeadcount?: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
  grossHours?: number;
  gyTotalHours: number;
  contractorTotalHours: number;
  monthlyHours?: number;
  pdiDeductHours?: number;
  beadAddHours?: number;
  opahWorkingHours?: number;
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
  wasCount?: number;
  wasTotalHours?: number;
  combinedCount?: number;
  combinedTotalHours?: number;
}

export interface OhpaDeptMetrics {
  dept: string;
  isContractor?: boolean;
  isMonthly?: boolean;
  isBead?: boolean;
  isExcluded6320?: boolean;
  headcount: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
  percentageOfTotalHours: number;
}

export interface OhpaAreaDeptItem {
  dept: string;
  isContractor: boolean;
  isMonthly?: boolean;
  isBead?: boolean;
  headcount: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
}

export interface OhpaAreaMetrics {
  areaKey: 'BCA' | 'Consumer' | 'Bias Aero' | 'Radial Aero' | 'Retread' | 'Non-MFG : Engineering' | 'Non-MFG : Quality' | 'Non-MFG : Others' | string;
  areaName: string;
  areaLabel: string;
  headcountStandard?: number;
  icon: string;
  order: number;
  isExcluded6320?: boolean;
  totalHeadcount: number;
  gyHeadcount: number;
  contractorHeadcount: number;
  monthlyHeadcount?: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
  gyNormalHours: number;
  gyOtHours: number;
  gyTotalHours: number;
  contractorNormalHours: number;
  contractorOtHours: number;
  contractorTotalHours: number;
  monthlyHours?: number;
  nonHptAllocatedHours?: number;
  nonHptAllocatedHC?: number;
  consumerBiasAllocatedHours?: number;
  consumerBiasAllocatedHC?: number;
  beadAddHours?: number;
  pdiDeductHours?: number;
  finalOpahHours?: number;
  percentageOfTotalHours: number;
  departments: OhpaAreaDeptItem[];
  areaTonnageCodes?: string;
  areaTonnageKg?: number;
  areaTonnageLbs?: number;
  areaTonnageTon?: number;
  areaOpahLbsPerHour?: number;
}

export interface DailyMtdItem {
  day: number;
  dateStr: string; // e.g. "01/09/2026"
  dayName: string; // e.g. "วันอังคาร"
  gyHeadcount: number;
  gyHours: number;
  contractorHeadcount: number;
  contractorHours: number;
  monthlyHours: number;
  totalHours: number;
  pdiDeductHours: number;
  beadAddHours: number;
  opahWorkingHours: number;
  cumulativeTotalHours: number;
  cumulativeOpahWorkingHours?: number;
  stockingKg?: number;
  stockingLbs?: number;
}

export interface MtdOhpaSummary {
  targetDate: string; // e.g. "14/09/2026"
  daysCount: number; // e.g. 14
  mtdTotalHours: number;
  mtdGyHours: number;
  mtdContractorHours: number;
  mtdMonthlyHours: number;
  mtdPdiDeductHours: number;
  mtdBeadAddHours: number;
  mtdOpahWorkingHours: number;
  mtdStockingKg: number;
  mtdStockingLbs: number;
  mtdStockingTon: number;
  mtdPallets: number;
  mtdOpahLbsPerHour: number;
  mtdGyOpahLbsPerHour: number;
  mtdContractorOpahLbsPerHour: number;
  dailyItems: DailyMtdItem[];
  areaBreakdown?: OhpaAreaMetrics[];
}

export interface OhpaSummary {
  productionDay: string;
  // Total Plant (GY + Contractor + Monthly, excluding Dept 6320)
  totalEmployeesCount: number;
  totalNormalHours: number;
  totalOtHours: number;
  totalWorkingHours: number;

  // PDI Deduct & B-end (Bead) Adjustment for OPAH
  pdiDeductHours: number;
  beadAddHours: number;
  opahWorkingHours: number;

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

  // Monthly Staff (71 persons: Goodyear 62 + WAS 9, Mon-Fri 8h, Sat 4h, Sun 0h)
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
  areaBreakdown: OhpaAreaMetrics[];
  departmentBreakdown: OhpaDeptMetrics[];

  // Month-To-Date (MTD) metrics from day 1 to selected date
  mtd?: MtdOhpaSummary;
}


