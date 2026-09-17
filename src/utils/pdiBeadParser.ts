import * as XLSX from 'xlsx';
import { PdiBeadReport, PdiPersonRecord, DEFAULT_PDI_BEAD_REPORT } from '../data/default_pdi_bead';

export function parsePdiBeadWorkbook(wb: XLSX.WorkBook): PdiBeadReport {
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const pdiPersons: PdiPersonRecord[] = [];
  const pdiDailyTotals: Record<number, number> = {};
  const beadDailyTotals: Record<number, number> = {};
  const bcaReductionDailyMinutes: Record<number, number> = {};
  const bcaReductionDailyHours: Record<number, number> = {};
  const bcaDevDailyMinutes: Record<number, number> = {};
  const bcaDevDailyHours: Record<number, number> = {};

  // Initialize day totals 1..31 to 0
  for (let d = 1; d <= 31; d++) {
    pdiDailyTotals[d] = 0;
    beadDailyTotals[d] = 0;
    bcaReductionDailyMinutes[d] = 0;
    bcaReductionDailyHours[d] = 0;
    bcaDevDailyMinutes[d] = 0;
    bcaDevDailyHours[d] = 0;
  }

  // Find day column indices (columns with 1..31)
  let headerRowIdx = -1;
  let dayColMap: Record<number, number> = {}; // colIdx -> dayNumber

  for (let r = 0; r < Math.min(data.length, 5); r++) {
    const row = data[r] || [];
    let foundDays = 0;
    const tempMap: Record<number, number> = {};
    for (let c = 0; c < row.length; c++) {
      const val = parseInt(String(row[c]).trim(), 10);
      if (!isNaN(val) && val >= 1 && val <= 31) {
        tempMap[c] = val;
        foundDays++;
      }
    }
    if (foundDays >= 10) {
      headerRowIdx = r;
      dayColMap = tempMap;
      break;
    }
  }

  // Fallback day map if header row wasn't detected: col 3 = day 1 ... col 33 = day 31
  if (Object.keys(dayColMap).length === 0) {
    for (let d = 1; d <= 31; d++) {
      dayColMap[d + 2] = d;
    }
  }

  for (let r = 0; r < data.length; r++) {
    const row = data[r] || [];
    const textAll = row.map(cell => String(cell || '')).join(' ').toLowerCase();

    // Check if PDI / Dev Person row (Rows 1 to 5 usually or has name/group)
    const col0 = String(row[0] || '').trim();
    const col1 = String(row[1] || '').trim();
    const col2 = String(row[2] || '').trim();

    const isPdiPerson = (
      col0.toLowerCase().includes('somrudee') ||
      col0.toLowerCase().includes('damrongsak') ||
      col0.toLowerCase().includes('kitipan') ||
      col0.toLowerCase().includes('sangpian') ||
      col0.toLowerCase().includes('vattana') ||
      col1.toLowerCase().includes('npi') ||
      col2.toLowerCase().includes('tire dev')
    );

    if (isPdiPerson) {
      const dailyHours: Record<number, number> = {};
      for (let d = 1; d <= 31; d++) dailyHours[d] = 0;

      for (const [cStr, d] of Object.entries(dayColMap)) {
        const c = Number(cStr);
        const val = parseFloat(String(row[c] || '0').trim());
        if (!isNaN(val)) {
          dailyHours[d] = val;
        }
      }

      pdiPersons.push({
        name: col0 || `Person ${pdiPersons.length + 1}`,
        group: col1 || '',
        desc: col2 || '',
        dailyHours
      });
    }

    // Check if PDI Daily Totals row
    const isPdiTotalRow = (
      (textAll.includes('total') || textAll.includes('sum') || textAll.includes('pdi')) &&
      (textAll.includes('pdi') || textAll.includes('deduct') || r === 6) &&
      !textAll.includes('b-end') && !textAll.includes('bead')
    );

    if (isPdiTotalRow) {
      for (const [cStr, d] of Object.entries(dayColMap)) {
        const c = Number(cStr);
        const val = parseFloat(String(row[c] || '0').trim());
        if (!isNaN(val) && val > 0) {
          pdiDailyTotals[d] = val;
        }
      }
    }

    // Check if B-end / Bead row
    const isBeadRow = (
      textAll.includes('b-end') ||
      textAll.includes('b-ead') ||
      textAll.includes('bead') ||
      col0.toLowerCase().includes('b-end') ||
      col0.toLowerCase().includes('b-ead') ||
      r === 10
    );

    if (isBeadRow) {
      for (const [cStr, d] of Object.entries(dayColMap)) {
        const c = Number(cStr);
        const val = parseFloat(String(row[c] || '0').trim());
        if (!isNaN(val) && val > 0) {
          beadDailyTotals[d] = Math.round(val * 100) / 100;
        }
      }
    }
    // Check if BCA Reduction row: Total (Reduction for BCA) (minute)
    const isBcaReductionRow = (
      textAll.includes('total (reduction for bca)') ||
      textAll.includes('reduction for bca') ||
      (col2.toLowerCase().includes('reduction for bca') || col0.toLowerCase().includes('reduction for bca'))
    );

    if (isBcaReductionRow) {
      for (const [cStr, d] of Object.entries(dayColMap)) {
        const c = Number(cStr);
        const val = parseFloat(String(row[c] || '0').trim());
        if (!isNaN(val) && val > 0) {
          bcaReductionDailyMinutes[d] = val;
          bcaReductionDailyHours[d] = Math.round((val / 60) * 100) / 100;
        }
      }
    }

    // Check if BCA DEV row: DEV (For BCA) (minute)
    const isBcaDevRow = (
      textAll.includes('dev (for bca)') ||
      textAll.includes('dev for bca') ||
      (col2.toLowerCase().includes('dev (for bca)') || col0.toLowerCase().includes('dev (for bca)'))
    );

    if (isBcaDevRow) {
      for (const [cStr, d] of Object.entries(dayColMap)) {
        const c = Number(cStr);
        const val = parseFloat(String(row[c] || '0').trim());
        if (!isNaN(val) && val > 0) {
          bcaDevDailyMinutes[d] = val;
          bcaDevDailyHours[d] = Math.round((val / 60) * 100) / 100;
        }
      }
    }
  }

  // If pdiDailyTotals were not found as an explicit row, calculate from sum of pdiPersons
  if (pdiPersons.length > 0) {
    const hasAnyPdiTotal = Object.values(pdiDailyTotals).some(v => v > 0);
    if (!hasAnyPdiTotal) {
      for (let d = 1; d <= 31; d++) {
        pdiDailyTotals[d] = pdiPersons.reduce((sum, p) => sum + (p.dailyHours[d] || 0), 0);
      }
    }
  }

  return {
    monthYear: '09/2026',
    pdiPersons,
    pdiDailyTotals,
    beadDailyTotals,
    bcaReductionDailyMinutes,
    bcaReductionDailyHours,
    bcaDevDailyMinutes,
    bcaDevDailyHours,
    updatedAt: new Date().toISOString()
  };
}

export function parsePdiBeadArrayBuffer(buffer: ArrayBuffer): PdiBeadReport {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    return parsePdiBeadWorkbook(wb);
  } catch (err) {
    console.error('Failed to parse Pdi Bead Excel buffer:', err);
    return DEFAULT_PDI_BEAD_REPORT;
  }
}
