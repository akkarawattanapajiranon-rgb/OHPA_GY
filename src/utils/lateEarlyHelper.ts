import * as XLSX from 'xlsx';
import { ParsedShiftRecord, EmployeeInfo, DailyAdjustmentRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { ScanPreset } from '../data/default_scan_record';
import { processScanRecords } from './parser';
import { classifyArea, AREA_5_KEYS, AREA_5_METADATA, Area5Key } from './ohpaCalculator';

export interface LateRecordItem {
  id: string;
  dateStr: string;
  dayName: string;
  dayNum: number;
  weekNum: number;
  weekLabel: string;
  empId: string;
  nameTH: string;
  nameEN: string;
  empType: 'Goodyear' | 'Contractor (WAS)';
  areaKey: string;
  areaName: string;
  dept: string;
  position: string;
  machine: string;
  shift: number;
  shiftLabel: string;
  inTime: string;
  lateMinutes: number;
  lateFormatted: string;
  remark: string;
}

export interface EarlyLeaveRecordItem {
  id: string;
  dateStr: string;
  dayName: string;
  dayNum: number;
  weekNum: number;
  weekLabel: string;
  empId: string;
  nameTH: string;
  nameEN: string;
  empType: 'Goodyear' | 'Contractor (WAS)';
  areaKey: string;
  areaName: string;
  dept: string;
  position: string;
  machine: string;
  shift: number;
  shiftLabel: string;
  outTime: string;
  earlyHours: number;
  effectiveWorkHours: number;
  earlyFormatted: string;
  remark: string;
}

export interface WeeklyStatSummary {
  weekNum: number;
  weekLabel: string;
  dateRange: string;
  daysCount: number;
  totalLateCount: number;
  totalLateMinutes: number;
  gyLateCount: number;
  contLateCount: number;
  totalEarlyCount: number;
  totalEarlyHours: number;
  gyEarlyCount: number;
  contEarlyCount: number;
  uniqueLateEmployees: number;
  uniqueEarlyEmployees: number;
}

export interface AreaStatSummary {
  areaKey: string;
  areaName: string;
  lateCount: number;
  lateMinutes: number;
  earlyCount: number;
  earlyHours: number;
  gyCount: number;
  contCount: number;
}

export interface ShiftStatSummary {
  shift: number;
  shiftLabel: string;
  lateCount: number;
  lateMinutes: number;
  earlyCount: number;
  earlyHours: number;
}

export interface TopViolatorItem {
  empId: string;
  nameTH: string;
  nameEN: string;
  empType: string;
  areaKey: string;
  areaName: string;
  dept: string;
  position: string;
  count: number;
  totalQuantity: number; // minutes for late, hours for early leave
  formattedQuantity: string;
  dates: string[];
}

export interface LateEarlyDataset {
  allLateRecords: LateRecordItem[];
  allEarlyRecords: EarlyLeaveRecordItem[];
  weeklySummaries: WeeklyStatSummary[];
  areaSummaries: AreaStatSummary[];
  shiftSummaries: ShiftStatSummary[];
  topLateRanking: TopViolatorItem[];
  topEarlyRanking: TopViolatorItem[];
  totalLateCount: number;
  totalLateMinutes: number;
  totalEarlyCount: number;
  totalEarlyHours: number;
  uniqueLateEmployeesCount: number;
  uniqueEarlyEmployeesCount: number;
  availableDays: { day: number; dateStr: string; dayName: string; lateCount: number; earlyCount: number }[];
}

/**
 * Calculates ISO or plant week number (1..5) based on day of month (1-7 = W1, 8-14 = W2, 15-21 = W3, 22-28 = W4, 29-31 = W5)
 */
export function getPlantWeekInfo(day: number, month: number = 9, year: number = 2026): { weekNum: number; weekLabel: string; dateRange: string } {
  if (day <= 7) {
    return { weekNum: 1, weekLabel: 'สัปดาห์ที่ 1 (Week 1)', dateRange: `1 - 7 ก.ย. ${year}` };
  } else if (day <= 14) {
    return { weekNum: 2, weekLabel: 'สัปดาห์ที่ 2 (Week 2)', dateRange: `8 - 14 ก.ย. ${year}` };
  } else if (day <= 21) {
    return { weekNum: 3, weekLabel: 'สัปดาห์ที่ 3 (Week 3)', dateRange: `15 - 21 ก.ย. ${year}` };
  } else if (day <= 28) {
    return { weekNum: 4, weekLabel: 'สัปดาห์ที่ 4 (Week 4)', dateRange: `22 - 28 ก.ย. ${year}` };
  } else {
    return { weekNum: 5, weekLabel: 'สัปดาห์ที่ 5 (Week 5)', dateRange: `29 - 30 ก.ย. ${year}` };
  }
}

const DAY_NAMES = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

function resolveArea(mu?: string, category?: string, dept?: string, costCenter?: string) {
  const muClean = (mu || '').trim();
  if (muClean && AREA_5_METADATA[muClean as Area5Key]) {
    return { key: muClean, name: AREA_5_METADATA[muClean as Area5Key].name };
  }
  const classified = classifyArea(category, dept, costCenter, '', '', '', mu);
  return { key: classified.key, name: classified.name };
}

/**
 * Parses late string from Contractor record (e.g. "15 นาที", "0:15", "30") to number of minutes
 */
function parseContLateMinutes(lateStr?: string): number {
  if (!lateStr) return 0;
  const clean = String(lateStr).trim();
  if (!clean || clean === '0' || clean === '-') return 0;
  
  if (clean.includes(':')) {
    const parts = clean.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }
  const mMatch = clean.match(/(\d+)/);
  return mMatch ? parseInt(mMatch[1], 10) : 0;
}

/**
 * Parses early leave string from Contractor record (e.g. "1 ชม.", "1.5", "0:30") to number of hours
 */
function parseContEarlyHours(earlyStr?: string): number {
  if (!earlyStr) return 0;
  const clean = String(earlyStr).trim();
  if (!clean || clean === '0' || clean === '-') return 0;

  if (clean.includes(':')) {
    const parts = clean.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return Math.round((h + m / 60) * 10) / 10;
  }
  const numMatch = clean.match(/([\d.]+)/);
  if (numMatch) {
    const n = parseFloat(numMatch[1]);
    if (clean.includes('นาที') || n > 12) {
      return Math.round((n / 60) * 10) / 10;
    }
    return n;
  }
  return 0;
}

/**
 * Extract and build full MTD Late and Early Leave datasets from all scan presets & contractor data
 */
export function extractAllLateAndEarlyRecords(
  allScanPresets: ScanPreset[] = [],
  contractorRecordsByDate: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }> = {},
  employeeMapping: Record<string, EmployeeInfo> = {},
  dailyAdjustments: DailyAdjustmentRecord[] = []
): LateEarlyDataset {
  const allLateRecords: LateRecordItem[] = [];
  const allEarlyRecords: EarlyLeaveRecordItem[] = [];

  // Group presets by day (1..31)
  const daysMap = new Map<number, { preset?: ScanPreset; dateStr: string; dt: Date }>();

  allScanPresets.forEach((preset) => {
    const clean = (preset.dateFormatted || preset.name || '').replace(/^[📅📄\s]*วันที่\s*/, '').trim();
    const parts = clean.split(/[/.-]/);
    let day = 0, month = 9, year = 2026;
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        day = parseInt(parts[0], 10) || 0;
        month = parseInt(parts[1], 10) || 9;
        year = parseInt(parts[2], 10) || 2026;
      } else if (parts[0].length === 4) {
        year = parseInt(parts[0], 10) || 2026;
        month = parseInt(parts[1], 10) || 9;
        day = parseInt(parts[2], 10) || 0;
      }
    }
    if (day >= 1 && day <= 31) {
      const dt = new Date(year, month - 1, day);
      const dPad = String(day).padStart(2, '0');
      const mPad = String(month).padStart(2, '0');
      const dateStr = `${dPad}/${mPad}/${year}`;
      if (!daysMap.has(day)) {
        daysMap.set(day, { preset, dateStr, dt });
      }
    }
  });

  // Sort days ascending
  const sortedDays = [...daysMap.entries()].sort((a, b) => a[0] - b[0]);
  const availableDays: { day: number; dateStr: string; dayName: string; lateCount: number; earlyCount: number }[] = [];

  sortedDays.forEach(([day, { preset, dateStr, dt }]) => {
    const dayName = DAY_NAMES[dt.getDay()];
    const weekInfo = getPlantWeekInfo(day, dt.getMonth() + 1, dt.getFullYear());
    let dayLateCount = 0;
    let dayEarlyCount = 0;

    // 1. Parse Goodyear Scan Records for this day
    if (preset && preset.content) {
      const parsed = processScanRecords(preset.content, employeeMapping, dailyAdjustments);
      parsed.records.forEach((r) => {
        const rawId = (r.empId || '').replace(/\D/g, '');
        const empInfo = employeeMapping[r.empId] || employeeMapping[rawId] || employeeMapping[rawId.padStart(5, '0')];
        const category = r.category || empInfo?.category || '';
        const dept = r.dept || empInfo?.dept || '';
        const costCenter = r.costCenter || empInfo?.costCenter || '';
        const mu = empInfo?.mu || r.mu || '';
        const position = r.position || empInfo?.position || '-';
        const machine = r.machine || empInfo?.machine || position;
        const area = resolveArea(mu, category, dept, costCenter);

        // Check Late (Only single shift / no OT, excluding call-in OT cases)
        const hasOt = (r.otHours && r.otHours > 0) || (r.otCategory && r.otCategory !== 'NONE');
        if (r.isLate && !hasOt) {
          const lMin = r.lateMinutes || 0;
          allLateRecords.push({
            id: `gy_late_${day}_${r.empId}`,
            dateStr,
            dayName,
            dayNum: day,
            weekNum: weekInfo.weekNum,
            weekLabel: weekInfo.weekLabel,
            empId: r.empId,
            nameTH: r.nameTH || empInfo?.nameTH || '-',
            nameEN: r.nameEN || empInfo?.nameEN || '-',
            empType: 'Goodyear',
            areaKey: area.key,
            areaName: area.name,
            dept,
            position,
            machine,
            shift: r.shift,
            shiftLabel: r.shiftLabel || `กะ ${r.shift}`,
            inTime: r.inTimeFormatted || '-',
            lateMinutes: lMin,
            lateFormatted: `${lMin} นาที`,
            remark: r.otNote || '-'
          });
          dayLateCount++;
        }

        // Check Early Leave
        if (r.isEarlyLeave) {
          const eHours = r.effectiveWorkHours ? Math.round(Math.max(0, 8 - r.effectiveWorkHours) * 10) / 10 : 1;
          allEarlyRecords.push({
            id: `gy_early_${day}_${r.empId}`,
            dateStr,
            dayName,
            dayNum: day,
            weekNum: weekInfo.weekNum,
            weekLabel: weekInfo.weekLabel,
            empId: r.empId,
            nameTH: r.nameTH || empInfo?.nameTH || '-',
            nameEN: r.nameEN || empInfo?.nameEN || '-',
            empType: 'Goodyear',
            areaKey: area.key,
            areaName: area.name,
            dept,
            position,
            machine,
            shift: r.shift,
            shiftLabel: r.shiftLabel || `กะ ${r.shift}`,
            outTime: r.outTimeFormatted || '-',
            earlyHours: eHours,
            effectiveWorkHours: r.effectiveWorkHours || (8 - eHours),
            earlyFormatted: `กลับก่อน ${eHours} ชม. (ทำ ${r.effectiveWorkHours || 0} ชม.)`,
            remark: r.otNote || '-'
          });
          dayEarlyCount++;
        }
      });
    }

    // 2. Parse Contractor Records for this day
    const contEntry =
      contractorRecordsByDate[`${day}/9/2026`] ||
      contractorRecordsByDate[`${String(day).padStart(2, '0')}/09/2026`] ||
      contractorRecordsByDate[dateStr] ||
      contractorRecordsByDate[`2026-09-${String(day).padStart(2, '0')}`];

    if (contEntry && contEntry.records) {
      contEntry.records.forEach((r) => {
        const rawId = (r.empCode || '').replace(/\D/g, '');
        const empInfo = employeeMapping[r.empCode] || employeeMapping[rawId] || employeeMapping[rawId.padStart(5, '0')];
        const dept = r.department || r.deptRaw || empInfo?.dept || '';
        const costCenter = r.closing || empInfo?.costCenter || '';
        const mu = empInfo?.mu || '';
        const position = r.position || empInfo?.position || '-';
        const machine = empInfo?.machine || position;
        const area = resolveArea(mu, r.type || 'Contractor', dept, costCenter);

        // Check Contractor Late (Only single shift / no OT)
        const hasContOt = (r.otHours && r.otHours > 0) || (r.totalHours && r.totalHours > 8);
        const lMin = parseContLateMinutes(r.late);
        const isLateCont = lMin > 0 || (r.status && r.status.includes('สาย'));
        if (isLateCont && !hasContOt) {
          const finalLateMin = lMin > 0 ? lMin : 15;
          allLateRecords.push({
            id: `cont_late_${day}_${r.empCode}`,
            dateStr,
            dayName,
            dayNum: day,
            weekNum: weekInfo.weekNum,
            weekLabel: weekInfo.weekLabel,
            empId: r.empCode,
            nameTH: r.nameTh || empInfo?.nameTH || '-',
            nameEN: r.nameEn || empInfo?.nameEN || '-',
            empType: 'Contractor (WAS)',
            areaKey: area.key,
            areaName: area.name,
            dept,
            position,
            machine,
            shift: r.shiftNumber || 1,
            shiftLabel: r.shiftLabel || (r.shiftNumber ? `กะ ${r.shiftNumber}` : 'กะ 1 (07:00 - 15:00)'),
            inTime: r.scanIn || '-',
            lateMinutes: finalLateMin,
            lateFormatted: r.late || `${finalLateMin} นาที`,
            remark: r.remark || r.status || '-'
          });
          dayLateCount++;
        }

        // Check Contractor Early Out
        const eHours = parseContEarlyHours(r.earlyOut);
        const isEarlyCont = eHours > 0 || (r.status && r.status.includes('กลับก่อน'));
        if (isEarlyCont) {
          const finalEarlyH = eHours > 0 ? eHours : 1;
          allEarlyRecords.push({
            id: `cont_early_${day}_${r.empCode}`,
            dateStr,
            dayName,
            dayNum: day,
            weekNum: weekInfo.weekNum,
            weekLabel: weekInfo.weekLabel,
            empId: r.empCode,
            nameTH: r.nameTh || empInfo?.nameTH || '-',
            nameEN: r.nameEn || empInfo?.nameEN || '-',
            empType: 'Contractor (WAS)',
            areaKey: area.key,
            areaName: area.name,
            dept,
            position,
            machine,
            shift: r.shiftNumber || 1,
            shiftLabel: r.shiftLabel || (r.shiftNumber ? `กะ ${r.shiftNumber}` : 'กะ 1 (07:00 - 15:00)'),
            outTime: r.scanOut || '-',
            earlyHours: finalEarlyH,
            effectiveWorkHours: r.normalHours || (8 - finalEarlyH),
            earlyFormatted: r.earlyOut ? `กลับก่อน ${r.earlyOut}` : `กลับก่อน ${finalEarlyH} ชม.`,
            remark: r.remark || r.status || '-'
          });
          dayEarlyCount++;
        }
      });
    }

    availableDays.push({
      day,
      dateStr,
      dayName,
      lateCount: dayLateCount,
      earlyCount: dayEarlyCount
    });
  });

  // Calculate Weekly Summaries (Week 1 to Week 5)
  const weeklyMap = new Map<number, WeeklyStatSummary>();
  for (let w = 1; w <= 5; w++) {
    const sampleDay = (w - 1) * 7 + 1;
    const wInfo = getPlantWeekInfo(Math.min(30, sampleDay));
    weeklyMap.set(w, {
      weekNum: w,
      weekLabel: wInfo.weekLabel,
      dateRange: wInfo.dateRange,
      daysCount: 0,
      totalLateCount: 0,
      totalLateMinutes: 0,
      gyLateCount: 0,
      contLateCount: 0,
      totalEarlyCount: 0,
      totalEarlyHours: 0,
      gyEarlyCount: 0,
      contEarlyCount: 0,
      uniqueLateEmployees: 0,
      uniqueEarlyEmployees: 0
    });
  }

  // Populate Weekly Stats
  const lateByWeekEmp = new Map<number, Set<string>>();
  const earlyByWeekEmp = new Map<number, Set<string>>();

  allLateRecords.forEach((r) => {
    const w = weeklyMap.get(r.weekNum);
    if (w) {
      w.totalLateCount++;
      w.totalLateMinutes += r.lateMinutes;
      if (r.empType === 'Goodyear') w.gyLateCount++;
      else w.contLateCount++;

      if (!lateByWeekEmp.has(r.weekNum)) lateByWeekEmp.set(r.weekNum, new Set());
      lateByWeekEmp.get(r.weekNum)!.add(r.empId);
    }
  });

  allEarlyRecords.forEach((r) => {
    const w = weeklyMap.get(r.weekNum);
    if (w) {
      w.totalEarlyCount++;
      w.totalEarlyHours = Math.round((w.totalEarlyHours + r.earlyHours) * 10) / 10;
      if (r.empType === 'Goodyear') w.gyEarlyCount++;
      else w.contEarlyCount++;

      if (!earlyByWeekEmp.has(r.weekNum)) earlyByWeekEmp.set(r.weekNum, new Set());
      earlyByWeekEmp.get(r.weekNum)!.add(r.empId);
    }
  });

  // Days count per week
  availableDays.forEach((d) => {
    const wInfo = getPlantWeekInfo(d.day);
    const w = weeklyMap.get(wInfo.weekNum);
    if (w) w.daysCount++;
  });

  for (let w = 1; w <= 5; w++) {
    const item = weeklyMap.get(w)!;
    item.uniqueLateEmployees = lateByWeekEmp.get(w)?.size || 0;
    item.uniqueEarlyEmployees = earlyByWeekEmp.get(w)?.size || 0;
  }
  const weeklySummaries = [...weeklyMap.values()].filter((w) => w.daysCount > 0 || w.totalLateCount > 0 || w.totalEarlyCount > 0);

  // Calculate Area Summaries
  const areaMap = new Map<string, AreaStatSummary>();
  AREA_5_KEYS.forEach((k) => {
    const meta = AREA_5_METADATA[k];
    areaMap.set(k, {
      areaKey: k,
      areaName: meta.name,
      lateCount: 0,
      lateMinutes: 0,
      earlyCount: 0,
      earlyHours: 0,
      gyCount: 0,
      contCount: 0
    });
  });
  // Add Non-HPT
  areaMap.set('Non-HPT', {
    areaKey: 'Non-HPT',
    areaName: 'Non-HPT (หน่วยงานสนับสนุนส่วนกลาง)',
    lateCount: 0,
    lateMinutes: 0,
    earlyCount: 0,
    earlyHours: 0,
    gyCount: 0,
    contCount: 0
  });

  allLateRecords.forEach((r) => {
    let a = areaMap.get(r.areaKey);
    if (!a) {
      a = {
        areaKey: r.areaKey,
        areaName: r.areaName || r.areaKey,
        lateCount: 0,
        lateMinutes: 0,
        earlyCount: 0,
        earlyHours: 0,
        gyCount: 0,
        contCount: 0
      };
      areaMap.set(r.areaKey, a);
    }
    a.lateCount++;
    a.lateMinutes += r.lateMinutes;
    if (r.empType === 'Goodyear') a.gyCount++;
    else a.contCount++;
  });

  allEarlyRecords.forEach((r) => {
    let a = areaMap.get(r.areaKey);
    if (!a) {
      a = {
        areaKey: r.areaKey,
        areaName: r.areaName || r.areaKey,
        lateCount: 0,
        lateMinutes: 0,
        earlyCount: 0,
        earlyHours: 0,
        gyCount: 0,
        contCount: 0
      };
      areaMap.set(r.areaKey, a);
    }
    a.earlyCount++;
    a.earlyHours = Math.round((a.earlyHours + r.earlyHours) * 10) / 10;
    if (r.empType === 'Goodyear') a.gyCount++;
    else a.contCount++;
  });

  const areaSummaries = [...areaMap.values()].filter((a) => a.lateCount > 0 || a.earlyCount > 0 || AREA_5_KEYS.includes(a.areaKey as any));

  // Calculate Shift Summaries
  const shiftMap = new Map<number, ShiftStatSummary>([
    [1, { shift: 1, shiftLabel: 'กะ 1 (07:00 - 15:00)', lateCount: 0, lateMinutes: 0, earlyCount: 0, earlyHours: 0 }],
    [2, { shift: 2, shiftLabel: 'กะ 2 (15:00 - 23:00)', lateCount: 0, lateMinutes: 0, earlyCount: 0, earlyHours: 0 }],
    [3, { shift: 3, shiftLabel: 'กะ 3 (23:00 - 07:00)', lateCount: 0, lateMinutes: 0, earlyCount: 0, earlyHours: 0 }]
  ]);

  allLateRecords.forEach((r) => {
    const s = shiftMap.get(r.shift) || shiftMap.get(1)!;
    s.lateCount++;
    s.lateMinutes += r.lateMinutes;
  });

  allEarlyRecords.forEach((r) => {
    const s = shiftMap.get(r.shift) || shiftMap.get(1)!;
    s.earlyCount++;
    s.earlyHours = Math.round((s.earlyHours + r.earlyHours) * 10) / 10;
  });
  const shiftSummaries = [...shiftMap.values()];

  // Top Late Ranking (Top Violators)
  const lateEmpMap = new Map<string, TopViolatorItem>();
  allLateRecords.forEach((r) => {
    let item = lateEmpMap.get(r.empId);
    if (!item) {
      item = {
        empId: r.empId,
        nameTH: r.nameTH,
        nameEN: r.nameEN,
        empType: r.empType,
        areaKey: r.areaKey,
        areaName: r.areaName,
        dept: r.dept,
        position: r.position,
        count: 0,
        totalQuantity: 0,
        formattedQuantity: '',
        dates: []
      };
      lateEmpMap.set(r.empId, item);
    }
    item.count++;
    item.totalQuantity += r.lateMinutes;
    item.dates.push(`${r.dateStr} (${r.lateMinutes} น.)`);
  });
  lateEmpMap.forEach((v) => {
    v.formattedQuantity = `${v.totalQuantity} นาที`;
  });
  const topLateRanking = [...lateEmpMap.values()].sort((a, b) => b.count - a.count || b.totalQuantity - a.totalQuantity);

  // Top Early Ranking (Top Violators)
  const earlyEmpMap = new Map<string, TopViolatorItem>();
  allEarlyRecords.forEach((r) => {
    let item = earlyEmpMap.get(r.empId);
    if (!item) {
      item = {
        empId: r.empId,
        nameTH: r.nameTH,
        nameEN: r.nameEN,
        empType: r.empType,
        areaKey: r.areaKey,
        areaName: r.areaName,
        dept: r.dept,
        position: r.position,
        count: 0,
        totalQuantity: 0,
        formattedQuantity: '',
        dates: []
      };
      earlyEmpMap.set(r.empId, item);
    }
    item.count++;
    item.totalQuantity = Math.round((item.totalQuantity + r.earlyHours) * 10) / 10;
    item.dates.push(`${r.dateStr} (-${r.earlyHours}h)`);
  });
  earlyEmpMap.forEach((v) => {
    v.formattedQuantity = `${v.totalQuantity} ชม.`;
  });
  const topEarlyRanking = [...earlyEmpMap.values()].sort((a, b) => b.count - a.count || b.totalQuantity - a.totalQuantity);

  const totalLateCount = allLateRecords.length;
  const totalLateMinutes = allLateRecords.reduce((s, r) => s + r.lateMinutes, 0);
  const totalEarlyCount = allEarlyRecords.length;
  const totalEarlyHours = Math.round(allEarlyRecords.reduce((s, r) => s + r.earlyHours, 0) * 10) / 10;

  const uniqueLateEmployeesCount = new Set(allLateRecords.map((r) => r.empId)).size;
  const uniqueEarlyEmployeesCount = new Set(allEarlyRecords.map((r) => r.empId)).size;

  return {
    allLateRecords,
    allEarlyRecords,
    weeklySummaries,
    areaSummaries,
    shiftSummaries,
    topLateRanking,
    topEarlyRanking,
    totalLateCount,
    totalLateMinutes,
    totalEarlyCount,
    totalEarlyHours,
    uniqueLateEmployeesCount,
    uniqueEarlyEmployeesCount,
    availableDays
  };
}

