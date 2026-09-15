import * as XLSX from 'xlsx';
import { ContractorEmployeeInfo, ContractorScanRecord, ContractorDaySummary } from '../types/contractor';

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

  if (typeof serialOrStr === 'string') {
    const clean = serialOrStr.trim();
    const slashParts = clean.split('/');
    if (slashParts.length === 3) {
      const d = parseInt(slashParts[0], 10);
      const m = parseInt(slashParts[1], 10);
      const y = parseInt(slashParts[2], 10);
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        iso: `${y}-${pad(m)}-${pad(d)}`,
        formattedThai: `วันที่ ${d}/${m}/${y}`,
        formattedShort: `${d}/${m}/${y}`
      };
    }
  }

  return {
    iso: String(serialOrStr),
    formattedThai: `วันที่ ${serialOrStr}`,
    formattedShort: String(serialOrStr)
  };
}

export function getContractorDaySummary(
  dateKey: string,
  recordsByDate: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }>
): ContractorDaySummary | null {
  if (!recordsByDate || Object.keys(recordsByDate).length === 0) return null;

  // Try exact key
  let entry = recordsByDate[dateKey];
  if (!entry) {
    const clean = dateKey.replace(/^📅s*วันที่s*/, '').replace(/^วันที่s*/, '').trim();
    entry = recordsByDate[clean];
  }
  if (!entry) {
    // Search keys
    const matchKey = Object.keys(recordsByDate).find(k => {
      const cleanK = k.replace(/^📅s*วันที่s*/, '').replace(/^วันที่s*/, '').trim();
      const cleanInput = dateKey.replace(/^📅s*วันที่s*/, '').replace(/^วันที่s*/, '').trim();
      return cleanK === cleanInput || cleanInput.includes(cleanK) || cleanK.includes(cleanInput);
    });
    if (matchKey) entry = recordsByDate[matchKey];
  }

  // Fallback to first available entry if not found
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
