import * as XLSX from 'xlsx';
import { ParsedShiftRecord, EmployeeInfo } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { StockingTonnageReport, OhpaAreaMetrics } from '../types/ohpa';
import { PdiBeadReport } from '../data/default_pdi_bead';
import { DEFAULT_RETREAD_TONNAGE } from '../data/default_retread_tonnage';
import { classifyArea, AREA_5_KEYS, AREA_5_METADATA, Area5Key, getMonthlyStaffMetrics } from './ohpaCalculator';

export interface RawEmployeeExportRow {
  no: number;
  empId: string;
  nameTH: string;
  nameEN: string;
  empType: 'Goodyear' | 'Contractor (WAS)' | 'Monthly Staff';
  areaKey: Area5Key | string;
  areaName: string;
  closingCode: string;
  department: string;
  position: string;
  machine: string;
  shift: string;
  inTime: string;
  outTime: string;
  normalHours: number;
  otHours: number;
  totalHours: number;
  pdiBeadAdjustment: string;
  netOpahHours: number;
  isIncludedInPlantOpah: string;
  scanStatus: string;
  otNote: string;
}

export interface TeamSummaryRow {
  areaKey: string;
  areaName: string;
  targetHc: number | string;
  actualTotalHc: number;
  gyHc: number;
  contHc: number;
  monthlyHc: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
  pdiDeductHours?: number;
  beadAddHours?: number;
  bcaReductionHours?: number;
  bcaDevHours?: number;
  retreadReceivedHours?: number;
  netOpahHours: number;
  tonnageCodes?: string;
  tonnageKg?: number;
  tonnageLbs?: number;
  areaOpah?: number | string;
  isExcluded: string;
}

/**
 * Extract 4-5 digit cost center or closing code
 */
function extractDeptCode(str: string): string {
  const m = String(str || '').match(/([A-Z]?\d{4})/i);
  return m ? m[1].toUpperCase() : '';
}

/**
 * Helper to resolve Area based on MU from employee master or classification
 */
function resolveEmpArea(
  mu?: string,
  category?: string,
  dept?: string,
  costCenter?: string,
  location?: string,
  closing?: string
): { key: string; name: string; isExcluded6320: boolean } {
  const muClean = (mu || '').trim();
  if (muClean && AREA_5_METADATA[muClean as Area5Key]) {
    const meta = AREA_5_METADATA[muClean as Area5Key];
    return {
      key: muClean,
      name: meta.name,
      isExcluded6320: !!meta.isExcluded6320
    };
  }

  if (muClean === 'Consumer/Bias Aero') {
    return {
      key: 'Shared Con/Bias',
      name: 'Consumer & Bias Aero (แบ่ง 50% / 50%)',
      isExcluded6320: false
    };
  }

  if (muClean === 'Non-HPT') {
    return {
      key: 'Non-HPT',
      name: 'Non-HPT (จัดสรร 20% ให้ 5 พื้นที่)',
      isExcluded6320: false
    };
  }

  const classified = classifyArea(category, dept, costCenter, '', location, closing, mu);
  return {
    key: classified.key,
    name: classified.name,
    isExcluded6320: !!classified.isExcluded6320
  };
}

/**
 * Builds standard raw employee records for Goodyear + Contractor + Monthly staff
 */
