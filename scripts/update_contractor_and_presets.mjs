import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// 1. Enrich contractor employee mapping
const tsData = fs.readFileSync('src/data/default_contractor_data.ts', 'utf8');
const mappingMatch = tsData.match(/export const DEFAULT_CONTRACTOR_MAPPING: Record<string, ContractorEmployeeInfo> = ({[\s\S]*?});\n\nexport const DEFAULT_CONTRACTOR_RECORDS_BY_DATE/);

let employeeMap = {};
if (mappingMatch) {
  try {
    employeeMap = JSON.parse(mappingMatch[1]);
  } catch (e) {
    console.error('Failed to parse existing mapping:', e);
  }
}

function enrichMappingFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const wb = XLSX.readFile(filePath);
  for (const s of wb.SheetNames) {
    const ws = wb.Sheets[s];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row || !row[1]) continue;
      const empCode = String(row[1]).trim();
      if (/^\d{5}$/.test(empCode)) {
        if (!employeeMap[empCode]) {
          employeeMap[empCode] = {
            empCode,
            nameEn: String(row[2] || '').trim(),
            nameTh: String(row[3] || '').trim(),
            position: String(row[4] || '').trim(),
            location: String(row[5] || '').trim(),
            closing: String(row[6] || '').trim(),
            department: String(row[7] || '').trim(),
            type: String(row[9] || '').includes('Salary') ? 'Salary' : 'Hourly'
          };
        }
      }
    }
  }
}

enrichMappingFromFile('scans_was/Name list WAS .xlsx');
enrichMappingFromFile('scans_was/WAS_รายเดือน.xlsx');

