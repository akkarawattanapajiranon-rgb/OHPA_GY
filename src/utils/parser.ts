import {
  RawScanRecord,
  EmployeeInfo,
  ParsedShiftRecord,
  ShiftType,
  ShiftSummary,
  DepartmentSummary,
  ManpowerComparisonRow,
  OtCategorySummary,
  OverallKPIs
} from '../types/attendance';
import { TEAM_A_STANDARD_HC } from '../data/teamA_standard_hc';

export function parseScanLine(line: string): RawScanRecord | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length < 5) return null;

  const empId = parts[0].padStart(5, '0');
  const io = parts[1].toUpperCase() as 'I' | 'O';
  const dateStr = parts[2];
  const timeHHMM = parts[3];
  const timeSS = parts[4];

  if (dateStr.length !== 8 || timeHHMM.length !== 4) return null;

  const month = parseInt(dateStr.slice(0, 2), 10);
  const day = parseInt(dateStr.slice(2, 4), 10);
  const year = parseInt(dateStr.slice(4, 8), 10);

  const hh = parseInt(timeHHMM.slice(0, 2), 10);
  const mm = parseInt(timeHHMM.slice(2, 4), 10);
  const ss = parseInt(timeSS, 10) || 0;

  const timestamp = new Date(year, month - 1, day, hh, mm, ss);

  return {
    empId,
    io,
    dateStr,
    timeHHMM,
    timeSS,
    timestamp,
    rawText: trimmed
  };
}

export function determineShift(inTime: Date): ShiftType {
  const hh = inTime.getHours();
  const mm = inTime.getMinutes();
  const mins = hh * 60 + mm;

  // Shift 1: 07:00 - 15:00 (Entry window: 04:00 - 11:30)
  if (mins >= 4 * 60 && mins <= 11 * 60 + 30) {
    return 1;
  } else if (mins > 11 * 60 + 30 && mins <= 17 * 60 + 30) {
    // Shift 2: 15:00 - 23:00 (Entry window: 11:31 - 17:30)
    return 2;
  } else {
    // Shift 3: 23:00 - 07:00 (Entry window: 17:31 - 03:59)
    return 3;
  }
}

export function determineShiftFromOut(outTime: Date): ShiftType {
  const hh = outTime.getHours();
  const mm = outTime.getMinutes();
  const mins = hh * 60 + mm;

  // Shift 1 out 15:00 (Window: 12:00 - 19:30)
  if (mins >= 12 * 60 && mins <= 19 * 60 + 30) {
    return 1;
  } else if (mins > 19 * 60 + 30 || mins <= 3 * 60 + 30) {
    // Shift 2 out 23:00 (Window: 19:31 - 03:30)
    return 2;
  } else {
    // Shift 3 out 07:00 (Window: 03:31 - 11:59)
    return 3;
  }
}

