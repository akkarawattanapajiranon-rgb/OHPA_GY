import * as XLSX from 'xlsx';
import { ParsedShiftRecord, EmployeeInfo } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
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
  netOpahHours: number;
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
 * Builds standard raw employee records for Goodyear + Contractor + Monthly staff
 */
export function buildRawEmployeeRecords(
  gyRecords: ParsedShiftRecord[] = [],
  contractorRecords: ContractorScanRecord[] = [],
  employeeMapping: Record<string, EmployeeInfo> = {},
  dateFormatted: string = ''
): { rows: RawEmployeeExportRow[]; teamSummary: TeamSummaryRow[] } {
  const rows: RawEmployeeExportRow[] = [];
  let counter = 1;

  // 1. Process Goodyear Employees
  gyRecords.forEach((r) => {
    const rawId = (r.empId || '').replace(/\D/g, '');
    const empInfo =
      employeeMapping[r.empId] ||
      employeeMapping[rawId] ||
      employeeMapping[rawId.padStart(5, '0')];

    const category = r.category || empInfo?.category || '';
    const dept = r.dept || empInfo?.dept || '';
    const costCenter = r.costCenter || empInfo?.costCenter || '';
    const pbu = empInfo?.pbu || '';
    const mu = r.mu || empInfo?.mu || '';
    const position = r.position || empInfo?.position || '-';
    const machine = r.machine || empInfo?.machine || position;

    const areaResult = classifyArea(category, dept, costCenter, pbu, '', '', mu);
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

    const category = r.type || empInfo?.category || 'Contractor';
    const dept = r.department || r.deptRaw || empInfo?.dept || '';
    const costCenter = r.closing || empInfo?.costCenter || '';
    const location = r.location || '';
    const mu = empInfo?.mu || '';
    const position = r.position || empInfo?.position || '-';
    const machine = empInfo?.machine || position;

    const areaResult = classifyArea(category, dept, costCenter, '', location, r.closing, mu);
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
      empType: 'Contractor (WAS)',
      areaKey,
      areaName,
      closingCode: extractDeptCode(r.closing || costCenter || dept),
      department: dept,
      position,
      machine,
      shift: r.shiftLabel || (r.shiftNumber ? `กะ ${r.shiftNumber}` : 'Day'),
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
      netOpahHours: 0,
      isExcluded: meta.isExcluded6320 ? 'ตัดออกจากการคิด OPAH (6320)' : 'รวมในการคิด OPAH',
    };
  });

  rows.forEach((r) => {
    const sum = teamSummaryMap[r.areaKey];
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

  const teamSummary = AREA_5_KEYS.map((k) => teamSummaryMap[k]);

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
  specificTeamKey?: string
) {
  const { rows, teamSummary } = buildRawEmployeeRecords(
    gyRecords,
    contractorRecords,
    employeeMapping,
    dateFormatted
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
    'ชม. ปกติรวม (ชม.)': s.normalHours,
    'ชม. OT รวม (ชม.)': s.otHours,
    'ชม. ทำงานรวมทั้งหมด (ชม.)': s.totalHours,
    'ชม. สุทธิคิด OPAH (ชม.)': s.netOpahHours,
    'สถานะการคิด OPAH': s.isExcluded,
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Team_Summary_Matrix');

  if (specificTeamKey && specificTeamKey !== 'ALL') {
    // Export specific team only
    const teamRows = rows.filter((r) => r.areaKey === specificTeamKey);
    const wsTeam = XLSX.utils.json_to_sheet(teamRows.map(formatRow));
    const safeSheetName = `Team_${specificTeamKey.replace(/\s+/g, '_')}`;
    XLSX.utils.book_append_sheet(wb, wsTeam, safeSheetName);
  } else {
    // Sheet 2: All Employees Raw Data
    const allData = rows.map(formatRow);
    const wsAll = XLSX.utils.json_to_sheet(allData);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Raw_All_Employees');

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