function formatTimeStr(val) {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  if (/^\d{1,2}:\d{2}/.test(s)) {
    const parts = s.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return s;
}

function parseExcelDate(val) {
  if (typeof val === 'number') {
    const utc_days = Math.floor(val - 25569);
    const d = new Date(utc_days * 86400 * 1000);
    const day = d.getUTCDate();
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();
    return {
      day,
      month,
      year,
      dmy: `${day}/${month}/${year}`,
      iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
  }
  const s = String(val).trim();
  const m1 = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const month = parseInt(m1[2], 10);
    const year = parseInt(m1[3], 10);
    return {
      day,
      month,
      year,
      dmy: `${day}/${month}/${year}`,
      iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
  }
  return null;
}

function calculateShift(scanIn, scanOut, shiftRaw = '', otCol = 0) {
  const hasIn = Boolean(scanIn && scanIn.trim());
  if (!hasIn) {
    let shiftNumber = 1;
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

  let shiftNumber = 1;
  let shiftLabel = 'กะ 1 (07:00 - 15:00)';
  let normalHours = 8;
  let otHours = 0;

  if (inHour >= 5 && inHour < 12) {
    shiftNumber = 1;
    if (outHour >= 0) {
      const isNextDay = outHour < 12 && (outHour * 60 + outMin < inTotalMins);
      const totalOutMins = isNextDay ? (outHour + 24) * 60 + outMin : (outHour * 60 + outMin);
      const minsPast15 = totalOutMins - 15 * 60;
      if (minsPast15 >= 53) {
        otHours = Math.floor((minsPast15 + 7) / 60);
      } else if (otCol > 0) {
        otHours = otCol;
      }
    } else if (otCol > 0) {
      otHours = otCol;
    }
    shiftLabel = otHours > 0 ? `กะ 1 + OT ${otHours}h` : 'กะ 1 (07:00 - 15:00)';
  } else if (inHour >= 12 && inHour < 17) {
    shiftNumber = 2;
    if (outHour >= 0) {
      const isNextDay = outHour < 12;
      const totalOutMins = isNextDay ? (outHour + 24) * 60 + outMin : (outHour * 60 + outMin);
      const minsPast23 = totalOutMins - 23 * 60;
      if (minsPast23 >= 53) {
        otHours = Math.floor((minsPast23 + 7) / 60);
      } else if (otCol > 0) {
        otHours = otCol;
      }
    } else if (otCol > 0) {
      otHours = otCol;
    }
    shiftLabel = otHours > 0 ? `กะ 2 + OT ${otHours}h` : 'กะ 2 (15:00 - 23:00)';
  } else if (inHour >= 17 && inHour < 22) {
    shiftNumber = 3;
    otHours = 4;
    shiftLabel = 'กะ 3 + OT ก่อนกะ 4h (19:00 - 07:00)';
  } else {
    shiftNumber = 3;
    if (otCol > 0) {
      otHours = otCol;
      shiftLabel = `กะ 3 + OT ${otHours}h`;
    } else {
      shiftLabel = 'กะ 3 (23:00 - 07:00)';
    }
  }

  return {
    shiftNumber,
    shiftLabel,
    normalHours,
    otHours,
    totalHours: normalHours + otHours
  };
}

const allFiles = fs.readdirSync('scans_was');
const extractedByDate = {};

for (const f of allFiles) {
  if (!f.endsWith('.xls') && !f.endsWith('.xlsx')) continue;
  if (f.startsWith('Name list') || f.startsWith('WAS_รายเดือน')) continue;

  const fullPath = path.join('scans_was', f);
  let wb;
  try {
    wb = XLSX.readFile(fullPath);
  } catch (e) {
    continue;
  }

  for (const sName of wb.SheetNames) {
    const ws = wb.Sheets[sName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length <= 1) continue;

    const header = rows[0] || [];
    const empIdx = header.findIndex(h => String(h).includes('รหัส'));
    const nameIdx = header.findIndex(h => String(h).includes('ชื่อ'));
    const dateIdx = header.findIndex(h => String(h).includes('วันที่'));
    const shiftIdx = header.findIndex(h => String(h).includes('กะ'));
    const inIdx = header.findIndex(h => String(h).includes('ลงเวลาเข้า') || String(h).includes('เข้า'));
    const outIdx = header.findIndex(h => String(h).includes('ลงเวลาออก') || String(h).includes('ออก'));
    const lateIdx = header.findIndex(h => String(h).includes('สาย'));
    const earlyIdx = header.findIndex(h => String(h).includes('ออกก่อน'));
    const absentIdx = header.findIndex(h => String(h).includes('ขาดงาน'));
    const reasonIdx = header.findIndex(h => String(h).includes('สาเหตุ'));
    const deptIdx = header.findIndex(h => String(h).includes('แผนก'));
    const otIdx = header.findIndex(h => String(h).includes('โอที'));

    if (empIdx === -1) continue;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[empIdx]) continue;
      const empCode = String(r[empIdx]).trim();
      if (!/^\d{5}$/.test(empCode)) continue;

      const dateVal = r[dateIdx];
      const parsedDate = parseExcelDate(dateVal);
      if (!parsedDate) continue;

      const d = parsedDate.day;
      const m = parsedDate.month;
      const y = parsedDate.year;
      const standardDmy = `${d}/${m}/${y}`;
      const dmy2 = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
      const iso = parsedDate.iso;
      const dateFormatted = `วันที่ ${d}/${m}/${y}`;

      if (!extractedByDate[standardDmy]) {
        extractedByDate[standardDmy] = {
          dmy: standardDmy,
          dmy2,
          iso,
          dateFormatted,
          day: d,
          month: m,
          year: y,
          recordsMap: new Map()
        };
      }

      const scanIn = formatTimeStr(r[inIdx]);
      const scanOut = formatTimeStr(r[outIdx]);
      const lateStr = formatTimeStr(r[lateIdx]);
      const earlyStr = formatTimeStr(r[earlyIdx]);
      const shiftRaw = String(r[shiftIdx] || '').trim();
      const otCol = parseFloat(r[otIdx]) || 0;
      const absentRaw = String(r[absentIdx] || '').toLowerCase();
      const reasonRaw = String(r[reasonIdx] || '').trim();
      const deptRaw = String(r[deptIdx] || '').trim();
      const nameRaw = String(r[nameIdx] || '').trim();

      const hasScannedIn = Boolean(scanIn);
      const isAbsent = !hasScannedIn || absentRaw === 'true' || absentRaw === '1';

      const shiftInfo = calculateShift(scanIn, scanOut, shiftRaw, otCol);

      const empInfo = employeeMap[empCode] || {
        empCode,
        nameEn: '',
        nameTh: nameRaw,
        position: '',
        location: '',
        closing: '',
        department: deptRaw || 'MFG',
        type: deptRaw.includes('รายเดือน') ? 'Salary' : 'Hourly'
      };

      let status = 'ปกติ';
      if (isAbsent) {
        status = reasonRaw ? `ขาดงาน (${reasonRaw})` : 'ขาดงาน';
      } else if (lateStr) {
        status = `มาสาย ${lateStr}`;
      } else if (shiftInfo.otHours > 0) {
        status = `OT ${shiftInfo.otHours} ชม.`;
      }

      const record = {
        empCode,
        nameTh: empInfo.nameTh || nameRaw,
        nameEn: empInfo.nameEn || '',
        position: empInfo.position || '',
        location: empInfo.location || '',
        closing: empInfo.closing || '',
        department: empInfo.department || deptRaw || 'MFG',
        type: empInfo.type || (deptRaw.includes('รายเดือน') ? 'Salary' : 'Hourly'),
        shiftRaw,
        shiftNumber: shiftInfo.shiftNumber,
        shiftLabel: shiftInfo.shiftLabel,
        scanIn: scanIn || '',
        scanOut: scanOut || '',
        late: lateStr || '',
        earlyOut: earlyStr || '',
        isAbsent,
        absentReason: reasonRaw || '',
        normalHours: shiftInfo.normalHours,
        otHours: shiftInfo.otHours,
        totalHours: shiftInfo.totalHours,
        status,
        remark: reasonRaw || '',
        hasScannedIn
      };

      const existing = extractedByDate[standardDmy].recordsMap.get(empCode);
      if (!existing || (!existing.hasScannedIn && record.hasScannedIn) || (record.scanOut && !existing.scanOut)) {
        extractedByDate[standardDmy].recordsMap.set(empCode, record);
      }
    }
  }
}

// Build records by date object with multiple aliases (e.g. 25/09/2026, 25/9/2026, 2026-09-25)
const recordsByDateOutput = {};

// Sort dates descending
const dateKeys = Object.keys(extractedByDate).sort((a, b) => {
  const [d1, m1, y1] = a.split('/').map(Number);
  const [d2, m2, y2] = b.split('/').map(Number);
  return new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
});

for (const key of dateKeys) {
  const item = extractedByDate[key];
  const records = Array.from(item.recordsMap.values()).sort((a, b) => a.empCode.localeCompare(b.empCode));
  const dayData = {
    dateFormatted: item.dateFormatted,
    dateShort: item.dmy,
    isoDate: item.iso,
    records
  };

  // Add keys: D/M/YYYY, DD/MM/YYYY, YYYY-MM-DD, and dateFormatted
  recordsByDateOutput[item.dmy] = dayData;
  recordsByDateOutput[item.dmy2] = dayData;
  recordsByDateOutput[item.iso] = dayData;
  recordsByDateOutput[item.dateFormatted] = dayData;
}

const fileContent = `import { ContractorScanRecord, ContractorEmployeeInfo } from '../types/contractor';

export const DEFAULT_CONTRACTOR_MAPPING: Record<string, ContractorEmployeeInfo> = ${JSON.stringify(employeeMap, null, 2)};

export const DEFAULT_CONTRACTOR_RECORDS_BY_DATE: Record<string, {
  dateFormatted: string;
  dateShort: string;
  isoDate: string;
  records: ContractorScanRecord[];
}> = ${JSON.stringify(recordsByDateOutput, null, 2)};
`;

fs.writeFileSync('src/data/default_contractor_data.ts', fileContent, 'utf8');
console.log(`Updated src/data/default_contractor_data.ts with ${dateKeys.length} unique dates.`);
