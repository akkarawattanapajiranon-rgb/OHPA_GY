export interface ContractorEmployeeInfo {
  empCode: string;
  nameEn: string;
  nameTh: string;
  position: string;
  location: string;
  closing: string;
  department: string;
  type: string;
}

export interface ContractorScanRecord {
  empCode: string;
  nameTh: string;
  nameEn: string;
  position: string;
  location: string;
  closing: string;
  department: string;
  type: string;
  shiftRaw: string;
  shiftNumber: number; // 1, 2, 3
  shiftLabel: string;
  scanIn: string;
  scanOut: string;
  late: string;
  earlyOut: string;
  absent: string;
  remark: string;
  deptRaw: string;
  isWorkDay: boolean;
  hasScannedIn: boolean;
  normalHours: number;
  otHours: number;
  totalHours: number;
  status: string;
  date: string;
  dateFormatted: string;
  dateShort: string;
}

export interface ContractorDaySummary {
  dateShort: string;
  dateFormatted: string;
  isoDate: string;
  totalEmployees: number;
  scannedInCount: number;
  absentCount: number;
  lateCount: number;
  otWorkersCount: number;
  totalNormalHours: number;
  totalOtHours: number;
  totalWorkingHours: number;
  records: ContractorScanRecord[];
}
