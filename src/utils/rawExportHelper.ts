import * as XLSX from 'xlsx';
import { ParsedShiftRecord, EmployeeInfo } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { StockingTonnageReport } from '../types/ohpa';
import { PdiBeadReport } from '../data/default_pdi_bead';
import { DEFAULT_RETREAD_TONNAGE } from '../data/default_retread_tonnage';
import { classifyArea, AREA_5_KEYS, AREA_5_METADATA, Area5Key } from './ohpaCalculator';

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
  netOpahHours: number;
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
): { key: Area5Key | string; name: string; isExcluded6320: boolean } {
  const muClean = (mu || '').trim();
  if (muClean && AREA_5_METADATA[muClean as Area5Key]) {
    const meta = AREA_5_METADATA[muClean as Area5Key];
    return {
      key: muClean as Area5Key,
      name: meta.name,
      isExcluded6320: !!meta.isExcluded6320
    };
  }

  if (muClean === 'Consumer/Bias Aero') {
    return {
      key: 'Consumer',
      name: 'Consumer (Shared 50% Con/Bias)',
      isExcluded6320: false
    };
  }

  if (muClean === 'Non-HPT') {
    return {
      key: 'BCA',
      name: 'BCA (Non-HPT จัดสรร 1/5)',
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
  tonnageReport?: StockingTonnageReport | null
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
      outTime: '17:00',
      normalHours: 8,
      otHours: 0,
      totalHours: 8,
      pdiBeadAdjustment: '-',
      netOpahHours: isExcluded ? 0 : 8,
      isIncludedInPlantOpah: isExcluded ? 'ไม่นับ (ตัด 6320)' : 'นับคำนวณ OPAH',
      scanStatus: 'พนักงานประจำรายเดือน (Salaried Staff 8 ชม.)',
      otNote: '-',
    });
  });

  // Calculate Team Summary
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
      netOpahHours: 0,
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
      sum.netOpahHours += r.netOpahHours;
    }
  });

  // Attach Stocking Tonnage if available
  if (tonnageReport?.rows) {
    const getCodeKg = (codes: string[]) => {
      return tonnageReport.rows
        .filter((row) => codes.includes(row.code))
        .reduce((s, row) => s + (row.dailyTotalTonnage || 0), 0);
    };

    const bcaKg = getCodeKg(['D', 'P', 'Q', 'W', 'T', '6', 'A', 'B']); // BCA supplies compound for plant
    const conKg = getCodeKg(['Q', 'D', 'P', 'W', 'T']);
    const biasKg = getCodeKg(['A', 'B']);
    const radKg = getCodeKg(['6']);

    if (teamSummaryMap['Consumer']) {
      teamSummaryMap['Consumer'].tonnageKg = conKg;
      teamSummaryMap['Consumer'].tonnageLbs = Math.round(conKg * 2.20462 * 100) / 100;
      teamSummaryMap['Consumer'].areaOpah =
        teamSummaryMap['Consumer'].netOpahHours > 0 && conKg > 0
          ? Math.round(((conKg * 2.20462) / teamSummaryMap['Consumer'].netOpahHours) * 100) / 100
          : '-';
    }
    if (teamSummaryMap['Bias Aero']) {
      teamSummaryMap['Bias Aero'].tonnageKg = biasKg;
      teamSummaryMap['Bias Aero'].tonnageLbs = Math.round(biasKg * 2.20462 * 100) / 100;
      teamSummaryMap['Bias Aero'].areaOpah =
        teamSummaryMap['Bias Aero'].netOpahHours > 0 && biasKg > 0
          ? Math.round(((biasKg * 2.20462) / teamSummaryMap['Bias Aero'].netOpahHours) * 100) / 100
          : '-';
    }
    if (teamSummaryMap['Radial Aero']) {
      teamSummaryMap['Radial Aero'].tonnageKg = radKg;
      teamSummaryMap['Radial Aero'].tonnageLbs = Math.round(radKg * 2.20462 * 100) / 100;
      teamSummaryMap['Radial Aero'].areaOpah =
        teamSummaryMap['Radial Aero'].netOpahHours > 0 && radKg > 0
          ? Math.round(((radKg * 2.20462) / teamSummaryMap['Radial Aero'].netOpahHours) * 100) / 100
          : '-';
    }
  }

  // Calculate Retread Tonnage & Standalone OPAH
  const cleanDateStr = (dateFormatted || '').replace(/^[^\d]*/, '').trim();
  const retreadKg = (cleanDateStr && DEFAULT_RETREAD_TONNAGE.dailyKgByDate[cleanDateStr]) ||
    (cleanDateStr && DEFAULT_RETREAD_TONNAGE.dailyKgByDate[cleanDateStr.replace(/\//g, '-')]) ||
    0;
  if (teamSummaryMap['Retread']) {
    teamSummaryMap['Retread'].tonnageKg = retreadKg;
    teamSummaryMap['Retread'].tonnageLbs = Math.round(retreadKg * 2.20462 * 100) / 100;
    const retreadTotH = teamSummaryMap['Retread'].totalHours;
    teamSummaryMap['Retread'].areaOpah =
      retreadTotH > 0 && retreadKg > 0
        ? Math.round(((retreadKg * 2.20462) / retreadTotH) * 100) / 100
        : '-';
  }

  const teamSummary = AREA_5_KEYS.map((k) => teamSummaryMap[k]);

  // Add Total Aviation summary row
  const biasSum = teamSummaryMap['Bias Aero'];
  const radSum = teamSummaryMap['Radial Aero'];
  const avTotHc = (biasSum?.actualTotalHc || 0) + (radSum?.actualTotalHc || 0);
  const avGyHc = (biasSum?.gyHc || 0) + (radSum?.gyHc || 0);
  const avContHc = (biasSum?.contHc || 0) + (radSum?.contHc || 0);
  const avMonHc = (biasSum?.monthlyHc || 0) + (radSum?.monthlyHc || 0);
  const avNormH = (biasSum?.normalHours || 0) + (radSum?.normalHours || 0);
  const avOtH = (biasSum?.otHours || 0) + (radSum?.otHours || 0);
  const avTotH = (biasSum?.totalHours || 0) + (radSum?.totalHours || 0);
  const avNetH = (biasSum?.netOpahHours || 0) + (radSum?.netOpahHours || 0);
  const avKg = (biasSum?.tonnageKg || 0) + (radSum?.tonnageKg || 0);
  const avLbs = Math.round(avKg * 2.20462 * 100) / 100;
  const avOpah = avNetH > 0 && avKg > 0 ? Math.round(((avKg * 2.20462) / avNetH) * 100) / 100 : '-';

  teamSummary.splice(3, 0, {
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
    netOpahHours: avNetH,
    tonnageKg: avKg,
    tonnageLbs: avLbs,
    areaOpah: avOpah,
    isExcluded: 'รวมในการคิด OPAH (Aero Combined)',
  });

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
  tonnageReport?: StockingTonnageReport | null
) {
  const { rows, teamSummary } = buildRawEmployeeRecords(
    gyRecords,
    contractorRecords,
    employeeMapping,
    dateFormatted,
    pdiBeadReport,
    tonnageReport
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
    'ชม. ทำงานรวมทั้งหมด (ชม.)': s.totalHours,
    'ชม. สุทธิคิด OPAH (ชม.)': s.netOpahHours,
    'ยอด Stocking (kg)': s.tonnageKg || 0,
    'ยอด Stocking (lbs)': s.tonnageLbs || 0,
    'Area OPAH (lbs/ชม.)': s.areaOpah ?? '-',
    'สถานะการคิด OPAH': s.isExcluded,
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Team_Summary_Matrix');

  if (specificTeamKey && specificTeamKey !== 'ALL') {
    // Export specific team only
    const isAv = specificTeamKey === 'Total Aviation' || specificTeamKey === 'Aviation';
    const teamRows = rows.filter((r) => isAv ? (r.areaKey === 'Bias Aero' || r.areaKey === 'Radial Aero') : r.areaKey === specificTeamKey);
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
  }

  const cleanDate = (dateFormatted || new Date().toLocaleDateString('th-TH')).replace(/[\/\\]/g, '-');
  const teamSuffix = specificTeamKey && specificTeamKey !== 'ALL' ? `_${specificTeamKey.replace(/\s+/g, '_')}` : '_AllTeams';
  const filename = `RawData_WorkingHours_TeamAllocation_${cleanDate}${teamSuffix}.xlsx`;

  XLSX.writeFile(wb, filename);
}

