import * as XLSX from 'xlsx';
import { ContractorEmployeeInfo, ContractorScanRecord, ContractorDaySummary } from '../types/contractor';

export function calculateContractorShiftAndHours(
  scanIn: string,
  scanOut: string,
  shiftRaw: string = '',
  otCol: number = 0
): {
  shiftNumber: 1 | 2 | 3;
  shiftLabel: string;
  normalHours: number;
  otHours: number;
  totalHours: number;
} {
  const hasScannedIn = Boolean(scanIn && scanIn.trim());
  if (!hasScannedIn) {
    let shiftNumber: 1 | 2 | 3 = 1;
    let shiftLabel = 'กะ 1 (07:00 - 15:00)';
    if (shiftRaw.includes('15.00') || shiftRaw.includes('บ่าย')) {
      shiftNumber = 2;
      shiftLabel = 'กะ 2 (15:00 - 23:00)';
    } else if (shiftRaw.includes('23.00') || shiftRaw.includes('ดึก')) {
      shiftNumber = 3;
      shiftLabel = 'กะ 3 (23:00 - 07:00)';
    }
    return { shiftNumber, shiftLabel, normalHours: 0, otHours: 0, totalHours: 0 };
  }

  const inParts = scanIn.split(':');
  const inHour = parseInt(inParts[0], 10) || 0;
  const inMin = parseInt(inParts[1], 10) || 0;
  const inTotalMins = inHour * 60 + inMin;

  let outHour = -1;
  let outMin = 0;
  if (scanOut && scanOut.trim()) {
    const outParts = scanOut.split(':');
    outHour = parseInt(outParts[0], 10) || 0;
    outMin = parseInt(outParts[1], 10) || 0;
  }

  let shiftNumber: 1 | 2 | 3 = 1;
  let shiftLabel = 'กะ 1 (07:00 - 15:00)';
  let normalHours = 8;
  let otHours = 0;

  // 1. เข้า 05:00 - 11:59 -> กะ 1 (07:00 - 15:00)
  // สแกนก่อน 07:00 ไม่คิด OT (เป็นการสแกนเข้าปกติ)
  if (inHour >= 5 && inHour < 12) {
    shiftNumber = 1;
    if (outHour >= 0) {
      const isNextDay = outHour < 12 && (outHour * 60 + outMin < inTotalMins);
      const totalOutMins = isNextDay ? (outHour + 24) * 60 + outMin : (outHour * 60 + outMin);
      const minsPast15 = totalOutMins - 15 * 60;
      if (minsPast15 >= 45) {
        otHours = Math.floor((minsPast15 + 15) / 60);
      } else if (otCol > 0) {
        otHours = otCol;
      }
    } else if (otCol > 0) {
      otHours = otCol;
    }

    if (otHours > 0) {
      shiftLabel = `กะ 1 + OT ${otHours}h`;
    } else {
      shiftLabel = 'กะ 1 (07:00 - 15:00)';
    }
  }
  // 2. เข้า 12:00 - 16:59 -> กะ 2 (15:00 - 23:00)
  // สแกนก่อน 15:00 (เช่น 14:43) ไม่คิด OT ก่อน 15:00
  else if (inHour >= 12 && inHour < 17) {
    shiftNumber = 2;
    if (outHour >= 0) {
      const isNextDay = outHour < 12;
      const totalOutMins = isNextDay ? (outHour + 24) * 60 + outMin : (outHour * 60 + outMin);
      const minsPast23 = totalOutMins - 23 * 60;
      if (minsPast23 >= 45) {
        otHours = Math.floor((minsPast23 + 15) / 60);
      } else if (otCol > 0) {
        otHours = otCol;
      }
    } else if (otCol > 0) {
      otHours = otCol;
    }

    if (otHours > 0) {
      shiftLabel = `กะ 2 + OT ${otHours}h`;
    } else {
      shiftLabel = 'กะ 2 (15:00 - 23:00)';
    }
  }
  // 3. เข้า 17:00 - 21:59 -> กะ 3 เข้า 19:00 (19:00 - 07:00)
  // สแกนก่อน 19:00 (เช่น 18:14, 18:49) ไม่คิด OT ก่อน 19:00 -> OT ก่อนกะ = 4 ชม. (19:00 - 23:00) เท่านั้น
  else if (inHour >= 17 && inHour < 22) {
    shiftNumber = 3;
    otHours = 4;
    shiftLabel = `กะ 3 + OT ก่อนกะ 4h (19:00 - 07:00)`;
  }
  // 4. เข้า 22:00 - 04:59 -> กะ 3 (23:00 - 07:00)
  else {
    shiftNumber = 3;
    if (otCol > 0) {
      otHours = otCol;
      shiftLabel = `กะ 3 + OT ${otHours}h`;
    } else if (outHour >= 7 && (outHour * 60 + outMin - 7 * 60 >= 45)) {
      otHours = Math.floor(((outHour * 60 + outMin - 7 * 60) + 15) / 60);
      shiftLabel = `กะ 3 + OT ${otHours}h`;
    } else {
      shiftLabel = 'กะ 3 (23:00 - 07:00)';
    }
  }

  const totalHours = normalHours + otHours;
  return {
    shiftNumber,
    shiftLabel,
    normalHours,
    otHours,
    totalHours
  };
}

export function isValidContractorDate(input: any): boolean {
  if (!input) return false;
  if (typeof input === 'number') {
    return input >= 30000 && input <= 70000;
  }
  const str = String(input).trim();
  const clean = str.replace(/^[^\d]*/, '').trim();
  return (
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.test(clean) ||
    /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.test(clean) ||
    /^\d{8}$/.test(clean)
  );
}

/**
 * Normalize any date format (e.g. "1/9/2026", "01/09/2026", "2026-09-01", "📅 วันที่ 1/9/2026") to "D/M/YYYY"
 */
export function normalizeToDMY(input: any): string {
  if (!input) return '';
  const str = String(input).trim();
  const clean = str.replace(/^[^\d]*/, '').trim();

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

  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean) ? clean : '';
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
  let entry = recordsByDate[targetDate] || (targetNorm ? recordsByDate[targetNorm] : undefined);

  // 2. Try normalized match across all valid date keys
  if (!entry && targetNorm) {
    const foundKey = Object.keys(recordsByDate).find(k => {
      return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(k) && normalizeToDMY(k) === targetNorm;
    });
    if (foundKey) entry = recordsByDate[foundKey];
  }

  // 3. Fallback to latest valid date if not found
  if (!entry) {
    const keys = Object.keys(recordsByDate).filter(k => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(k));
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