export function buildRawEmployeeRecords(
  gyRecords: ParsedShiftRecord[] = [],
  contractorRecords: ContractorScanRecord[] = [],
  employeeMapping: Record<string, EmployeeInfo> = {},
  dateFormatted: string = '',
  pdiBeadReport?: PdiBeadReport | null,
  tonnageReport?: StockingTonnageReport | null,
  areaBreakdown?: OhpaAreaMetrics[] | null
): { rows: RawEmployeeExportRow[]; teamSummary: TeamSummaryRow[] } {
  const rows: RawEmployeeExportRow[] = [];
  let counter = 1;

  // 1. Process Goodyear Employees (Hourly)
  gyRecords.forEach((r) => {
    const rawId = (r.empId || '').replace(/\D/g, '');
    const empInfo =
      employeeMapping[r.empId] ||
      employeeMapping[rawId] ||
      employeeMapping[rawId.padStart(5, '0')];

    const category = r.category || empInfo?.category || '';
    const dept = r.dept || empInfo?.dept || '';
    const costCenter = r.costCenter || empInfo?.costCenter || '';
    const mu = empInfo?.mu || r.mu || '';
    const position = r.position || empInfo?.position || '-';
    const machine = r.machine || empInfo?.machine || position;

    const areaResult = resolveEmpArea(mu, category, dept, costCenter);
    const areaKey = areaResult.key;
    const areaName = areaResult.name;

    const nHours = r.normalWorkHours !== undefined ? r.normalWorkHours : (r.effectiveWorkHours || 8);
    const otH = r.otHours || 0;
    const totH = nHours + otH;

    // Scan status
    let statusText = 'ตรงเวลา (On-time)';
    if (r.isEarlyLeave && r.isLate) {
      statusText = `ลากลับก่อน (ทำ ${r.effectiveWorkHours} ชม.) & สาย ${r.lateMinutes} นาที`;
    } else if (r.isEarlyLeave) {
      statusText = `ลากลับก่อน (ทำ ${r.effectiveWorkHours} ชม.)`;
    } else if (r.isLate) {
      statusText = `สาย (${r.lateMinutes} นาที)`;
    } else if (!r.inTimeFormatted || !r.outTimeFormatted || r.hasMissingPunch) {
      statusText = 'ขาดสแกน / สแกนไม่ครบ';
    }

    const isExcluded = areaResult.isExcluded6320 || areaKey === 'Retread';

    rows.push({
      no: counter++,
      empId: r.empId,
      nameTH: r.nameTH || empInfo?.nameTH || '-',
      nameEN: r.nameEN || empInfo?.nameEN || '-',
      empType: 'Goodyear',
      areaKey,
      areaName,
      closingCode: extractDeptCode(costCenter || dept),
      department: dept,
      position,
      machine,
      shift: r.shiftLabel || `กะ ${r.shift}`,
      inTime: r.inTimeFormatted || '-',
      outTime: r.outTimeFormatted || '-',
      normalHours: nHours,
      otHours: otH,
      totalHours: totH,
      pdiBeadAdjustment: '-',
      netOpahHours: isExcluded ? 0 : totH,
      isIncludedInPlantOpah: isExcluded ? 'ไม่นับ (ตัด 6320)' : 'นับคำนวณ OPAH',
      scanStatus: statusText,
      otNote: r.otNote || '-',
    });
  });

  // 2. Process Contractor (WAS) Employees
  contractorRecords.forEach((r) => {
    const rawId = (r.empCode || '').replace(/\D/g, '');
    const empInfo =
      employeeMapping[r.empCode] ||
      employeeMapping[rawId] ||
      employeeMapping[rawId.padStart(5, '0')];

    const isMonthlyCont = r.type === 'Salary' || (r as any).isMonthly;
    const category = isMonthlyCont ? 'Monthly Staff' : (r.type || empInfo?.category || 'Contractor');
    const dept = r.department || r.deptRaw || empInfo?.dept || '';
    const costCenter = r.closing || empInfo?.costCenter || '';
    const location = r.location || '';
    const mu = empInfo?.mu || '';
    const position = r.position || empInfo?.position || '-';
    const machine = empInfo?.machine || position;

    const areaResult = resolveEmpArea(mu, category, dept, costCenter, location, r.closing);
    const areaKey = areaResult.key;
    const areaName = areaResult.name;

    const nHours = r.normalHours || (r.hasScannedIn ? 8 : 0);
    const otH = r.otHours || 0;
    const totH = r.totalHours || (nHours + otH);

    let statusText = r.status || (r.hasScannedIn ? 'มาทำงาน' : 'ขาดงาน');
    if (r.late) statusText += ` (สาย ${r.late})`;
    if (r.earlyOut) statusText += ` (กลับก่อน ${r.earlyOut})`;

    const isExcluded = areaResult.isExcluded6320 || areaKey === 'Retread';

    rows.push({
      no: counter++,
      empId: r.empCode,
      nameTH: r.nameTh || empInfo?.nameTH || '-',
      nameEN: r.nameEn || empInfo?.nameEN || '-',
      empType: isMonthlyCont ? 'Monthly Staff' : 'Contractor (WAS)',
      areaKey,
      areaName,
      closingCode: extractDeptCode(r.closing || costCenter || dept),
      department: dept,
      position,
      machine,
      shift: r.shiftLabel || (r.shiftNumber ? `กะ ${r.shiftNumber}` : 'Day (08:00 - 17:00)'),
      inTime: r.scanIn || '-',
      outTime: r.scanOut || '-',
      normalHours: nHours,
      otHours: otH,
      totalHours: totH,
      pdiBeadAdjustment: '-',
      netOpahHours: isExcluded ? 0 : totH,
      isIncludedInPlantOpah: isExcluded ? 'ไม่นับ (ตัด 6320)' : 'นับคำนวณ OPAH',
      scanStatus: statusText,
      otNote: r.remark || '-',
    });
  });

  // 3. Process Goodyear Monthly Staff (Salaries from Master Database)
  const gyMonthlyStaff = Object.values(employeeMapping).filter(
    (e) => e.sourceSheet === 'Salaries' || e.mor === 'Salaried'
  );

  const monthlyMetrics = getMonthlyStaffMetrics(dateFormatted);
  const monthlyHoursPerPerson = monthlyMetrics.hoursPerPerson; // 8 Mon-Fri, 4 Sat, 0 Sun

  gyMonthlyStaff.forEach((e) => {
    const rawId = (e.empId || '').replace(/\D/g, '');
    const mu = (e.mu || 'Non-HPT').trim();
    const areaResult = resolveEmpArea(mu, 'Salaries', e.dept, e.costCenter);
    const areaKey = areaResult.key;
    const areaName = areaResult.name;
    const isExcluded = areaResult.isExcluded6320 || areaKey === 'Retread';

    rows.push({
      no: counter++,
      empId: e.empId || rawId,
      nameTH: e.nameTH || '-',
      nameEN: e.nameEN || '-',
      empType: 'Monthly Staff',
      areaKey,
      areaName,
      closingCode: extractDeptCode(e.costCenter || e.dept || ''),
      department: e.dept || 'Salaries (พนักงานประจำรายเดือน)',
      position: e.position || 'Staff',
      machine: e.machine || e.position || 'Office/Plant',
      shift: 'Day (08:00 - 17:00)',
      inTime: '08:00',
      outTime: monthlyHoursPerPerson > 0 ? (monthlyHoursPerPerson === 4 ? '12:00' : '17:00') : 'วันหยุด',
      normalHours: monthlyHoursPerPerson,
      otHours: 0,
      totalHours: monthlyHoursPerPerson,
      pdiBeadAdjustment: '-',
      netOpahHours: isExcluded ? 0 : (areaKey === 'Non-HPT' ? Math.round(monthlyHoursPerPerson * 0.8 * 10) / 10 : monthlyHoursPerPerson),
      isIncludedInPlantOpah: isExcluded ? 'ไม่นับ (ตัด 6320)' : 'นับคำนวณ OPAH',
      scanStatus: `พนักงานประจำรายเดือน (${monthlyHoursPerPerson} ชม./คน - ${monthlyMetrics.dayName})`,
      otNote: '-',
    });
  });

  // Calculate Team Summary
  let teamSummary: TeamSummaryRow[] = [];

  if (areaBreakdown && areaBreakdown.length > 0) {
    // 1. Use the official calculated Area Breakdown metrics for 100% mathematical consistency
    teamSummary = areaBreakdown.map((a) => ({
      areaKey: a.areaKey,
      areaName: a.areaName,
      targetHc: a.headcountStandard || '-',
      actualTotalHc: a.totalHeadcount,
      gyHc: a.gyHeadcount,
      contHc: a.contractorHeadcount,
      monthlyHc: a.monthlyHeadcount || 0,
      normalHours: a.normalHours,
      otHours: a.otHours,
      totalHours: a.totalHours,
      pdiDeductHours: a.pdiDeductHours || 0,
      beadAddHours: a.beadAddHours || 0,
      bcaReductionHours: a.bcaReductionHours || 0,
      bcaDevHours: a.bcaDevHours || 0,
      retreadReceivedHours: a.retreadReceivedHours || 0,
      netOpahHours: a.finalOpahHours ?? a.totalHours,
      tonnageCodes: a.areaTonnageCodes || '-',
      tonnageKg: a.areaTonnageKg || 0,
      tonnageLbs: a.areaTonnageLbs || 0,
      areaOpah: a.areaOpahLbsPerHour ?? '-',
      isExcluded: a.isExcluded6320 ? 'ตัดออกจากการคิด OPAH (6320)' : 'รวมในการคิด OPAH (4 พื้นที่หลัก)',
    }));

    // Add Total Aviation row if not already present
    if (!teamSummary.some((s) => s.areaKey === 'Total Aviation' || s.areaKey.includes('Total Aviation'))) {
      const biasSum = teamSummary.find((s) => s.areaKey === 'Bias Aero');
      const radSum = teamSummary.find((s) => s.areaKey === 'Radial Aero');
      if (biasSum || radSum) {
        const avTotHc = Math.round(((biasSum?.actualTotalHc || 0) + (radSum?.actualTotalHc || 0)) * 10) / 10;
        const avGyHc = Math.round(((biasSum?.gyHc || 0) + (radSum?.gyHc || 0)) * 10) / 10;
        const avContHc = Math.round(((biasSum?.contHc || 0) + (radSum?.contHc || 0)) * 10) / 10;
        const avMonHc = Math.round(((biasSum?.monthlyHc || 0) + (radSum?.monthlyHc || 0)) * 10) / 10;
        const avNormH = Math.round(((biasSum?.normalHours || 0) + (radSum?.normalHours || 0)) * 10) / 10;
        const avOtH = Math.round(((biasSum?.otHours || 0) + (radSum?.otHours || 0)) * 10) / 10;
        const avTotH = Math.round(((biasSum?.totalHours || 0) + (radSum?.totalHours || 0)) * 10) / 10;
        const avPdiH = biasSum?.pdiDeductHours || 0;
        const avNetH = Math.round(((biasSum?.netOpahHours || 0) + (radSum?.netOpahHours || 0)) * 10) / 10;
        const avKg = Math.round(((biasSum?.tonnageKg || 0) + (radSum?.tonnageKg || 0)) * 100) / 100;
        const avLbs = Math.round(avKg * 2.20462 * 100) / 100;
        const avOpah = avNetH > 0 && avKg > 0 ? Math.round(((avKg * 2.20462) / avNetH) * 100) / 100 : '-';

        const insertIdx = teamSummary.findIndex((s) => s.areaKey === 'Radial Aero');
        const avRow: TeamSummaryRow = {
          areaKey: 'Total Aviation',
          areaName: '⭐ Total Aviation (Bias + Radial Aero)',
          targetHc: 276,
          actualTotalHc: avTotHc,
          gyHc: avGyHc,
          contHc: avContHc,
          monthlyHc: avMonHc,
          normalHours: avNormH,
          otHours: avOtH,
          totalHours: avTotH,
          pdiDeductHours: avPdiH,
          beadAddHours: 0,
          bcaReductionHours: 0,
          bcaDevHours: 0,
          retreadReceivedHours: 0,
          netOpahHours: avNetH,
          tonnageCodes: 'CODE A + B + 6',
          tonnageKg: avKg,
          tonnageLbs: avLbs,
          areaOpah: avOpah,
          isExcluded: 'รวมในการคิด OPAH (Aero Combined)',
        };
        if (insertIdx !== -1) {
          teamSummary.splice(insertIdx, 0, avRow);
        } else {
          teamSummary.push(avRow);
        }
      }
    }
  } else {
    // Fallback if areaBreakdown is not provided
    const cleanDateStr = (dateFormatted || '').replace(/^[📅📄\s]*วันที่\s*/, '').trim();
    const dateParts = cleanDateStr.split(/[/.-]/);
    let dayNum = 14;
    if (dateParts.length >= 1) {
      if (dateParts[0].length === 4 && dateParts.length >= 3) {
        dayNum = parseInt(dateParts[2], 10) || 14;
      } else {
        dayNum = parseInt(dateParts[0], 10) || 14;
      }
    }

    const pdiDeduct = pdiBeadReport?.pdiDailyTotals?.[dayNum] || 0;
    const beadAdd = pdiBeadReport?.beadDailyTotals?.[dayNum] || 0;
    const bcaReduction = pdiBeadReport?.bcaReductionDailyHours?.[dayNum] ||
      (pdiBeadReport?.bcaReductionDailyMinutes?.[dayNum] ? Math.round((pdiBeadReport.bcaReductionDailyMinutes[dayNum] / 60) * 10) / 10 : 0);
    const bcaDev = pdiBeadReport?.bcaDevDailyHours?.[dayNum] ||
      (pdiBeadReport?.bcaDevDailyMinutes?.[dayNum] ? Math.round((pdiBeadReport.bcaDevDailyMinutes[dayNum] / 60) * 10) / 10 : 0);

    const teamSummaryMap: Record<string, TeamSummaryRow> = {};
    AREA_5_KEYS.forEach((k) => {
      const meta = AREA_5_METADATA[k];
      teamSummaryMap[k] = {
        areaKey: k,
        areaName: meta.name,
        targetHc: meta.headcountStandard,
        actualTotalHc: 0,
        gyHc: 0,
        contHc: 0,
        monthlyHc: 0,
        normalHours: 0,
        otHours: 0,
        totalHours: 0,
        pdiDeductHours: 0,
        beadAddHours: 0,
        bcaReductionHours: 0,
        bcaDevHours: 0,
        retreadReceivedHours: 0,
        netOpahHours: 0,
        tonnageCodes: '-',
        tonnageKg: 0,
        tonnageLbs: 0,
        areaOpah: '-',
        isExcluded: meta.isExcluded6320 ? 'ตัดออกจากการคิด OPAH (6320)' : 'รวมในการคิด OPAH',
      };
    });

    rows.forEach((r) => {
      const sum = teamSummaryMap[r.areaKey as Area5Key];
      if (sum) {
        sum.actualTotalHc += 1;
        if (r.empType === 'Goodyear') sum.gyHc += 1;
        else if (r.empType === 'Contractor (WAS)') sum.contHc += 1;
        else sum.monthlyHc += 1;

        sum.normalHours += r.normalHours;
        sum.otHours += r.otHours;
        sum.totalHours += r.totalHours;
      }
    });

    if (teamSummaryMap['BCA']) {
      const bca = teamSummaryMap['BCA'];
      bca.beadAddHours = beadAdd;
      bca.bcaReductionHours = bcaReduction;
      bca.bcaDevHours = bcaDev;
      bca.netOpahHours = Math.round((bca.totalHours + beadAdd - bcaReduction - bcaDev) * 10) / 10;
    }
    if (teamSummaryMap['Consumer']) {
      teamSummaryMap['Consumer'].netOpahHours = teamSummaryMap['Consumer'].totalHours;
    }
    if (teamSummaryMap['Bias Aero']) {
      const bias = teamSummaryMap['Bias Aero'];
      bias.pdiDeductHours = pdiDeduct;
      bias.netOpahHours = Math.max(0, Math.round((bias.totalHours - pdiDeduct) * 10) / 10);
    }
    if (teamSummaryMap['Radial Aero']) {
      teamSummaryMap['Radial Aero'].netOpahHours = teamSummaryMap['Radial Aero'].totalHours;
    }
    if (teamSummaryMap['Retread']) {
      const retread = teamSummaryMap['Retread'];
      retread.retreadReceivedHours = bcaReduction;
      retread.netOpahHours = Math.round((retread.totalHours + bcaReduction) * 10) / 10;
    }

    if (tonnageReport?.rows) {
      const getCodeKg = (codes: string[]) => {
        return (tonnageReport.rows || [])
          .filter((row) => codes.includes(row.code))
          .reduce((s, row) => s + (row.dailyTotalTonnage || 0), 0);
      };

      const bcaKg = tonnageReport.total?.dailyTotalTonnage || getCodeKg(['D', 'P', 'Q', 'W', 'T', '6', 'A', 'B']);
      const conKg = getCodeKg(['Q', 'W']);
      const biasKg = getCodeKg(['A', 'B']);
      const radKg = getCodeKg(['6']);

      if (teamSummaryMap['BCA']) {
        teamSummaryMap['BCA'].tonnageCodes = 'TOTAL (ทุก Code)';
        teamSummaryMap['BCA'].tonnageKg = bcaKg;
        teamSummaryMap['BCA'].tonnageLbs = Math.round(bcaKg * 2.20462 * 100) / 100;
        teamSummaryMap['BCA'].areaOpah =
          teamSummaryMap['BCA'].netOpahHours > 0 && bcaKg > 0
            ? Math.round(((bcaKg * 2.20462) / teamSummaryMap['BCA'].netOpahHours) * 100) / 100
            : '-';
      }
      if (teamSummaryMap['Consumer']) {
        teamSummaryMap['Consumer'].tonnageCodes = 'CODE Q + W';
        teamSummaryMap['Consumer'].tonnageKg = conKg;
        teamSummaryMap['Consumer'].tonnageLbs = Math.round(conKg * 2.20462 * 100) / 100;
        teamSummaryMap['Consumer'].areaOpah =
          teamSummaryMap['Consumer'].netOpahHours > 0 && conKg > 0
            ? Math.round(((conKg * 2.20462) / teamSummaryMap['Consumer'].netOpahHours) * 100) / 100
            : '-';
      }
      if (teamSummaryMap['Bias Aero']) {
        teamSummaryMap['Bias Aero'].tonnageCodes = 'CODE A + B';
        teamSummaryMap['Bias Aero'].tonnageKg = biasKg;
        teamSummaryMap['Bias Aero'].tonnageLbs = Math.round(biasKg * 2.20462 * 100) / 100;
        teamSummaryMap['Bias Aero'].areaOpah =
          teamSummaryMap['Bias Aero'].netOpahHours > 0 && biasKg > 0
            ? Math.round(((biasKg * 2.20462) / teamSummaryMap['Bias Aero'].netOpahHours) * 100) / 100
            : '-';
      }
      if (teamSummaryMap['Radial Aero']) {
        teamSummaryMap['Radial Aero'].tonnageCodes = 'CODE 6';
        teamSummaryMap['Radial Aero'].tonnageKg = radKg;
        teamSummaryMap['Radial Aero'].tonnageLbs = Math.round(radKg * 2.20462 * 100) / 100;
        teamSummaryMap['Radial Aero'].areaOpah =
          teamSummaryMap['Radial Aero'].netOpahHours > 0 && radKg > 0
            ? Math.round(((radKg * 2.20462) / teamSummaryMap['Radial Aero'].netOpahHours) * 100) / 100
            : '-';
      }
    }

    const retreadKg = (cleanDateStr && DEFAULT_RETREAD_TONNAGE.dailyKgByDate[cleanDateStr]) ||
      (cleanDateStr && DEFAULT_RETREAD_TONNAGE.dailyKgByDate[cleanDateStr.replace(/\//g, '-')]) ||
      0;
    if (teamSummaryMap['Retread']) {
      teamSummaryMap['Retread'].tonnageCodes = 'Retread SAP Stock';
      teamSummaryMap['Retread'].tonnageKg = retreadKg;
      teamSummaryMap['Retread'].tonnageLbs = Math.round(retreadKg * 2.20462 * 100) / 100;
      const retreadNetH = teamSummaryMap['Retread'].netOpahHours || teamSummaryMap['Retread'].totalHours;
      teamSummaryMap['Retread'].areaOpah =
        retreadNetH > 0 && retreadKg > 0
          ? Math.round(((retreadKg * 2.20462) / retreadNetH) * 100) / 100
          : '-';
    }

    teamSummary = AREA_5_KEYS.map((k) => teamSummaryMap[k]);
  }

  return { rows, teamSummary };
}

/**
 * Generates and triggers download of multi-sheet Excel file for Team Allocation & Working Hours
 */
export function exportTeamRawDataExcel(
  gyRecords: ParsedShiftRecord[] = [],
  contractorRecords: ContractorScanRecord[] = [],
  employeeMapping: Record<string, EmployeeInfo> = {},
  dateFormatted: string = '',
  specificTeamKey?: string,
  pdiBeadReport?: PdiBeadReport | null,
  tonnageReport?: StockingTonnageReport | null,
  areaBreakdown?: OhpaAreaMetrics[] | null
) {
  const { rows, teamSummary } = buildRawEmployeeRecords(
    gyRecords,
    contractorRecords,
    employeeMapping,
    dateFormatted,
    pdiBeadReport,
    tonnageReport,
    areaBreakdown
  );

  const wb = XLSX.utils.book_new();

  // Helper to format row objects for Excel
  const formatRow = (r: RawEmployeeExportRow, index: number) => ({
    'ลำดับ': index + 1,
    'รหัสพนักงาน': r.empId,
    'ชื่อ-นามสกุล (ไทย)': r.nameTH,
    'ชื่อภาษาอังกฤษ (EN)': r.nameEN,
    'ประเภทพนักงาน': r.empType,
    'พื้นที่หลัก (5 Production Areas)': r.areaKey,
    'ชื่อพื้นที่ / กลุ่มโรงงาน': r.areaName,
    'รหัสปิดรอบ (Closing / CC)': r.closingCode,
    'แผนก / Cost Center': r.department,
    'ตำแหน่งงาน (Position)': r.position,
    'เครื่องจักร (Machine)': r.machine,
    'กะการทำงาน (Shift)': r.shift,
    'เวลาสแกนเข้า (IN)': r.inTime,
    'เวลาสแกนออก (OUT)': r.outTime,
    'ชม. ปกติ (Normal Hours)': r.normalHours,
    'ชม. OT (OT Hours)': r.otHours,
    'ชม. ทำงานรวม (Total Hours)': r.totalHours,
    'ชม. สุทธิคิด OPAH': r.netOpahHours,
    'นับใน OPAH โรงงาน': r.isIncludedInPlantOpah,
    'สถานะการสแกน': r.scanStatus,
    'หมายเหตุ OT / อื่นๆ': r.otNote,
  });

  // Sheet 1: Team Summary Matrix
  const summarySheetData = teamSummary.map((s, idx) => ({
    'ลำดับ': idx + 1,
    'พื้นที่ (5 Production Areas)': s.areaKey,
    'ชื่อกลุ่มโรงงาน': s.areaName,
    'เป้าหมาย Master (คน)': s.targetHc,
    'สแกนจริงรวม (คน)': s.actualTotalHc,
    'Goodyear (คน)': s.gyHc,
    'Contractor (คน)': s.contHc,
    'รายเดือน (คน)': s.monthlyHc,
    'ชม. ปกติรวม (ชม.)': s.normalHours,
    'ชม. OT รวม (ชม.)': s.otHours,
    'ชม. ทำงานฐานรวม (ชม.)': s.totalHours,
    '🔻 PDI Deduct (ชม.)': s.pdiDeductHours ? `-${s.pdiDeductHours}` : 0,
    '🟢 Bead Add (ชม.)': s.beadAddHours ? `+${s.beadAddHours}` : 0,
    '🔄 BCA หักโอน (ชม.)': s.bcaReductionHours ? `-${s.bcaReductionHours}` : 0,
    '🧪 BCA DEV (ชม.)': s.bcaDevHours ? `-${s.bcaDevHours}` : 0,
    '📥 Retread รับโอน (ชม.)': s.retreadReceivedHours ? `+${s.retreadReceivedHours}` : 0,
    '⭐ ชม. สุทธิคิด OPAH (ชม.)': s.netOpahHours,
    'รหัส Stocking 55012 / SAP': s.tonnageCodes || '-',
    'ยอด Stocking (kg)': s.tonnageKg || 0,
    'ยอด Stocking (lbs)': s.tonnageLbs || 0,
    '🚀 Area OPAH (lbs/ชม.)': s.areaOpah ?? '-',
    'สถานะการคิด OPAH': s.isExcluded,
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Team_Summary_Matrix');

  if (specificTeamKey && specificTeamKey !== 'ALL') {
    // Export specific team only
    const isAv = specificTeamKey === 'Total Aviation' || specificTeamKey === 'Aviation';
    const teamRows = rows.filter((r) =>
      isAv
        ? (r.areaKey === 'Bias Aero' || r.areaKey === 'Radial Aero')
        : (r.areaKey === specificTeamKey || (specificTeamKey === 'BCA' && r.areaKey === 'Non-HPT'))
    );
    const wsTeam = XLSX.utils.json_to_sheet(teamRows.map(formatRow));
    const safeSheetName = isAv ? 'Team_Total_Aviation' : `Team_${specificTeamKey.replace(/\s+/g, '_')}`;
    XLSX.utils.book_append_sheet(wb, wsTeam, safeSheetName);
  } else {
    // Sheet 2: All Employees Raw Data
    const allData = rows.map(formatRow);
    const wsAll = XLSX.utils.json_to_sheet(allData);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Raw_All_Employees');

    // Sub-sheet for Total Aviation
    const aviationRows = rows.filter((r) => r.areaKey === 'Bias Aero' || r.areaKey === 'Radial Aero');
    if (aviationRows.length > 0) {
      const avData = aviationRows.map(formatRow);
      const wsAv = XLSX.utils.json_to_sheet(avData);
      XLSX.utils.book_append_sheet(wb, wsAv, 'Team_Total_Aviation');
    }

    // Sub-sheets for each of the 5 Teams
    AREA_5_KEYS.forEach((areaKey) => {
      const teamRows = rows.filter((r) => r.areaKey === areaKey);
      if (teamRows.length > 0) {
        const teamData = teamRows.map(formatRow);
        const wsTeam = XLSX.utils.json_to_sheet(teamData);
        const safeSheetName = `Team_${areaKey.replace(/\s+/g, '_')}`;
        XLSX.utils.book_append_sheet(wb, wsTeam, safeSheetName);
      }
    });

    // Sub-sheet for Non-HPT Support
    const nonHptRows = rows.filter((r) => r.areaKey === 'Non-HPT');
    if (nonHptRows.length > 0) {
      const nonHptData = nonHptRows.map(formatRow);
      const wsNonHpt = XLSX.utils.json_to_sheet(nonHptData);
      XLSX.utils.book_append_sheet(wb, wsNonHpt, 'Team_Non_HPT_Support');
    }
  }

  const cleanDate = (dateFormatted || new Date().toLocaleDateString('th-TH')).replace(/[\/\\]/g, '-');
  const teamSuffix = specificTeamKey && specificTeamKey !== 'ALL' ? `_${specificTeamKey.replace(/\s+/g, '_')}` : '_AllTeams';
  const filename = `RawData_WorkingHours_TeamAllocation_${cleanDate}${teamSuffix}.xlsx`;

  XLSX.writeFile(wb, filename);
}