/**
 * Generates and triggers Excel download for Late & Early Leave Dashboard
 */
export function exportLateEarlyExcel(
  dataset: LateEarlyDataset,
  selectedHorizon: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  selectedWeek: number | 'ALL',
  selectedDateStr: string
) {
  const wb = XLSX.utils.book_new();

  // Filter records based on current horizon
  let lateRows = dataset.allLateRecords;
  let earlyRows = dataset.allEarlyRecords;

  if (selectedHorizon === 'DAILY' && selectedDateStr) {
    lateRows = lateRows.filter((r) => r.dateStr === selectedDateStr);
    earlyRows = earlyRows.filter((r) => r.dateStr === selectedDateStr);
  } else if (selectedHorizon === 'WEEKLY' && selectedWeek !== 'ALL') {
    lateRows = lateRows.filter((r) => r.weekNum === selectedWeek);
    earlyRows = earlyRows.filter((r) => r.weekNum === selectedWeek);
  }

  // Sheet 1: Monthly & Weekly KPI Summary
  const summaryData = [
    { 'หัวข้อสรุป': 'จำนวนครั้งมาสายรวม (ครั้ง)', 'Goodyear': lateRows.filter(r => r.empType === 'Goodyear').length, 'Contractor (WAS)': lateRows.filter(r => r.empType === 'Contractor (WAS)').length, 'รวมทั้งสิ้น': lateRows.length },
    { 'หัวข้อสรุป': 'เวลารวมที่มาสาย (นาที)', 'Goodyear': lateRows.filter(r => r.empType === 'Goodyear').reduce((s,r) => s+r.lateMinutes, 0), 'Contractor (WAS)': lateRows.filter(r => r.empType === 'Contractor (WAS)').reduce((s,r) => s+r.lateMinutes, 0), 'รวมทั้งสิ้น': lateRows.reduce((s,r) => s+r.lateMinutes, 0) },
    { 'หัวข้อสรุป': 'จำนวนคนมาสาย (Unique คน)', 'Goodyear': new Set(lateRows.filter(r => r.empType === 'Goodyear').map(r => r.empId)).size, 'Contractor (WAS)': new Set(lateRows.filter(r => r.empType === 'Contractor (WAS)').map(r => r.empId)).size, 'รวมทั้งสิ้น': new Set(lateRows.map(r => r.empId)).size },
    { 'หัวข้อสรุป': 'จำนวนครั้งลากลับก่อน (ครั้ง)', 'Goodyear': earlyRows.filter(r => r.empType === 'Goodyear').length, 'Contractor (WAS)': earlyRows.filter(r => r.empType === 'Contractor (WAS)').length, 'รวมทั้งสิ้น': earlyRows.length },
    { 'หัวข้อสรุป': 'เวลารวมที่กลับก่อน (ชม.)', 'Goodyear': Math.round(earlyRows.filter(r => r.empType === 'Goodyear').reduce((s,r) => s+r.earlyHours, 0)*10)/10, 'Contractor (WAS)': Math.round(earlyRows.filter(r => r.empType === 'Contractor (WAS)').reduce((s,r) => s+r.earlyHours, 0)*10)/10, 'รวมทั้งสิ้น': Math.round(earlyRows.reduce((s,r) => s+r.earlyHours, 0)*10)/10 },
    { 'หัวข้อสรุป': 'จำนวนคนกลับก่อน (Unique คน)', 'Goodyear': new Set(earlyRows.filter(r => r.empType === 'Goodyear').map(r => r.empId)).size, 'Contractor (WAS)': new Set(earlyRows.filter(r => r.empType === 'Contractor (WAS)').map(r => r.empId)).size, 'รวมทั้งสิ้น': new Set(earlyRows.map(r => r.empId)).size }
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary_KPI');

  // Sheet 2: Weekly Trends
  const weeklyData = dataset.weeklySummaries.map(w => ({
    'สัปดาห์': w.weekLabel,
    'ช่วงวันที่': w.dateRange,
    'จำนวนวันที่เปิดทำงาน': w.daysCount,
    'สายรวม (ครั้ง)': w.totalLateCount,
    'สายรวม (นาที)': w.totalLateMinutes,
    'สาย - GY (ครั้ง)': w.gyLateCount,
    'สาย - Contractor (ครั้ง)': w.contLateCount,
    'จำนวนคนสาย (คน)': w.uniqueLateEmployees,
    'กลับก่อนรวม (ครั้ง)': w.totalEarlyCount,
    'กลับก่อนรวม (ชม.)': w.totalEarlyHours,
    'กลับก่อน - GY (ครั้ง)': w.gyEarlyCount,
    'กลับก่อน - Contractor (ครั้ง)': w.contEarlyCount,
    'จำนวนคนกลับก่อน (คน)': w.uniqueEarlyEmployees
  }));
  const wsWeekly = XLSX.utils.json_to_sheet(weeklyData);
  XLSX.utils.book_append_sheet(wb, wsWeekly, 'Weekly_Trends');

  // Sheet 3: Area Breakdown
  const areaData = dataset.areaSummaries.map(a => ({
    'พื้นที่การผลิต': a.areaKey,
    'ชื่อกลุ่มโรงงาน': a.areaName,
    'สายรวม (ครั้ง)': a.lateCount,
    'เวลารวมที่สาย (นาที)': a.lateMinutes,
    'กลับก่อนรวม (ครั้ง)': a.earlyCount,
    'เวลารวมที่กลับก่อน (ชม.)': a.earlyHours,
    'Goodyear รวม (ครั้ง)': a.gyCount,
    'Contractor รวม (ครั้ง)': a.contCount
  }));
  const wsArea = XLSX.utils.json_to_sheet(areaData);
  XLSX.utils.book_append_sheet(wb, wsArea, 'Area_Breakdown');

  // Sheet 4: Late Arrivals Details
  const lateDetails = lateRows.map((r, idx) => ({
    'ลำดับ': idx + 1,
    'วันที่': r.dateStr,
    'วันในสัปดาห์': r.dayName,
    'สัปดาห์': r.weekLabel,
    'รหัสพนักงาน': r.empId,
    'ชื่อ-นามสกุล (TH)': r.nameTH,
    'Name (EN)': r.nameEN,
    'ประเภทพนักงาน': r.empType,
    'พื้นที่หลัก (Area)': r.areaKey,
    'ชื่อพื้นที่': r.areaName,
    'แผนก / Cost Center': r.dept,
    'ตำแหน่ง (Position)': r.position,
    'เครื่องจักร (Machine)': r.machine,
    'กะการทำงาน (Shift)': r.shiftLabel,
    'เวลาสแกนเข้า (IN)': r.inTime,
    'สาย (นาที)': r.lateMinutes,
    'หมายเหตุ': r.remark
  }));
  const wsLate = XLSX.utils.json_to_sheet(lateDetails);
  XLSX.utils.book_append_sheet(wb, wsLate, 'Late_Arrivals_List');

  // Sheet 5: Early Leave Details
  const earlyDetails = earlyRows.map((r, idx) => ({
    'ลำดับ': idx + 1,
    'วันที่': r.dateStr,
    'วันในสัปดาห์': r.dayName,
    'สัปดาห์': r.weekLabel,
    'รหัสพนักงาน': r.empId,
    'ชื่อ-นามสกุล (TH)': r.nameTH,
    'Name (EN)': r.nameEN,
    'ประเภทพนักงาน': r.empType,
    'พื้นที่หลัก (Area)': r.areaKey,
    'ชื่อพื้นที่': r.areaName,
    'แผนก / Cost Center': r.dept,
    'ตำแหน่ง (Position)': r.position,
    'เครื่องจักร (Machine)': r.machine,
    'กะการทำงาน (Shift)': r.shiftLabel,
    'เวลาสแกนออก (OUT)': r.outTime,
    'กลับก่อน (ชม.)': r.earlyHours,
    'ชั่วโมงทำงานจริง (ชม.)': r.effectiveWorkHours,
    'หมายเหตุ': r.remark
  }));
  const wsEarly = XLSX.utils.json_to_sheet(earlyDetails);
  XLSX.utils.book_append_sheet(wb, wsEarly, 'Early_Leave_List');

  // Sheet 6: Top Ranking (Violators)
  const topLateData = dataset.topLateRanking.slice(0, 20).map((r, idx) => ({
    'อันดับ': idx + 1,
    'ประเภท': 'มาสาย (Late)',
    'รหัสพนักงาน': r.empId,
    'ชื่อ-นามสกุล': r.nameTH,
    'Name (EN)': r.nameEN,
    'ประเภทพนักงาน': r.empType,
    'พื้นที่': r.areaKey,
    'แผนก': r.dept,
    'จำนวนครั้งที่สาย': r.count,
    'เวลารวม': r.formattedQuantity,
    'วันที่บันทึก': r.dates.join(', ')
  }));
  const topEarlyData = dataset.topEarlyRanking.slice(0, 20).map((r, idx) => ({
    'อันดับ': idx + 1,
    'ประเภท': 'กลับก่อน (Early Leave)',
    'รหัสพนักงาน': r.empId,
    'ชื่อ-นามสกุล': r.nameTH,
    'Name (EN)': r.nameEN,
    'ประเภทพนักงาน': r.empType,
    'พื้นที่': r.areaKey,
    'แผนก': r.dept,
    'จำนวนครั้งที่กลับก่อน': r.count,
    'เวลารวม': r.formattedQuantity,
    'วันที่บันทึก': r.dates.join(', ')
  }));
  const wsRanking = XLSX.utils.json_to_sheet([...topLateData, ...topEarlyData]);
  XLSX.utils.book_append_sheet(wb, wsRanking, 'Top_Frequent_Ranking');

  const cleanDate = (selectedDateStr || 'September_2026').replace(/[\/\\]/g, '-');
  const filename = `Attendance_Late_Early_Report_${cleanDate}_${selectedHorizon}.xlsx`;
  XLSX.writeFile(wb, filename);
}
