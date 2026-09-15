import * as XLSX from 'xlsx';
import { ContractorEmployeeInfo, ContractorScanRecord, ContractorDaySummary } from '../types/contractor';

/**
 * Normalize any date format (e.g. "1/9/2026", "01/09/2026", "2026-09-01", "📅 วันที่ 1/9/2026") to "D/M/YYYY"
 */
export function normalizeToDMY(input: any): string {
  if (!input) return '';
  const str = String(input).trim();
  const clean = str.replace(/^[📅📄s]*วันที่s*/, '').trim();

  // Match D/M/YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = dmyMatch[3];
    return `${d}/${m}/${y}`;
  }

  // Match YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    return `${d}/${m}/${y}`;
  }

  // Match MMDDYYYY (8 digits)
  if (/^\d{8}$/.test(clean)) {
    const m = parseInt(clean.slice(0, 2), 10);
    const d = parseInt(clean.slice(2, 4), 10);
    const y = clean.slice(4, 8);
    return `${d}/${m}/${y}`;
  }

  return clean;
}

export function normalizeContractorDate(serialOrStr: any): {
  iso: string;
  formattedThai: string;
  formattedShort: string;
} {
  if (typeof serialOrStr === 'number') {
    const utc_days = Math.floor(serialOrStr - 25569);
    const utc_value = utc_days * 86400;
    const d = new Date(utc_value * 1000);
    const day = d.getUTCDate();
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      iso: `${year}-${pad(month)}-${pad(day)}`,
      formattedThai: `วันที่ ${day}/${month}/${year}`,
      formattedShort: `${day}/${month}/${year}`
    };
  }

  const dmy = normalizeToDMY(serialOrStr);
  const parts = dmy.split('/');
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parts[2];
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      iso: `${y}-${pad(m)}-${pad(d)}`,
      formattedThai: `วันที่ ${d}/${m}/${y}`,
      formattedShort: `${d}/${m}/${y}`
    };
  }

  return {
    iso: String(serialOrStr),
    formattedThai: `วันที่ ${serialOrStr}`,
    formattedShort: String(serialOrStr)
  };
}

export function getContractorDaySummary(
  targetDate: string,
  recordsByDate: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }>
): ContractorDaySummary | null {
  if (!recordsByDate || Object.keys(recordsByDate).length === 0) return null;

  const targetNorm = normalizeToDMY(targetDate);

  // 1. Try exact match on key
  let entry = recordsByDate[targetDate] || recordsByDate[targetNorm];

  // 2. Try normalized match across all keys
  if (!entry) {
    const foundKey = Object.keys(recordsByDate).find(k => {
      return normalizeToDMY(k) === targetNorm;
    });
    if (foundKey) entry = recordsByDate[foundKey];
  }

  // 3. Fallback to latest date if not found
  if (!entry) {
    const keys = Object.keys(recordsByDate);
    if (keys.length > 0) entry = recordsByDate[keys[0]];
  }

  if (!entry || !entry.records) return null;

  const records = entry.records;
  let scannedInCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let otWorkersCount = 0;
  let totalNormalHours = 0;
  let totalOtHours = 0;

  for (const r of records) {
    if (r.hasScannedIn) {
      scannedInCount++;
    } else {
      absentCount++;
    }
    if (r.late) lateCount++;
    if (r.otHours > 0) {
      otWorkersCount++;
      totalOtHours += r.otHours;
    }
    totalNormalHours += r.normalHours;
  }

  return {
    dateShort: entry.dateShort,
    dateFormatted: entry.dateFormatted,
    isoDate: entry.isoDate,
    totalEmployees: records.length,
    scannedInCount,
    absentCount,
    lateCount,
    otWorkersCount,
    totalNormalHours,
    totalOtHours,
    totalWorkingHours: totalNormalHours + totalOtHours,
    records
  };
}

export function exportContractorRecordsToExcel(
  records: ContractorScanRecord[],
  dateFormatted: string,
  fileNamePrefix: string = 'Contractor_Scan_Records'
) {
  const exportData = records.map((r, index) => ({
    'ลำดับ (No.)': index + 1,
    'รหัสพนักงาน (Emp Code)': r.empCode,
    'ชื่อ - นามสกุล (TH)': r.nameTh,
    'Name (EN)': r.nameEn,
    'ตำแหน่ง (Position)': r.position,
    'สถานที่/แผนก (Location)': r.location,
    'Cost Center (Closing)': r.closing,
    'Department': r.department,
    'กะการทำงาน (Shift)': r.shiftLabel || r.shiftRaw,
    'สแกนเข้า (Scan In)': r.scanIn || '-',
    'สแกนออก (Scan Out)': r.scanOut || '-',
    'มาสาย (Late)': r.late || '-',
    'ออกก่อน (Early Out)': r.earlyOut || '-',
    'ชม.ปกติ (Normal Hrs)': r.normalHours,
    'ชม. OT (OT Hrs)': r.otHours,
    'รวม ชม. (Total Hrs)': r.totalHours,
    'สถานะ (Status)': r.status,
    'หมายเหตุ (Remarks)': r.remark || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contractor Scans');

  const cleanDate = dateFormatted.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `${fileNamePrefix}_${cleanDate}.xlsx`);
}