function formatTime(d: Date | null): string {
  if (!d) return '-';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} น.`;
}

export function mapBcaPosToStdPosition(bcaPos: string, dept: string, machine?: string): string | null {
  const m = (machine || '').toLowerCase();
  const p = (bcaPos || '').toLowerCase();
  const d = (dept || '');

  // 1. Prioritize Team Leaders
  if (m.includes('team leader') || p.includes('team leader') || (p.includes('leader') && !p.includes('calender') && !p.includes('quad') && !p.includes('cfe'))) {
    return 'Leader';
  }

  // Dept 3200 (Banbury & Pigment)
  if (m.includes('mixer 1') || p.includes('banbury 1')) return '320 BANBURY # 1';
  if (m.includes('mixer 2') || p.includes('banbury 2')) return '320 BANBURY # 2';
  if (m.includes('auto pigment') || m.includes('pigment') || p.includes('pigment') || d.includes('3200')) return '320 Pigment';

  // Dept 3300 (3ROII / Calender) - strictly for Dept 3300
  if (d.includes('3300')) return '330 3ROII';

  // Dept 3700 (Cement / 3roll)
  if (d.includes('3700') || p.includes('cement')) return 'Cement (3roll)';

  // Dept 4110 (Chafer, Lux, Fischer, 4Roll)
  if (m.includes('4-roll calender 1')) return '411 4Roll#1';
  if (m.includes('4-roll calender 2')) return '411 4Roll#2';
  if (m.includes('chaffer') || m.includes('chafer') || p.includes('chafer')) return '411 Chafer lay up';
  if (m.includes('gum slitter') || m.includes('kao yeh') || m.includes('lux') || p.includes('lux') || p.includes('slitter')) return '411 Lux/slitter';
  if (m.includes('fischer') || m.includes('shear') || p.includes('fischer') || p.includes('shear') || p.includes('bias')) return '411 Shear Fiscer';
  if (d.includes('4110') || p.includes('4-roll') || p.includes('mill operator') || p.includes('let-off') || p.includes('wind up')) {
    return '411 4Roll#1';
  }

  // Dept 4120 / 4130 (Band)
  if (d.includes('4120') || m.includes('54') || p.includes('54')) return '412 Band54"';
  if (d.includes('4130') || m.includes('72') || p.includes('72')) return '413 Band72"';

  // Dept 4200 (Bead)
  if (m.includes('hot apexer') || p.includes('apexer') || p.includes('apex')) return '420 Hot apexer';
  if (m.includes('bead flapper') || p.includes('flapper') || p.includes('flap')) return '420 Bead Flap';
  if (m.includes('bead insulate') || p.includes('insulate') || p.includes('insulation')) return '420 Bead insulation';
  if (m.includes('bead wrapper') || p.includes('wrapper') || p.includes('wrap')) return '420 Bead Wrap';
  if (m.includes('hex bead') || p.includes('hex')) return '420 Hex Bead';

  // Dept 4300 (Tuber & Quad)
  if (m.includes('quad') || p.includes('quad')) return '430 Quad';
  if (d.includes('4300') || m.includes('duplex') || m.includes('6" x 8"') || m.includes('tuber') || p.includes('cfe') || p.includes('tuber') || p.includes('booker')) {
    return '430 6"x8" Tuber';
  }

  if (p.includes('leader')) return 'Leader';

  return null;
}

export function processScanRecords(
  fileContent: string,
  employeeMap: Record<string, EmployeeInfo> = {}
): {
  records: ParsedShiftRecord[];
  shiftSummaries: ShiftSummary[];
  departmentSummaries: DepartmentSummary[];
  manpowerComparison: ManpowerComparisonRow[];
  otCategorySummary: OtCategorySummary;
  overallKPIs: OverallKPIs;
  dateStringFormatted: string;
} {
  const lines = fileContent.split(/\r?\n/);
  const rawScans: RawScanRecord[] = [];

  lines.forEach(l => {
    const parsed = parseScanLine(l);
    if (parsed) rawScans.push(parsed);
  });

  if (rawScans.length === 0) {
    return {
      records: [],
      shiftSummaries: [],
      departmentSummaries: [],
      manpowerComparison: [],
      otCategorySummary: {
        scheduledOtWorkers: 0,
        scheduledOtHours: 0,
        overstaffOtWorkers: 0,
        overstaffOtHours: 0,
        replacementOtWorkers: 0,
        replacementOtHours: 0,
        totalOtHours: 0
      },
      overallKPIs: {
        totalWorkers: 0,
        totalNormalWorkHours: 0,
        totalOtWorkers: 0,
        totalOtHours: 0,
        totalLateWorkers: 0,
        totalMissingPunches: 0,
        uniqueDepartmentsCount: 0,
        scanDateFormatted: '-',
        overstaffWorkersCount: 0,
        understaffPositionsCount: 0,
        overstaffOtHoursTotal: 0,
        replacementOtHoursTotal: 0
      },
      dateStringFormatted: '-'
    };
  }

  // Filter raw scans within 120s duplicate window
  // Filter raw scans within 120s duplicate window (only deduplicate if same IO direction)
  const scansByEmp: Record<string, RawScanRecord[]> = {};
  rawScans.forEach(s => {
    if (!employeeMap[s.empId]) return; // Only process mapped employees (Team A)

    if (!scansByEmp[s.empId]) {
      scansByEmp[s.empId] = [s];
    } else {
      const sameIoScans = scansByEmp[s.empId].filter(prev => prev.io === s.io);
      if (sameIoScans.length === 0) {
        scansByEmp[s.empId].push(s);
      } else {
        const lastSameIo = sameIoScans[sameIoScans.length - 1];
        const diffMs = s.timestamp.getTime() - lastSameIo.timestamp.getTime();
        if (diffMs >= 120 * 1000) {
          scansByEmp[s.empId].push(s);
        }
      }
    }
  });

  // Track Standard HC counts for each position
  const actualCounts: Record<string, { shift1: number; shift2: number; shift3: number }> = {};
  TEAM_A_STANDARD_HC.forEach(std => {
    actualCounts[std.positionName] = { shift1: 0, shift2: 0, shift3: 0 };
  });

  const processedRecords: ParsedShiftRecord[] = [];
  const uniqueEmpIds = Object.keys(scansByEmp).sort();

  uniqueEmpIds.forEach(empId => {
    const empInfo: EmployeeInfo = employeeMap[empId] || { empId };
    const empScans = scansByEmp[empId];
    const ins = empScans.filter(s => s.io === 'I');
    const outs = empScans.filter(s => s.io === 'O');

    const inScan = ins.length > 0 ? ins[0] : null;

    // Pick best matching out scan
    let outScan: RawScanRecord | null = null;
    if (inScan && outs.length > 0) {
      // Exclude outs at the exact same minute (< 60s) as inScan
      const distinctOuts = outs.filter(o => Math.abs(o.timestamp.getTime() - inScan.timestamp.getTime()) >= 60 * 1000);
      if (distinctOuts.length > 0) {
        const validOuts = distinctOuts.filter(o => o.timestamp.getTime() > inScan.timestamp.getTime());
        if (validOuts.length > 0) {
          outScan = validOuts[validOuts.length - 1]; // Latest out for total working hours / OT
        } else {
          outScan = distinctOuts[0];
        }
      }
    } else if (outs.length > 0) {
      outScan = outs[0];
    }

    // Determine shift
    let shiftNum: ShiftType = 1;
    let isPreShiftReliefOt = false;

    if (inScan && outScan) {
      const inHh = inScan.timestamp.getHours();
      const inMm = inScan.timestamp.getMinutes();
      const outHh = outScan.timestamp.getHours();
      const outMm = outScan.timestamp.getMinutes();

      // Case A: Shift 2 Pre-shift Break Relief (Arrive 10:00 - 11:30, leave 22:30 - 23:30 or later)
      if (inHh >= 10 && (inHh < 11 || (inHh === 11 && inMm <= 30)) && (outHh >= 22 || (outHh === 23 && outMm <= 30) || (outHh === 0 && outMm <= 30) || outHh <= 7)) {
        shiftNum = 2;
        isPreShiftReliefOt = true;
      }
      // Case B: Shift 3 Pre-shift Break Relief (Arrive 17:30 - 19:30 before 19:00, leave morning 06:00 - 12:00)
      else if ((inHh >= 17 && (inHh < 19 || (inHh === 19 && inMm <= 30))) && (outHh >= 6 && outHh <= 12)) {
        shiftNum = 3;
        isPreShiftReliefOt = true;
      } else {
        shiftNum = determineShift(inScan.timestamp);
      }
    } else if (inScan) {
      shiftNum = determineShift(inScan.timestamp);
    } else if (outScan) {
      shiftNum = determineShiftFromOut(outScan.timestamp);
    }

    const shiftLabel = shiftNum === 1
      ? 'กะ 1 (07:00 - 15:00)'
      : shiftNum === 2
      ? 'กะ 2 (15:00 - 23:00)'
      : 'กะ 3 (23:00 - 07:00)';

    // Check Late Status
    let isLate = false;
    let lateMinutes = 0;
    if (isPreShiftReliefOt) {
      // Arrived early before shift start for break relief OT -> on time
      isLate = false;
      lateMinutes = 0;
    } else if (inScan) {
      const inHh = inScan.timestamp.getHours();
      const inMm = inScan.timestamp.getMinutes();
      if (shiftNum === 1) {
        // Shift 1 start: 07:00 (Grace period 7 mins -> 07:07)
        if (inHh > 7 || (inHh === 7 && inMm > 7)) {
          isLate = true;
          lateMinutes = (inHh - 7) * 60 + inMm;
        }
      } else if (shiftNum === 2) {
        // Shift 2 start: 15:00 (Grace period 7 mins -> 15:07)
        if (inHh > 15 || (inHh === 15 && inMm > 7)) {
          isLate = true;
          lateMinutes = (inHh - 15) * 60 + inMm;
        }
      } else if (shiftNum === 3) {
        // Shift 3 start: 23:00 (Early entry 17:31 - 23:07 is on-time)
        // Late if scanned between 23:08 and 06:00
        if (inHh === 23 && inMm > 7) {
          isLate = true;
          lateMinutes = inMm;
        } else if (inHh >= 0 && inHh < 6) {
          isLate = true;
          lateMinutes = (inHh + 1) * 60 + inMm;
        }
      }
    }

    // Calculate Working Hours and OT
    let effectiveWorkHours = 8;
    let normalWorkHours = 8;
    let otHours = 0;
    let otNote = '-';

    if (inScan && outScan) {
      const inHh = inScan.timestamp.getHours();
      const inMm = inScan.timestamp.getMinutes();
      const inMins = inHh * 60 + inMm;

      const outHh = outScan.timestamp.getHours();
      const outMm = outScan.timestamp.getMinutes();
      const outMins = outHh * 60 + outMm;

      // Calculate total work hours
      let durationHours = 0;
      if (outScan.timestamp.getTime() > inScan.timestamp.getTime()) {
        durationHours = (outScan.timestamp.getTime() - inScan.timestamp.getTime()) / (1000 * 60 * 60);
      } else if (shiftNum === 3 || isPreShiftReliefOt || (inHh >= 14 && outHh <= 12)) {
        // Shift crossing midnight
        const totalOutMins = (outHh + 24) * 60 + outMm;
        durationHours = (totalOutMins - inMins) / 60;
      }
      effectiveWorkHours = Math.round(durationHours * 10) / 10;

      let preOtHours = 0;
      let postOtHours = 0;

      // 1. Pre-shift Break Relief OT (Only when scheduled for break relief)
      if (shiftNum === 2 && isPreShiftReliefOt) {
        preOtHours = 4; // 11:00 - 15:00
      } else if (shiftNum === 3 && isPreShiftReliefOt) {
        preOtHours = 4; // 19:00 - 23:00
      }

      // 2. Post-shift OT (calculated as standard OT hours with transit/checkout grace buffer)
      if (shiftNum === 1) {
        // Shift 1: 07:00 to 15:00
        // Only consider crossing midnight if duration is long (> 14h) and outHh <= 12
        const isNextDay = (outScan.timestamp.getTime() - inScan.timestamp.getTime()) > 14 * 3600 * 1000 && outHh <= 12;
        const totalOutMins = isNextDay ? (outHh + 24) * 60 + outMm : outMins;
        const minsPastShift = totalOutMins - 15 * 60;
        if (minsPastShift >= 45) { // At least 45 mins past shift end (1h OT = 16:00, 2h = 17:00, 3h = 18:00, 4h = 19:00, 8h = 23:00)
          postOtHours = Math.floor((minsPastShift + 15) / 60);
        }
      } else if (shiftNum === 2) {
        // Shift 2: 15:00 to 23:00
        const isNextDay = outHh < 12;
        const totalOutMins = isNextDay ? (outHh + 24) * 60 + outMm : outMins;
        const minsPastShift = totalOutMins - 23 * 60;
        if (minsPastShift >= 45) {
          postOtHours = Math.floor((minsPastShift + 15) / 60);
        }
      } else if (shiftNum === 3) {
        // Shift 3: 23:00 to 07:00
        if (outMins >= 7 * 60 + 45 && outMins <= 19 * 60) {
          const minsPastShift = outMins - 7 * 60;
          if (minsPastShift >= 45) {
            postOtHours = Math.floor((minsPastShift + 15) / 60);
          }
        }
      }

      otHours = preOtHours + postOtHours;
      if (otHours >= 1) {
        otNote = `OT ${otHours} ชม.`;
      }
      normalWorkHours = Math.min(8, Math.max(0, effectiveWorkHours - otHours));
    } else if (!inScan || !outScan) {
      effectiveWorkHours = 0;
      normalWorkHours = 0;
    }

    // Check Early Leave (worked less than 7.5 hours and no OT)
    const isEarlyLeave = Boolean(inScan && outScan && effectiveWorkHours > 0 && effectiveWorkHours < 7.5 && otHours === 0);
    const earlyLeaveHours = isEarlyLeave ? Math.round((8 - effectiveWorkHours) * 10) / 10 : 0;

    const machine = empInfo.machine || empInfo.position || '-';
    const position = empInfo.position || '-';
    const dept = empInfo.dept || 'ไม่ระบุแผนก';

    // Increment Standard HC actual count
    const stdPosName = mapBcaPosToStdPosition(position, dept, machine);
    if (stdPosName && actualCounts[stdPosName]) {
      if (shiftNum === 1) actualCounts[stdPosName].shift1++;
      if (shiftNum === 2) actualCounts[stdPosName].shift2++;
      if (shiftNum === 3) actualCounts[stdPosName].shift3++;
    }

    const officialStart = inScan ? inScan.timestamp : new Date();
    const officialEnd = outScan ? outScan.timestamp : new Date();

    processedRecords.push({
      id: `${empId}-record`,
      empId,
      nameTH: empInfo.nameTH || `พนักงาน ${empId}`,
      nameEN: empInfo.nameEN || `Emp ${empId}`,
      machine,
      position,
      dept,
      shift: shiftNum,
      shiftLabel,
      dateStr: inScan ? inScan.dateStr : (outScan ? outScan.dateStr : '-'),
      inTime: inScan ? inScan.timestamp : null,
      outTime: outScan ? outScan.timestamp : null,
      inTimeFormatted: formatTime(inScan ? inScan.timestamp : null),
      outTimeFormatted: formatTime(outScan ? outScan.timestamp : null),
      officialStart,
      officialEnd,
      effectiveWorkHours,
      normalWorkHours,
      otHours,
      otNote,
      otCategory: otHours > 0 ? 'SCHEDULED' : 'NONE',
      isLate,
      lateMinutes,
      isEarlyLeave,
      earlyLeaveHours,
      isEarlyScan: false,
      isPreShiftReliefOt,
      hasMissingPunch: !inScan || !outScan,
      missingPunchType: !inScan ? 'MISSING_IN' : (!outScan ? 'MISSING_OUT' : undefined),
      manpowerStatus: 'EXACT',
      manpowerStatusLabel: 'จัดคนพอดี'
    });
  });

  // Pre-calculate OT hours covering each shift for each Standard HC position
  const posOtCoverage: Record<string, {
    s1OtHours: number;
    s2OtHours: number;
    s3OtHours: number;
  }> = {};

  TEAM_A_STANDARD_HC.forEach(std => {
    posOtCoverage[std.positionName] = {
      s1OtHours: 0,
      s2OtHours: 0,
      s3OtHours: 0
    };
  });

  processedRecords.forEach(r => {
    const stdPosName = mapBcaPosToStdPosition(r.position, r.dept, r.machine);
    if (!stdPosName || !posOtCoverage[stdPosName] || r.otHours <= 0) return;

    if (r.shift === 1) {
      // Shift 1 worker: Post-shift OT (past 15:00) covers Shift 2, and any excess past 23:00 covers Shift 3
      if (r.otHours <= 8) {
        posOtCoverage[stdPosName].s2OtHours += r.otHours;
      } else {
        posOtCoverage[stdPosName].s2OtHours += 8;
        posOtCoverage[stdPosName].s3OtHours += (r.otHours - 8);
      }
    } else if (r.shift === 2) {
      // Shift 2 worker:
      // If early break relief OT (in 10:00 - 11:30, out around 23:00) -> covers Shift 1
      // If stayed late into night/morning (out past 02:00, e.g. 07:00 morning) -> covers Shift 3
      const outH = r.outTime ? r.outTime.getHours() : 23;
      if (r.isPreShiftReliefOt && outH >= 22 && outH <= 23) {
        posOtCoverage[stdPosName].s1OtHours += r.otHours;
      } else {
        posOtCoverage[stdPosName].s3OtHours += r.otHours;
      }
    } else if (r.shift === 3) {
      // Shift 3 worker:
      // If early scan before 22:00 (e.g. 17:30-19:30 pre-shift break relief), covers Shift 2; otherwise covers Shift 1
      const inH = r.inTime ? r.inTime.getHours() : 23;
      if (inH >= 17 && inH < 22) {
        posOtCoverage[stdPosName].s2OtHours += r.otHours;
      } else {
        posOtCoverage[stdPosName].s1OtHours += r.otHours;
      }
    }
  });

  // Build ManpowerComparison Rows based on TEAM_A_STANDARD_HC
  const manpowerComparison: ManpowerComparisonRow[] = TEAM_A_STANDARD_HC.map(std => {
    const actuals = actualCounts[std.positionName] || { shift1: 0, shift2: 0, shift3: 0 };
    const otCov = posOtCoverage[std.positionName] || { s1OtHours: 0, s2OtHours: 0, s3OtHours: 0 };

    let s1Target = std.shift1Target;
    let s2Target = std.shift2Target;
    let s3Target = std.shift3Target;

    // Support flexible shift pattern for Hot Apexer (3-3-2 / 2-3-3 / 3-2-3 total 8)
    if (std.positionName.toLowerCase().includes('hot apexer')) {
      const HOT_APEXER_PATTERNS = [
        [3, 3, 2],
        [2, 3, 3],
        [3, 2, 3]
      ];
      let matched = false;
      for (const [p1, p2, p3] of HOT_APEXER_PATTERNS) {
        if (actuals.shift1 === p1 && actuals.shift2 === p2 && actuals.shift3 === p3) {
          s1Target = p1;
          s2Target = p2;
          s3Target = p3;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Pick best matching rotation pattern
        let bestPattern = HOT_APEXER_PATTERNS[0];
        let minDiff = Infinity;
        for (const p of HOT_APEXER_PATTERNS) {
          const diff = Math.abs(actuals.shift1 - p[0]) + Math.abs(actuals.shift2 - p[1]) + Math.abs(actuals.shift3 - p[2]);
          if (diff < minDiff) {
            minDiff = diff;
            bestPattern = p;
          }
        }
        s1Target = bestPattern[0];
        s2Target = bestPattern[1];
        s3Target = bestPattern[2];
      }
    }

    // Calculate effective actual headcount including OT support
    const s1OtHC = Math.round(otCov.s1OtHours / 8);
    let s1Actual = actuals.shift1;
    if (s1Target > 0 && actuals.shift1 < s1Target && s1OtHC > 0) {
      s1Actual = actuals.shift1 + s1OtHC;
    }

    const s2OtHC = Math.round(otCov.s2OtHours / 8);
    let s2Actual = actuals.shift2;
    if (s2Target > 0 && actuals.shift2 < s2Target && s2OtHC > 0) {
      s2Actual = actuals.shift2 + s2OtHC;
    }

    const s3OtHC = Math.round(otCov.s3OtHours / 8);
    let s3Actual = actuals.shift3;
    if (s3Target > 0 && actuals.shift3 < s3Target && s3OtHC > 0) {
      s3Actual = actuals.shift3 + s3OtHC;
    }

    const s1Gap = s1Actual - s1Target;
    const s2Gap = s2Actual - s2Target;
    const s3Gap = s3Actual - s3Target;

    const getStatus = (target: number, actual: number): 'EXACT' | 'OVER' | 'UNDER' => {
      if (actual === target) return 'EXACT';
      return actual > target ? 'OVER' : 'UNDER';
    };

    return {
      id: std.id,
      positionName: std.positionName,
      costCenter: std.costCenter,
      shift1Target: s1Target,
      shift1Actual: s1Actual,
      shift1Regular: actuals.shift1,
      shift1OtHC: s1OtHC,
      shift1OtHours: otCov.s1OtHours,
      shift1Gap: s1Gap,
      shift1Status: getStatus(s1Target, s1Actual),

      shift2Target: s2Target,
      shift2Actual: s2Actual,
      shift2Regular: actuals.shift2,
      shift2OtHC: s2OtHC,
      shift2OtHours: otCov.s2OtHours,
      shift2Gap: s2Gap,
      shift2Status: getStatus(s2Target, s2Actual),

      shift3Target: s3Target,
      shift3Actual: s3Actual,
      shift3Regular: actuals.shift3,
      shift3OtHC: s3OtHC,
      shift3OtHours: otCov.s3OtHours,
      shift3Gap: s3Gap,
      shift3Status: getStatus(s3Target, s3Actual)
    };
  });

  // Overall KPIs
  const totalWorkers = processedRecords.length;
  const totalNormalWorkHours = processedRecords.reduce((sum, r) => sum + r.normalWorkHours, 0);
  const totalOtWorkers = processedRecords.filter(r => r.otHours > 0).length;
  const totalOtHours = processedRecords.reduce((sum, r) => sum + r.otHours, 0);
  const totalLateWorkers = processedRecords.filter(r => r.isLate).length;
  const totalMissingPunches = processedRecords.filter(r => r.hasMissingPunch).length;
  const uniqueDepts = new Set(processedRecords.map(r => r.dept));

  const firstDate = processedRecords.find(r => r.dateStr && r.dateStr.length === 8);
  let dateStringFormatted = '-';
  if (firstDate) {
    const mm = firstDate.dateStr.slice(0, 2);
    const dd = firstDate.dateStr.slice(2, 4);
    const yyyy = firstDate.dateStr.slice(4, 8);
    dateStringFormatted = `${dd}/${mm}/${yyyy}`;
  }

  return {
    records: processedRecords,
    shiftSummaries: [],
    departmentSummaries: [],
    manpowerComparison,
    otCategorySummary: {
      scheduledOtWorkers: totalOtWorkers,
      scheduledOtHours: totalOtHours,
      overstaffOtWorkers: 0,
      overstaffOtHours: 0,
      replacementOtWorkers: 0,
      replacementOtHours: 0,
      totalOtHours: totalOtHours
    },
    overallKPIs: {
      totalWorkers,
      totalNormalWorkHours,
      totalOtWorkers,
      totalOtHours,
      totalLateWorkers,
      totalMissingPunches,
      uniqueDepartmentsCount: uniqueDepts.size,
      scanDateFormatted: dateStringFormatted,
      overstaffWorkersCount: 0,
      understaffPositionsCount: 0,
      overstaffOtHoursTotal: 0,
      replacementOtHoursTotal: 0
    },
    dateStringFormatted
  };
}
