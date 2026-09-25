import { ParsedShiftRecord, EmployeeInfo, DailyAdjustmentRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { MonthlyStaffMetrics } from '../types/ohpa';
import { getMonthlyStaffMetrics, getMonthShiftCycleInfo, getPreviousMonthShift3Records } from './ohpaCalculator';

export type FunctionType = 'PRODUCTION' | 'QTECH' | 'ENG' | 'SHARE';
export type EmploymentType = 'GY_HOURLY' | 'CONTRACTOR_HOURLY' | 'MONTHLY';

export interface HierarchyWorker {
  empId: string;
  name: string;
  headcount: number;
  employmentType: EmploymentType;
  employmentLabel: string;
  functionType: FunctionType;
  functionLabel: string;
  teamKey: string;
  teamName: string;
  processKey: string;
  processName: string;
  machineKey: string;
  machineName: string;
  dept: string;
  costCenter: string;
  position: string;
  shift: number;
  shiftLabel: string;
  normalHours: number;
  otHours: number;
  totalHours: number;
}

export interface MetricSummary {
  headcount: number;
  normalHours: number;
  otHours: number;
  totalHours: number;
  otPercentage: number;
}

export interface FunctionBreakdown {
  production: MetricSummary;
  qtech: MetricSummary;
  eng: MetricSummary;
  share: MetricSummary;
}

export interface EmploymentBreakdown {
  monthly: MetricSummary;
  gyHourly: MetricSummary;
  contractor: MetricSummary;
}

export interface HierarchyNode {
  id: string;
  title: string;
  level: 'PLANT' | 'TEAM' | 'PROCESS' | 'MACHINE';
  parentId?: string;
  metrics: MetricSummary;
  functions: FunctionBreakdown;
  employment: EmploymentBreakdown;
  workers: HierarchyWorker[];
  children?: HierarchyNode[];
}

export function createEmptyMetricSummary(): MetricSummary {
  return {
    headcount: 0,
    normalHours: 0,
    otHours: 0,
    totalHours: 0,
    otPercentage: 0
  };
}

export function aggregateMetricSummary(workers: HierarchyWorker[]): MetricSummary {
  const headcount = Math.round(workers.reduce((s, w) => s + (w.headcount ?? 1), 0) * 10) / 10;
  const normalHours = Math.round(workers.reduce((s, w) => s + (w.normalHours || 0), 0) * 10) / 10;
  const otHours = Math.round(workers.reduce((s, w) => s + (w.otHours || 0), 0) * 10) / 10;
  const totalHours = Math.round((normalHours + otHours) * 10) / 10;
  const otPercentage = totalHours > 0 ? Math.round((otHours / totalHours) * 1000) / 10 : 0;
  return { headcount, normalHours, otHours, totalHours, otPercentage };
}

export function classifyFunction(dept: string, costCenter: string, position: string, machine: string): FunctionType {
  const d = (dept || '').toLowerCase();
  const cc = (costCenter || '').trim();
  const p = (position || '').toLowerCase();
  const m = (machine || '').toLowerCase();

  // 1. Qtech (Quality Tech / QA / QC / Lab)
  if (
    cc === '1040' ||
    d.includes('1040') ||
    d.includes('quality') ||
    d.includes('qa') ||
    d.includes('qc') ||
    p.includes('qtech') ||
    p.includes('quality') ||
    p.includes('inspector') ||
    p.includes('lab') ||
    m.includes('qtech') ||
    m.includes('inspection') ||
    m.includes('lab')
  ) {
    return 'QTECH';
  }

  // 2. Eng (Engineering / Maintenance / Technicians / Electricians)
  if (
    cc === '1110' ||
    d.includes('1110') ||
    d.includes('eng') ||
    d.includes('maintain') ||
    p.includes('eng') ||
    p.includes('technician') ||
    p.includes('mechanic') ||
    p.includes('electric') ||
    p.includes('maint') ||
    m.includes('maintenance') ||
    m.includes('tech')
  ) {
    return 'ENG';
  }

  // 3. Share / Support (Leaders, Supervisors, Material Handling, Support)
  if (
    p.includes('leader') ||
    p.includes('supervisor') ||
    p.includes('หัวหน้า') ||
    p.includes('manager') ||
    p.includes('support') ||
    p.includes('shared') ||
    p.includes('admin') ||
    p.includes('planning') ||
    (d.includes('6320') && (p.includes('admin') || p.includes('office')))
  ) {
    return 'SHARE';
  }

  // 4. Default: Direct Manufacturing Production
  return 'PRODUCTION';
}

export interface PlantClassification {
  teamKey: 'BCA' | 'CONSUMER' | 'AERO' | 'RETREAD';
  teamName: string;
  processKey: string;
  processName: string;
  machineKey: string;
  machineName: string;
}

export function classifyPlantLocation(dept: string, costCenter: string, position: string, machine: string): PlantClassification {
  const d = (dept || '').toUpperCase();
  const cc = (costCenter || '').trim();
  const p = (position || '').toUpperCase();
  const m = (machine || '').toUpperCase();
  const combined = `${d} ${cc} ${p} ${m}`;

  // 1. RETREAD (6320)
  if (cc === '6320' || d.includes('6320') || combined.includes('RETREAD')) {
    let subMachine = 'Build';
    let machineKey = 'RETREAD_BUILD';
    if (combined.includes('BUFF') || combined.includes('ขัด')) {
      subMachine = 'Buff';
      machineKey = 'RETREAD_BUFF';
    } else if (combined.includes('CURE') || combined.includes('CURING') || combined.includes('อบ')) {
      subMachine = 'Cure';
      machineKey = 'RETREAD_CURE';
    } else if (combined.includes('FINISH') || combined.includes('INSPECT') || combined.includes('ตรวจ')) {
      subMachine = 'Finish';
      machineKey = 'RETREAD_FINISH';
    } else {
      subMachine = 'Build';
      machineKey = 'RETREAD_BUILD';
    }

    return {
      teamKey: 'RETREAD',
      teamName: 'Retread Plant',
      processKey: 'RETREAD_OPS',
      processName: 'Retread Operations',
      machineKey,
      machineName: subMachine
    };
  }

  // 2. AERO (Aviation: Bias & Radial)
  if (
    d.startsWith('A') ||
    d.includes('AERO') ||
    d.includes('AVIATION') ||
    cc.startsWith('A') ||
    combined.includes('AERO') ||
    combined.includes('AVIATION') ||
    combined.includes('เครื่องบิน') ||
    cc === '5210' ||
    cc === '5230' ||
    cc === '5310' ||
    cc === '5330'
  ) {
    const isRadial = combined.includes('RADIAL') || combined.includes('A5110R') || combined.includes('A5130R') || cc === '5310' || cc === '5330' || d.startsWith('S') || cc.startsWith('S');
    const subProcessKey = isRadial ? 'RADIAL' : 'BIAS';
    const subProcessName = isRadial ? 'Radial Aero' : 'Bias Aero';

    let subMachine = 'Build';
    if (combined.includes('FINISH') || combined.includes('INSPECT') || combined.includes('TEST') || combined.includes('X-RAY') || combined.includes('FINAL')) {
      subMachine = 'Finishing';
    } else if (combined.includes('CURE') || combined.includes('CURING') || combined.includes('เตาอบ') || d.includes('5130') || d.includes('5230') || d.includes('5330')) {
      subMachine = 'Curing';
    } else {
      subMachine = 'Build';
    }

    return {
      teamKey: 'AERO',
      teamName: 'Aero (Aviation)',
      processKey: subProcessKey,
      processName: subProcessName,
      machineKey: `AERO_${subProcessKey}_${subMachine.toUpperCase()}`,
      machineName: subMachine
    };
  }

  // 3. CONSUMER (Passenger & Light Truck: 5110, 5130)
  if (
    cc === '5110' ||
    cc === '5130' ||
    d.includes('5110') ||
    d.includes('5130') ||
    combined.includes('CONSUMER') ||
    combined.includes('VMI') ||
    combined.includes('R.25') ||
    combined.includes('R25') ||
    combined.includes('FINAL FINISH') ||
    (combined.includes('CURING') && !combined.includes('BCA'))
  ) {
    const isBuild = cc === '5110' || d.includes('5110') || combined.includes('BUILD') || combined.includes('VMI') || combined.includes('R25') || combined.includes('R.25');

    if (isBuild) {
      const isVmi = combined.includes('VMI');
      const subMachine = isVmi ? 'VMI' : 'R.25';
      return {
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: 'BUILD',
        processName: 'Build (Building)',
        machineKey: `CONSUMER_BUILD_${isVmi ? 'VMI' : 'R25'}`,
        machineName: subMachine
      };
    } else {
      const isFF = combined.includes('FINAL') || combined.includes('FINISH') || combined.includes('INSPECT') || combined.includes('TRIM') || combined.includes('UNIFORM') || combined.includes('X-RAY');
      const subMachine = isFF ? 'Final Finish' : 'Curing';
      return {
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: 'FF_CURING',
        processName: 'FF/Curing (Final Finish & Curing)',
        machineKey: `CONSUMER_FF_${isFF ? 'FINAL_FINISH' : 'CURING'}`,
        machineName: subMachine
      };
    }
  }

  // 4. BCA (Banbury, Calender, Stock Prep & Components: 3200, 3300, 4110, 4120, 4130, 4200, 4300)
  const isMixExtrusion =
    (cc === '3200' ||
    cc === '4300' ||
    combined.includes('BANBURY') ||
    combined.includes('MIXER') ||
    combined.includes('PIGMENT') ||
    combined.includes('EXTRU') ||
    combined.includes('TUBER') ||
    combined.includes('6"X8"') ||
    combined.includes('6X8') ||
    combined.includes('QUAD')) &&
    !combined.includes('4ROLL') &&
    !combined.includes('CALENDER') &&
    !combined.includes('CEMENT') &&
    !combined.includes('3ROLL');

  if (isMixExtrusion) {
    let subMachine = '430 6"x8" Tuber';
    let machineKey = '430_6X8_TUBER';

    if (combined.includes('BANBURY # 1') || combined.includes('BANBURY #1') || combined.includes('MIXER 1') || combined.includes('BB1')) {
      subMachine = '320 BANBURY # 1';
      machineKey = '320_BANBURY_1';
    } else if (combined.includes('BANBURY # 2') || combined.includes('BANBURY #2') || combined.includes('MIXER 2') || combined.includes('BB2')) {
      subMachine = '320 BANBURY # 2';
      machineKey = '320_BANBURY_2';
    } else if (combined.includes('PIGMENT')) {
      subMachine = '320 Pigment';
      machineKey = '320_PIGMENT';
    } else if (combined.includes('QUAD')) {
      subMachine = '430 Quad';
      machineKey = '430_QUAD';
    } else {
      subMachine = '430 6"x8" Tuber';
      machineKey = '430_6X8_TUBER';
    }

    return {
      teamKey: 'BCA',
      teamName: 'BCA',
      processKey: 'MIX_EXTRUSION',
      processName: 'Mix & Extrusion',
      machineKey,
      machineName: subMachine
    };
  } else {
    // Component Prep (13 specific machines from Team A standard list)
    let subMachine = '411 4Roll#1';
    let machineKey = '411_4ROLL_1';

    if (combined.includes('3ROLL') || combined.includes('3-ROLL') || combined.includes('3 ROLL') || combined.includes('CEMENT') || cc === '3300' || cc === '3700') {
      subMachine = '3roll + Cement (3300/3700)';
      machineKey = '3ROLL_CEMENT_3300_3700';
    } else if (combined.includes('4ROLL#2') || combined.includes('4 ROLL #2') || combined.includes('4ROLL # 2') || combined.includes('4 ROLL#2') || combined.includes('4ROLL 2')) {
      subMachine = '411 4Roll#2';
      machineKey = '411_4ROLL_2';
    } else if (combined.includes('4ROLL#1') || combined.includes('4 ROLL #1') || combined.includes('4ROLL # 1') || combined.includes('4 ROLL#1') || combined.includes('4-ROLL CALENDER') || combined.includes('4ROLL 1')) {
      subMachine = '411 4Roll#1';
      machineKey = '411_4ROLL_1';
    } else if (combined.includes('CHAFER')) {
      subMachine = '411 Chafer lay up';
      machineKey = '411_CHAFER_LAY_UP';
    } else if (combined.includes('LUX') || combined.includes('SLITTER')) {
      subMachine = '411 Lux/slitter';
      machineKey = '411_LUX_SLITTER';
    } else if (combined.includes('SHEAR') || combined.includes('FISCER') || combined.includes('FISCHER')) {
      subMachine = '411 Shear Fiscer';
      machineKey = '411_SHEAR_FISCER';
    } else if (combined.includes('BAND72') || combined.includes('BAND 72') || cc === '4130') {
      subMachine = '413 Band72"';
      machineKey = '413_BAND_72';
    } else if (combined.includes('BAND54') || combined.includes('BAND 54') || combined.includes('BAND') || cc === '4120') {
      subMachine = '412 Band54"';
      machineKey = '412_BAND_54';
    } else if (combined.includes('BEAD FLAP') || combined.includes('BEADFLAP')) {
      subMachine = '420 Bead Flap';
      machineKey = '420_BEAD_FLAP';
    } else if (combined.includes('BEAD INSUL') || combined.includes('INSULATION')) {
      subMachine = '420 Bead insulation';
      machineKey = '420_BEAD_INSULATION';
    } else if (combined.includes('BEAD WRAP') || combined.includes('BEADWRAP')) {
      subMachine = '420 Bead Wrap';
      machineKey = '420_BEAD_WRAP';
    } else if (combined.includes('HOT APEX') || combined.includes('HOTAPEX') || combined.includes('APEXER')) {
      subMachine = '420 Hot apexer';
      machineKey = '420_HOT_APEXER';
    } else if (combined.includes('HEX BEAD') || combined.includes('HEXBEAD') || combined.includes('BEAD') || cc === '4200') {
      subMachine = '420 Hex Bead';
      machineKey = '420_HEX_BEAD';
    } else {
      subMachine = '411 4Roll#1';
      machineKey = '411_4ROLL_1';
    }

    return {
      teamKey: 'BCA',
      teamName: 'BCA',
      processKey: 'COMPONENT_PREP',
      processName: 'Component Prep',
      machineKey,
      machineName: subMachine
    };
  }
}

export function buildPlantHierarchyTree(
  gyRecords: ParsedShiftRecord[],
  contractorRecords: ContractorScanRecord[],
  employeeMapping: Record<string, EmployeeInfo>,
  currentDateFormatted: string,
  shiftFilter: number | 'ALL' = 'ALL',
  allScanPresets: { name: string; dateFormatted?: string; content: string }[] = [],
  contractorRecordsByDate: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }> = {},
  dailyAdjustments: DailyAdjustmentRecord[] = [],
  categoryFilter: 'ALL' | 'PRODUCTION' | 'ENG' | 'QTECH' | 'WAS' = 'ALL'
): { root: HierarchyNode; allWorkers: HierarchyWorker[] } {
  const allWorkers: HierarchyWorker[] = [];
  const monthlyMetrics = getMonthlyStaffMetrics(currentDateFormatted);
  const cycleInfo = getMonthShiftCycleInfo(currentDateFormatted);

  let activeGyRecords = [...gyRecords];
  let activeContRecords = [...contractorRecords];

  if (cycleInfo.isFirstDayOfMonth) {
    const prevMonthShift3 = getPreviousMonthShift3Records(
      cycleInfo.prevMonthLastDayDateStr,
      allScanPresets,
      contractorRecordsByDate,
      employeeMapping,
      dailyAdjustments
    );
    activeGyRecords = [...prevMonthShift3.gyRecords, ...activeGyRecords];
    activeContRecords = [...prevMonthShift3.contRecords, ...activeContRecords];
  } else if (cycleInfo.isLastDayOfMonth) {
    activeGyRecords = activeGyRecords.filter(r => r.shift !== 3);
    activeContRecords = activeContRecords.filter(r => r.shiftNumber !== 3);
  }

  // Helper to get MU
  const getEmpMu = (empId: string, fallbackMu?: string, category?: string, dept?: string, costCenter?: string): string => {
    const emp = employeeMapping[empId] || employeeMapping[empId.replace(/^0+/, '')] || employeeMapping[empId.padStart(5, '0')];
    if (emp?.mu) return emp.mu.trim();
    if (fallbackMu) return fallbackMu.trim();
    return 'Non-HPT';
  };

  // 1. Process GY Hourly Records
  activeGyRecords.forEach(r => {
    if (categoryFilter === 'WAS') return; // GY workers are not WAS
    if (shiftFilter !== 'ALL' && r.shift !== shiftFilter) return;
    const normH = r.normalWorkHours || 0;
    const otH = r.otHours || 0;
    const totH = normH + otH;
    if (totH <= 0 && !r.inTime) return;

    const empInfo = employeeMapping[r.empId] || employeeMapping[r.empId.replace(/^0+/, '')] || employeeMapping[r.empId.padStart(5, '0')];
    const dept = (empInfo?.dept || r.dept || '').trim();
    const cc = (empInfo?.costCenter || r.costCenter || '').trim();
    const pos = (empInfo?.position || r.position || '').trim();
    const mach = (r.regularMachineOverride || r.otMachineOverride || empInfo?.machine || r.machine || pos || 'General').trim();

    const fnType = classifyFunction(dept, cc, pos, mach);
    if (categoryFilter === 'PRODUCTION' && fnType !== 'PRODUCTION') return;
    if (categoryFilter === 'ENG' && fnType !== 'ENG') return;
    if (categoryFilter === 'QTECH' && fnType !== 'QTECH') return;

    const fnLabel = fnType === 'PRODUCTION' ? 'Production' : (fnType === 'QTECH' ? 'Qtech' : (fnType === 'ENG' ? 'Eng' : 'Share'));
    const loc = classifyPlantLocation(dept, cc, pos, mach);
    const mu = getEmpMu(r.empId, r.mu, r.category, r.dept, r.costCenter);
    const baseName = r.nameTH || r.nameEN || empInfo?.nameTH || empInfo?.nameEN || `พนักงาน ${r.empId}`;

    if (mu === 'BCA') {
      allWorkers.push({
        empId: r.empId,
        name: baseName,
        headcount: 1,
        employmentType: 'GY_HOURLY',
        employmentLabel: 'พนักงาน GY (รายกะ)',
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: loc.processKey === 'MIX_EXTRUSION' ? 'MIX_EXTRUSION' : 'COMPONENT_PREP',
        processName: loc.processKey === 'MIX_EXTRUSION' ? 'Mix & Extrusion' : 'Component Prep',
        machineKey: loc.machineKey,
        machineName: loc.machineName,
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shift,
        shiftLabel: r.shiftLabel,
        normalHours: normH,
        otHours: otH,
        totalHours: totH
      });
    } else if (mu === 'Consumer') {
      allWorkers.push({
        empId: r.empId,
        name: baseName,
        headcount: 1,
        employmentType: 'GY_HOURLY',
        employmentLabel: 'พนักงาน GY (รายกะ)',
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: loc.processKey === 'BUILD' ? 'BUILD' : 'FF_CURING',
        processName: loc.processKey === 'BUILD' ? 'Build (Building)' : 'FF/Curing (Final Finish & Curing)',
        machineKey: loc.machineKey,
        machineName: loc.machineName,
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shift,
        shiftLabel: r.shiftLabel,
        normalHours: normH,
        otHours: otH,
        totalHours: totH
      });
    } else if (mu === 'Bias Aero') {
      allWorkers.push({
        empId: r.empId,
        name: baseName,
        headcount: 1,
        employmentType: 'GY_HOURLY',
        employmentLabel: 'พนักงาน GY (รายกะ)',
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'AERO',
        teamName: 'Aero (Aviation)',
        processKey: 'BIAS',
        processName: 'Bias Aero',
        machineKey: loc.machineKey.startsWith('AERO_BIAS_') ? loc.machineKey : (loc.machineKey.includes('CURE') ? 'AERO_BIAS_CURING' : (loc.machineKey.includes('FIN') ? 'AERO_BIAS_FINISHING' : 'AERO_BIAS_BUILD')),
        machineName: loc.machineName,
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shift,
        shiftLabel: r.shiftLabel,
        normalHours: normH,
        otHours: otH,
        totalHours: totH
      });
    } else if (mu === 'Radial Aero') {
      allWorkers.push({
        empId: r.empId,
        name: baseName,
        headcount: 1,
        employmentType: 'GY_HOURLY',
        employmentLabel: 'พนักงาน GY (รายกะ)',
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'AERO',
        teamName: 'Aero (Aviation)',
        processKey: 'RADIAL',
        processName: 'Radial Aero',
        machineKey: loc.machineKey.startsWith('AERO_RADIAL_') ? loc.machineKey : (loc.machineKey.includes('CURE') ? 'AERO_RADIAL_CURING' : (loc.machineKey.includes('FIN') ? 'AERO_RADIAL_FINISHING' : 'AERO_RADIAL_BUILD')),
        machineName: loc.machineName,
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shift,
        shiftLabel: r.shiftLabel,
        normalHours: normH,
        otHours: otH,
        totalHours: totH
      });
    } else if (mu === 'Retread') {
      allWorkers.push({
        empId: r.empId,
        name: baseName,
        headcount: 1,
        employmentType: 'GY_HOURLY',
        employmentLabel: 'พนักงาน GY (รายกะ)',
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'RETREAD',
        teamName: 'Retread Plant',
        processKey: 'RETREAD_OPS',
        processName: 'Retread Operations',
        machineKey: loc.machineKey.startsWith('RETREAD_') ? loc.machineKey : 'RETREAD_BUILD',
        machineName: loc.machineName,
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shift,
        shiftLabel: r.shiftLabel,
        normalHours: normH,
        otHours: otH,
        totalHours: totH
      });
    } else if (mu === 'Consumer/Bias Aero') {
      // Shared 50% between Consumer and Bias Aero
      allWorkers.push({
        empId: `${r.empId}-CON`,
        name: `${baseName} (50% Consumer)`,
        headcount: 0.5,
        employmentType: 'GY_HOURLY',
        employmentLabel: 'พนักงาน GY (รายกะ)',
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: 'BUILD',
        processName: 'Build (Building)',
        machineKey: 'CONSUMER_SHARED_CON_BIAS',
        machineName: 'Shared Con/Bias (Building)',
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shift,
        shiftLabel: r.shiftLabel,
        normalHours: Math.round(normH * 0.5 * 10) / 10,
        otHours: Math.round(otH * 0.5 * 10) / 10,
        totalHours: Math.round(totH * 0.5 * 10) / 10
      });
      allWorkers.push({
        empId: `${r.empId}-BIAS`,
        name: `${baseName} (50% Bias Aero)`,
        headcount: 0.5,
        employmentType: 'GY_HOURLY',
        employmentLabel: 'พนักงาน GY (รายกะ)',
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'AERO',
        teamName: 'Aero (Aviation)',
        processKey: 'BIAS',
        processName: 'Bias Aero',
        machineKey: 'AERO_BIAS_SHARED_CON_BIAS',
        machineName: 'Shared Con/Bias (Bias Aero)',
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shift,
        shiftLabel: r.shiftLabel,
        normalHours: Math.round(normH * 0.5 * 10) / 10,
        otHours: Math.round(otH * 0.5 * 10) / 10,
        totalHours: Math.round(totH * 0.5 * 10) / 10
      });
    } else {
      // Non-HPT: 20% (1/5) distributed across all 5 areas
      const nonHptConfigs = [
        { teamKey: 'BCA' as const, teamName: 'BCA', processKey: 'COMPONENT_PREP', processName: 'Component Prep', machineKey: 'BCA_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (BCA 1/5)' },
        { teamKey: 'CONSUMER' as const, teamName: 'Consumer', processKey: 'BUILD', processName: 'Build (Building)', machineKey: 'CONSUMER_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Consumer 1/5)' },
        { teamKey: 'AERO' as const, teamName: 'Aero (Aviation)', processKey: 'BIAS', processName: 'Bias Aero', machineKey: 'AERO_BIAS_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Bias Aero 1/5)' },
        { teamKey: 'AERO' as const, teamName: 'Aero (Aviation)', processKey: 'RADIAL', processName: 'Radial Aero', machineKey: 'AERO_RADIAL_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Radial Aero 1/5)' },
        { teamKey: 'RETREAD' as const, teamName: 'Retread Plant', processKey: 'RETREAD_OPS', processName: 'Retread Operations', machineKey: 'RETREAD_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Retread 1/5)' },
      ];

      nonHptConfigs.forEach(cfg => {
        allWorkers.push({
          empId: `${r.empId}-${cfg.teamKey}-${cfg.processKey}`,
          name: `${baseName} (${cfg.teamName} 1/5)`,
          headcount: 0.2,
          employmentType: 'GY_HOURLY',
          employmentLabel: 'พนักงาน GY (รายกะ)',
          functionType: fnType,
          functionLabel: fnLabel,
          teamKey: cfg.teamKey,
          teamName: cfg.teamName,
          processKey: cfg.processKey,
          processName: cfg.processName,
          machineKey: cfg.machineKey,
          machineName: cfg.machineName,
          dept: dept || cc,
          costCenter: cc,
          position: pos || mach,
          shift: r.shift,
          shiftLabel: r.shiftLabel,
          normalHours: Math.round(normH * 0.2 * 10) / 10,
          otHours: Math.round(otH * 0.2 * 10) / 10,
          totalHours: Math.round(totH * 0.2 * 10) / 10
        });
      });
    }
  });

  // 2. Process Contractor Hourly Records
  let hasScannedWasMonthly = false;
  activeContRecords.forEach(r => {
    if (!r.hasScannedIn && r.totalHours <= 0) return;
    if (shiftFilter !== 'ALL' && r.shiftNumber !== shiftFilter) return;

    const isMonthly = r.type === 'Salary' || (r as any).isMonthly;
    if (isMonthly) hasScannedWasMonthly = true;
    const empType: EmploymentType = isMonthly ? 'MONTHLY' : 'CONTRACTOR_HOURLY';
    const empLabel = isMonthly ? 'Contractor รายเดือน (WAS)' : 'Contractor รายชั่วโมง (WAS)';

    const dept = (r.department || '').trim();
    const cc = (r.closing || '').trim();
    const pos = (r.position || '').trim();
    const mach = (r.location || pos || 'General Contractor').trim();

    const fnType = classifyFunction(dept, cc, pos, mach);
    if (categoryFilter === 'PRODUCTION' && fnType !== 'PRODUCTION') return;
    if (categoryFilter === 'ENG' && fnType !== 'ENG') return;
    if (categoryFilter === 'QTECH' && fnType !== 'QTECH') return;

    const fnLabel = fnType === 'PRODUCTION' ? 'Production' : (fnType === 'QTECH' ? 'Qtech' : (fnType === 'ENG' ? 'Eng' : 'Share'));
    const loc = classifyPlantLocation(dept, cc, pos, mach);

    const empCode = r.empCode || (r as any).workerId || '';
    const empInfo = employeeMapping[empCode] || employeeMapping[empCode.replace(/^0+/, '')] || employeeMapping[empCode.padStart(5, '0')];
    let mu = getEmpMu(empCode, '', '', r.department, r.closing);
    if (!mu || mu === 'Non-HPT') {
      if (cc === '6320' || dept.includes('6320') || mach.toLowerCase().includes('retread')) mu = 'Retread';
      else if (dept.startsWith('A') || cc.startsWith('A')) mu = 'Bias Aero';
      else if (dept.startsWith('S') || cc.startsWith('S')) mu = 'Radial Aero';
      else if (['5110', '5120', '5130'].includes(cc)) mu = 'Consumer';
      else if (['3200', '3300', '4110', '4120', '4130', '4200', '4300'].includes(cc)) mu = 'BCA';
      else mu = 'Non-HPT';
    }

    const normH = r.normalHours || 0;
    const otH = r.otHours || 0;
    const totH = normH + otH;
    const baseName = r.nameTh || r.nameEn || r.empCode || 'Contractor Worker';

    if (mu === 'BCA') {
      allWorkers.push({
        empId: empCode || 'CONT',
        name: baseName,
        headcount: 1,
        employmentType: empType,
        employmentLabel: empLabel,
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: loc.processKey === 'MIX_EXTRUSION' ? 'MIX_EXTRUSION' : 'COMPONENT_PREP',
        processName: loc.processKey === 'MIX_EXTRUSION' ? 'Mix & Extrusion' : 'Component Prep',
        machineKey: loc.machineKey,
        machineName: loc.machineName,
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shiftNumber || 1,
        shiftLabel: `กะ ${r.shiftNumber || 1}`,
        normalHours: normH,
        otHours: otH,
        totalHours: totH
      });
    } else if (mu === 'Consumer') {
      allWorkers.push({
        empId: empCode || 'CONT',
        name: baseName,
        headcount: 1,
        employmentType: empType,
        employmentLabel: empLabel,
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: loc.processKey === 'BUILD' ? 'BUILD' : 'FF_CURING',
        processName: loc.processKey === 'BUILD' ? 'Build (Building)' : 'FF/Curing (Final Finish & Curing)',
        machineKey: loc.machineKey,
        machineName: loc.machineName,
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shiftNumber || 1,
        shiftLabel: `กะ ${r.shiftNumber || 1}`,
        normalHours: normH,
        otHours: otH,
        totalHours: totH
      });
    } else if (mu === 'Bias Aero') {
      allWorkers.push({
        empId: empCode || 'CONT',
        name: baseName,
        headcount: 1,
        employmentType: empType,
        employmentLabel: empLabel,
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'AERO',
        teamName: 'Aero (Aviation)',
        processKey: 'BIAS',
        processName: 'Bias Aero',
        machineKey: loc.machineKey.startsWith('AERO_BIAS_') ? loc.machineKey : (loc.machineKey.includes('CURE') ? 'AERO_BIAS_CURING' : (loc.machineKey.includes('FIN') ? 'AERO_BIAS_FINISHING' : 'AERO_BIAS_BUILD')),
        machineName: loc.machineName,
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shiftNumber || 1,
        shiftLabel: `กะ ${r.shiftNumber || 1}`,
        normalHours: normH,
        otHours: otH,
        totalHours: totH
      });
    } else if (mu === 'Radial Aero') {
      allWorkers.push({
        empId: empCode || 'CONT',
        name: baseName,
        headcount: 1,
        employmentType: empType,
        employmentLabel: empLabel,
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'AERO',
        teamName: 'Aero (Aviation)',
        processKey: 'RADIAL',
        processName: 'Radial Aero',
        machineKey: loc.machineKey.startsWith('AERO_RADIAL_') ? loc.machineKey : (loc.machineKey.includes('CURE') ? 'AERO_RADIAL_CURING' : (loc.machineKey.includes('FIN') ? 'AERO_RADIAL_FINISHING' : 'AERO_RADIAL_BUILD')),
        machineName: loc.machineName,
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shiftNumber || 1,
        shiftLabel: `กะ ${r.shiftNumber || 1}`,
        normalHours: normH,
        otHours: otH,
        totalHours: totH
      });
    } else if (mu === 'Retread') {
      allWorkers.push({
        empId: empCode || 'CONT',
        name: baseName,
        headcount: 1,
        employmentType: empType,
        employmentLabel: empLabel,
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'RETREAD',
        teamName: 'Retread Plant',
        processKey: 'RETREAD_OPS',
        processName: 'Retread Operations',
        machineKey: loc.machineKey.startsWith('RETREAD_') ? loc.machineKey : 'RETREAD_BUILD',
        machineName: loc.machineName,
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shiftNumber || 1,
        shiftLabel: `กะ ${r.shiftNumber || 1}`,
        normalHours: normH,
        otHours: otH,
        totalHours: totH
      });
    } else if (mu === 'Consumer/Bias Aero') {
      allWorkers.push({
        empId: `${empCode}-CON`,
        name: `${baseName} (Cont 50% Con)`,
        headcount: 0.5,
        employmentType: empType,
        employmentLabel: empLabel,
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: 'BUILD',
        processName: 'Build (Building)',
        machineKey: 'CONSUMER_SHARED_CON_BIAS',
        machineName: 'Shared Con/Bias (Building)',
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shiftNumber || 1,
        shiftLabel: `กะ ${r.shiftNumber || 1}`,
        normalHours: Math.round(normH * 0.5 * 10) / 10,
        otHours: Math.round(otH * 0.5 * 10) / 10,
        totalHours: Math.round(totH * 0.5 * 10) / 10
      });
      allWorkers.push({
        empId: `${empCode}-BIAS`,
        name: `${baseName} (Cont 50% Bias)`,
        headcount: 0.5,
        employmentType: empType,
        employmentLabel: empLabel,
        functionType: fnType,
        functionLabel: fnLabel,
        teamKey: 'AERO',
        teamName: 'Aero (Aviation)',
        processKey: 'BIAS',
        processName: 'Bias Aero',
        machineKey: 'AERO_BIAS_SHARED_CON_BIAS',
        machineName: 'Shared Con/Bias (Bias Aero)',
        dept: dept || cc,
        costCenter: cc,
        position: pos || mach,
        shift: r.shiftNumber || 1,
        shiftLabel: `กะ ${r.shiftNumber || 1}`,
        normalHours: Math.round(normH * 0.5 * 10) / 10,
        otHours: Math.round(otH * 0.5 * 10) / 10,
        totalHours: Math.round(totH * 0.5 * 10) / 10
      });
    } else {
      const nonHptConfigs = [
        { teamKey: 'BCA' as const, teamName: 'BCA', processKey: 'COMPONENT_PREP', processName: 'Component Prep', machineKey: 'BCA_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (BCA 1/5)' },
        { teamKey: 'CONSUMER' as const, teamName: 'Consumer', processKey: 'BUILD', processName: 'Build (Building)', machineKey: 'CONSUMER_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Consumer 1/5)' },
        { teamKey: 'AERO' as const, teamName: 'Aero (Aviation)', processKey: 'BIAS', processName: 'Bias Aero', machineKey: 'AERO_BIAS_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Bias Aero 1/5)' },
        { teamKey: 'AERO' as const, teamName: 'Aero (Aviation)', processKey: 'RADIAL', processName: 'Radial Aero', machineKey: 'AERO_RADIAL_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Radial Aero 1/5)' },
        { teamKey: 'RETREAD' as const, teamName: 'Retread Plant', processKey: 'RETREAD_OPS', processName: 'Retread Operations', machineKey: 'RETREAD_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Retread 1/5)' },
      ];

      nonHptConfigs.forEach(cfg => {
        allWorkers.push({
          empId: `${empCode}-${cfg.teamKey}-${cfg.processKey}`,
          name: `${baseName} (Cont ${cfg.teamName} 1/5)`,
          headcount: 0.2,
          employmentType: empType,
          employmentLabel: empLabel,
          functionType: fnType,
          functionLabel: fnLabel,
          teamKey: cfg.teamKey,
          teamName: cfg.teamName,
          processKey: cfg.processKey,
          processName: cfg.processName,
          machineKey: cfg.machineKey,
          machineName: cfg.machineName,
          dept: dept || cc,
          costCenter: cc,
          position: pos || mach,
          shift: r.shiftNumber || 1,
          shiftLabel: `กะ ${r.shiftNumber || 1}`,
          normalHours: Math.round(normH * 0.2 * 10) / 10,
          otHours: Math.round(otH * 0.2 * 10) / 10,
          totalHours: Math.round(totH * 0.2 * 10) / 10
        });
      });
    }
  });

  // 3. Process Monthly Staff Distribution (If shiftFilter === 'ALL' or shiftFilter === 1)
  if (shiftFilter === 'ALL' || shiftFilter === 1) {
    const hoursPerPerson = typeof monthlyMetrics.hoursPerPerson === 'number' ? monthlyMetrics.hoursPerPerson : 8;
    const monthlyStaffList = Object.values(employeeMapping).filter(e => e.sourceSheet === 'Salaries' || e.mor === 'Salaried');

    if (hoursPerPerson > 0 && monthlyStaffList.length > 0) {
      monthlyStaffList.forEach(e => {
        const mu = (e.mu || 'Non-HPT').trim();
        const dept = e.dept || 'Monthly Staff';
        const cc = e.costCenter || 'Monthly Staff';
        const pos = e.position || 'Monthly Staff';
        const mach = e.machine || pos || 'General';

        const fnType = classifyFunction(dept, cc, pos, mach);
        if (categoryFilter === 'WAS') return; // GY Monthly staff is not WAS
        if (categoryFilter !== 'ALL' && (fnType as string) !== categoryFilter) return;

        const fnLabel = fnType === 'PRODUCTION' ? 'Production' : (fnType === 'QTECH' ? 'Qtech' : (fnType === 'ENG' ? 'Eng' : 'Share'));
        const loc = classifyPlantLocation(dept, cc, pos, mach);
        const baseName = e.nameTH || e.nameEN || `เจ้าหน้าที่รายเดือน ${e.empId}`;

        if (mu === 'BCA') {
          allWorkers.push({
            empId: e.empId,
            name: baseName,
            headcount: 1,
            employmentType: 'MONTHLY',
            employmentLabel: 'พนักงานรายเดือน GY',
            functionType: fnType,
            functionLabel: fnLabel,
            teamKey: 'BCA',
            teamName: 'BCA',
            processKey: loc.processKey === 'MIX_EXTRUSION' ? 'MIX_EXTRUSION' : 'COMPONENT_PREP',
            processName: loc.processKey === 'MIX_EXTRUSION' ? 'Mix & Extrusion' : 'Component Prep',
            machineKey: loc.machineKey,
            machineName: loc.machineName,
            dept,
            costCenter: cc,
            position: pos,
            shift: 1,
            shiftLabel: 'กะเช้า / Day',
            normalHours: hoursPerPerson,
            otHours: 0,
            totalHours: hoursPerPerson
          });
        } else if (mu === 'Consumer') {
          allWorkers.push({
            empId: e.empId,
            name: baseName,
            headcount: 1,
            employmentType: 'MONTHLY',
            employmentLabel: 'พนักงานรายเดือน GY',
            functionType: fnType,
            functionLabel: fnLabel,
            teamKey: 'CONSUMER',
            teamName: 'Consumer',
            processKey: loc.processKey === 'BUILD' ? 'BUILD' : 'FF_CURING',
            processName: loc.processKey === 'BUILD' ? 'Build (Building)' : 'FF/Curing (Final Finish & Curing)',
            machineKey: loc.machineKey,
            machineName: loc.machineName,
            dept,
            costCenter: cc,
            position: pos,
            shift: 1,
            shiftLabel: 'กะเช้า / Day',
            normalHours: hoursPerPerson,
            otHours: 0,
            totalHours: hoursPerPerson
          });
        } else if (mu === 'Bias Aero') {
          allWorkers.push({
            empId: e.empId,
            name: baseName,
            headcount: 1,
            employmentType: 'MONTHLY',
            employmentLabel: 'พนักงานรายเดือน GY',
            functionType: fnType,
            functionLabel: fnLabel,
            teamKey: 'AERO',
            teamName: 'Aero (Aviation)',
            processKey: 'BIAS',
            processName: 'Bias Aero',
            machineKey: loc.machineKey.startsWith('AERO_BIAS_') ? loc.machineKey : (loc.machineKey.includes('CURE') ? 'AERO_BIAS_CURING' : (loc.machineKey.includes('FIN') ? 'AERO_BIAS_FINISHING' : 'AERO_BIAS_BUILD')),
            machineName: loc.machineName,
            dept,
            costCenter: cc,
            position: pos,
            shift: 1,
            shiftLabel: 'กะเช้า / Day',
            normalHours: hoursPerPerson,
            otHours: 0,
            totalHours: hoursPerPerson
          });
        } else if (mu === 'Radial Aero') {
          allWorkers.push({
            empId: e.empId,
            name: baseName,
            headcount: 1,
            employmentType: 'MONTHLY',
            employmentLabel: 'พนักงานรายเดือน GY',
            functionType: fnType,
            functionLabel: fnLabel,
            teamKey: 'AERO',
            teamName: 'Aero (Aviation)',
            processKey: 'RADIAL',
            processName: 'Radial Aero',
            machineKey: loc.machineKey.startsWith('AERO_RADIAL_') ? loc.machineKey : (loc.machineKey.includes('CURE') ? 'AERO_RADIAL_CURING' : (loc.machineKey.includes('FIN') ? 'AERO_RADIAL_FINISHING' : 'AERO_RADIAL_BUILD')),
            machineName: loc.machineName,
            dept,
            costCenter: cc,
            position: pos,
            shift: 1,
            shiftLabel: 'กะเช้า / Day',
            normalHours: hoursPerPerson,
            otHours: 0,
            totalHours: hoursPerPerson
          });
        } else if (mu === 'Retread') {
          allWorkers.push({
            empId: e.empId,
            name: baseName,
            headcount: 1,
            employmentType: 'MONTHLY',
            employmentLabel: 'พนักงานรายเดือน GY',
            functionType: fnType,
            functionLabel: fnLabel,
            teamKey: 'RETREAD',
            teamName: 'Retread Plant',
            processKey: 'RETREAD_OPS',
            processName: 'Retread Operations',
            machineKey: loc.machineKey.startsWith('RETREAD_') ? loc.machineKey : 'RETREAD_BUILD',
            machineName: loc.machineName,
            dept,
            costCenter: cc,
            position: pos,
            shift: 1,
            shiftLabel: 'กะเช้า / Day',
            normalHours: hoursPerPerson,
            otHours: 0,
            totalHours: hoursPerPerson
          });
        } else if (mu === 'Consumer/Bias Aero') {
          allWorkers.push({
            empId: `${e.empId}-CON`,
            name: `${baseName} (รายเดือน 50% Con)`,
            headcount: 0.5,
            employmentType: 'MONTHLY',
            employmentLabel: 'พนักงานรายเดือน GY',
            functionType: fnType,
            functionLabel: fnLabel,
            teamKey: 'CONSUMER',
            teamName: 'Consumer',
            processKey: 'BUILD',
            processName: 'Build (Building)',
            machineKey: 'CONSUMER_SHARED_CON_BIAS',
            machineName: 'Shared Con/Bias (Building)',
            dept,
            costCenter: cc,
            position: pos,
            shift: 1,
            shiftLabel: 'กะเช้า / Day',
            normalHours: Math.round(hoursPerPerson * 0.5 * 10) / 10,
            otHours: 0,
            totalHours: Math.round(hoursPerPerson * 0.5 * 10) / 10
          });
          allWorkers.push({
            empId: `${e.empId}-BIAS`,
            name: `${baseName} (รายเดือน 50% Bias)`,
            headcount: 0.5,
            employmentType: 'MONTHLY',
            employmentLabel: 'พนักงานรายเดือน GY',
            functionType: fnType,
            functionLabel: fnLabel,
            teamKey: 'AERO',
            teamName: 'Aero (Aviation)',
            processKey: 'BIAS',
            processName: 'Bias Aero',
            machineKey: 'AERO_BIAS_SHARED_CON_BIAS',
            machineName: 'Shared Con/Bias (Bias Aero)',
            dept,
            costCenter: cc,
            position: pos,
            shift: 1,
            shiftLabel: 'กะเช้า / Day',
            normalHours: Math.round(hoursPerPerson * 0.5 * 10) / 10,
            otHours: 0,
            totalHours: Math.round(hoursPerPerson * 0.5 * 10) / 10
          });
        } else {
          const nonHptConfigs = [
            { teamKey: 'BCA' as const, teamName: 'BCA', processKey: 'COMPONENT_PREP', processName: 'Component Prep', machineKey: 'BCA_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (BCA 1/5)' },
            { teamKey: 'CONSUMER' as const, teamName: 'Consumer', processKey: 'BUILD', processName: 'Build (Building)', machineKey: 'CONSUMER_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Consumer 1/5)' },
            { teamKey: 'AERO' as const, teamName: 'Aero (Aviation)', processKey: 'BIAS', processName: 'Bias Aero', machineKey: 'AERO_BIAS_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Bias Aero 1/5)' },
            { teamKey: 'AERO' as const, teamName: 'Aero (Aviation)', processKey: 'RADIAL', processName: 'Radial Aero', machineKey: 'AERO_RADIAL_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Radial Aero 1/5)' },
            { teamKey: 'RETREAD' as const, teamName: 'Retread Plant', processKey: 'RETREAD_OPS', processName: 'Retread Operations', machineKey: 'RETREAD_NON_HPT_SUPPORT', machineName: 'Non-HPT Support (Retread 1/5)' },
          ];

          nonHptConfigs.forEach(cfg => {
            allWorkers.push({
              empId: `${e.empId}-${cfg.teamKey}-${cfg.processKey}`,
              name: `${baseName} (รายเดือน ${cfg.teamName} 1/5)`,
              headcount: 0.2,
              employmentType: 'MONTHLY',
              employmentLabel: 'พนักงานรายเดือน GY',
              functionType: fnType,
              functionLabel: fnLabel,
              teamKey: cfg.teamKey,
              teamName: cfg.teamName,
              processKey: cfg.processKey,
              processName: cfg.processName,
              machineKey: cfg.machineKey,
              machineName: cfg.machineName,
              dept,
              costCenter: cc,
              position: pos,
              shift: 1,
              shiftLabel: 'กะเช้า / Day',
              normalHours: Math.round(hoursPerPerson * 0.2 * 10) / 10,
              otHours: 0,
              totalHours: Math.round(hoursPerPerson * 0.2 * 10) / 10
            });
          });
        }
      });
    } else if (hoursPerPerson > 0 && monthlyMetrics.count > 0) {
      // Fallback: 61 GY Monthly Staff + 9 WAS Monthly Staff (Distributed 1/5 to each of the 5 areas)
      const targetAreas: Array<{ teamKey: 'BCA' | 'CONSUMER' | 'AERO' | 'RETREAD'; teamName: string; processKey: string; processName: string; machineKey: string; machineName: string }> = [
        { teamKey: 'BCA', teamName: 'BCA', processKey: 'COMPONENT_PREP', processName: 'Component Prep', machineKey: 'BCA_MONTHLY_STAFF', machineName: 'BCA Monthly Staff (1/5)' },
        { teamKey: 'CONSUMER', teamName: 'Consumer', processKey: 'BUILD', processName: 'Build (Building)', machineKey: 'CONSUMER_MONTHLY_STAFF', machineName: 'Consumer Monthly Staff (1/5)' },
        { teamKey: 'AERO', teamName: 'Aero (Aviation)', processKey: 'BIAS', processName: 'Bias Aero', machineKey: 'AERO_BIAS_MONTHLY_STAFF', machineName: 'Bias Aero Monthly Staff (1/5)' },
        { teamKey: 'AERO', teamName: 'Aero (Aviation)', processKey: 'RADIAL', processName: 'Radial Aero', machineKey: 'AERO_RADIAL_MONTHLY_STAFF', machineName: 'Radial Aero Monthly Staff (1/5)' },
        { teamKey: 'RETREAD', teamName: 'Retread Plant', processKey: 'RETREAD_OPS', processName: 'Retread Operations', machineKey: 'RETREAD_MONTHLY_STAFF', machineName: 'Retread Monthly Staff (1/5)' }
      ];

      // GY Monthly Staff (61 persons / 5 = 12.2 HC, 97.6 hours per area)
      if (categoryFilter !== 'WAS') {
        const gyHcPerArea = 61 * 0.2; // 12.2
        const gyHoursPerArea = 61 * hoursPerPerson * 0.2; // 97.6

        targetAreas.forEach((area, idx) => {
          allWorkers.push({
            empId: `M-GY-AREA-${idx + 1}`,
            name: `พนักงานรายเดือน GY (${area.teamName} 1/5)`,
            headcount: gyHcPerArea,
            employmentType: 'MONTHLY',
            employmentLabel: 'พนักงานรายเดือน GY',
            functionType: 'SHARE',
            functionLabel: 'Share',
            teamKey: area.teamKey,
            teamName: area.teamName,
            processKey: area.processKey,
            processName: area.processName,
            machineKey: area.machineKey,
            machineName: area.machineName,
            dept: 'Monthly Staff',
            costCenter: 'Monthly Staff',
            position: 'Salaried Staff',
            shift: 1,
            shiftLabel: 'กะเช้า / Day',
            normalHours: gyHoursPerArea,
            otHours: 0,
            totalHours: gyHoursPerArea
          });
        });
      }

      // WAS Monthly Staff (9 persons / 5 = 1.8 HC, 14.4 hours per area)
      if (!hasScannedWasMonthly && (monthlyMetrics.wasCount || 9) > 0) {
        const wasCount = monthlyMetrics.wasCount || 9;
        const wasHcPerArea = wasCount * 0.2; // 1.8
        const wasHoursPerArea = wasCount * hoursPerPerson * 0.2; // 14.4

        if (categoryFilter === 'ALL' || categoryFilter === 'WAS') {
          targetAreas.forEach((area, idx) => {
            allWorkers.push({
              empId: `M-WAS-AREA-${idx + 1}`,
              name: `พนักงานรายเดือน WAS (${area.teamName} 1/5)`,
              headcount: wasHcPerArea,
              employmentType: 'MONTHLY',
              employmentLabel: 'Contractor รายเดือน (WAS)',
              functionType: 'SHARE',
              functionLabel: 'Share',
              teamKey: area.teamKey,
              teamName: area.teamName,
              processKey: area.processKey,
              processName: area.processName,
              machineKey: `WAS_${area.machineKey}`,
              machineName: `WAS ${area.machineName}`,
              dept: 'Contractor WAS Monthly',
              costCenter: 'WAS Monthly',
              position: 'WAS Staff',
              shift: 1,
              shiftLabel: 'กะเช้า / Day',
              normalHours: wasHoursPerArea,
              otHours: 0,
              totalHours: wasHoursPerArea
            });
          });
        }
      }
    }
  }

  // Helper to build Node
  function buildNode(
    id: string,
    title: string,
    level: 'PLANT' | 'TEAM' | 'PROCESS' | 'MACHINE',
    workers: HierarchyWorker[],
    children: HierarchyNode[] = []
  ): HierarchyNode {
    const metrics = aggregateMetricSummary(workers);

    const fnProd = aggregateMetricSummary(workers.filter(w => w.functionType === 'PRODUCTION'));
    const fnQtech = aggregateMetricSummary(workers.filter(w => w.functionType === 'QTECH'));
    const fnEng = aggregateMetricSummary(workers.filter(w => w.functionType === 'ENG'));
    const fnShare = aggregateMetricSummary(workers.filter(w => w.functionType === 'SHARE'));

    const empMonthly = aggregateMetricSummary(workers.filter(w => w.employmentType === 'MONTHLY'));
    const empGy = aggregateMetricSummary(workers.filter(w => w.employmentType === 'GY_HOURLY'));
    const empCont = aggregateMetricSummary(workers.filter(w => w.employmentType === 'CONTRACTOR_HOURLY'));

    return {
      id,
      title,
      level,
      metrics,
      functions: {
        production: fnProd,
        qtech: fnQtech,
        eng: fnEng,
        share: fnShare
      },
      employment: {
        monthly: empMonthly,
        gyHourly: empGy,
        contractor: empCont
      },
      workers,
      children: children.length > 0 ? children : undefined
    };
  }

  // Build Hierarchy Structure:
  // Level 1: BCA, CONSUMER, AERO, RETREAD
  const teamKeys: Array<'BCA' | 'CONSUMER' | 'AERO' | 'RETREAD'> = ['BCA', 'CONSUMER', 'AERO', 'RETREAD'];
  const teamNodes: HierarchyNode[] = teamKeys.map(tKey => {
    const teamWorkers = allWorkers.filter(w => w.teamKey === tKey);
    const teamTitle = tKey === 'BCA' ? 'BCA' : (tKey === 'CONSUMER' ? 'CONSUMER' : (tKey === 'AERO' ? 'AERO' : 'Retread'));

    // Level 2: Processes under this team
    const processMap = new Map<string, HierarchyWorker[]>();
    teamWorkers.forEach(w => {
      if (!processMap.has(w.processKey)) processMap.set(w.processKey, []);
      processMap.get(w.processKey)!.push(w);
    });

    const processNodes: HierarchyNode[] = Array.from(processMap.entries()).map(([pKey, pWorkers]) => {
      const pTitle = pWorkers[0]?.processName || pKey;

      // Level 3: Machines under this process
      const machineMap = new Map<string, HierarchyWorker[]>();
      pWorkers.forEach(w => {
        if (!machineMap.has(w.machineKey)) machineMap.set(w.machineKey, []);
        machineMap.get(w.machineKey)!.push(w);
      });

      const machineNodes: HierarchyNode[] = Array.from(machineMap.entries()).map(([mKey, mWorkers]) => {
        const mTitle = mWorkers[0]?.machineName || mKey;
        return buildNode(`${tKey}_${pKey}_${mKey}`, mTitle, 'MACHINE', mWorkers);
      });

      // Sort machines by standard sequence matching factory specs
      const bcaMixOrder = ['320_BANBURY_1', '320_BANBURY_2', '320_PIGMENT', '430_6X8_TUBER', '430_QUAD'];
      const bcaPrepOrder = [
        '3ROLL_CEMENT_3300_3700',
        '411_4ROLL_1',
        '411_4ROLL_2',
        '411_CHAFER_LAY_UP',
        '411_LUX_SLITTER',
        '411_SHEAR_FISCER',
        '412_BAND_54',
        '413_BAND_72',
        '420_BEAD_FLAP',
        '420_BEAD_INSULATION',
        '420_BEAD_WRAP',
        '420_HEX_BEAD',
        '420_HOT_APEXER'
      ];
      const consumerBuildOrder = ['CONSUMER_BUILD_VMI', 'CONSUMER_BUILD_R25'];
      const consumerFFOrder = ['CONSUMER_FF_FINAL_FINISH', 'CONSUMER_FF_CURING'];
      const retreadOrder = ['RETREAD_BUFF', 'RETREAD_BUILD', 'RETREAD_CURE', 'RETREAD_FINISH'];

      machineNodes.sort((a, b) => {
        const keyA = a.id.replace(`${tKey}_${pKey}_`, '');
        const keyB = b.id.replace(`${tKey}_${pKey}_`, '');

        if (pKey === 'MIX_EXTRUSION') {
          const idxA = bcaMixOrder.indexOf(keyA);
          const idxB = bcaMixOrder.indexOf(keyB);
          if (idxA >= 0 && idxB >= 0) return idxA - idxB;
        } else if (pKey === 'COMPONENT_PREP') {
          const idxA = bcaPrepOrder.indexOf(keyA);
          const idxB = bcaPrepOrder.indexOf(keyB);
          if (idxA >= 0 && idxB >= 0) return idxA - idxB;
        } else if (pKey === 'BUILD') {
          const idxA = consumerBuildOrder.indexOf(keyA);
          const idxB = consumerBuildOrder.indexOf(keyB);
          if (idxA >= 0 && idxB >= 0) return idxA - idxB;
        } else if (pKey === 'FF_CURING') {
          const idxA = consumerFFOrder.indexOf(keyA);
          const idxB = consumerFFOrder.indexOf(keyB);
          if (idxA >= 0 && idxB >= 0) return idxA - idxB;
        } else if (tKey === 'RETREAD') {
          const idxA = retreadOrder.indexOf(keyA);
          const idxB = retreadOrder.indexOf(keyB);
          if (idxA >= 0 && idxB >= 0) return idxA - idxB;
        }
        return b.metrics.totalHours - a.metrics.totalHours;
      });

      return buildNode(`${tKey}_${pKey}`, pTitle, 'PROCESS', pWorkers, machineNodes);
    });

    // Sort processes in standard order
    processNodes.sort((a, b) => {
      const order = ['MIX_EXTRUSION', 'COMPONENT_PREP', 'BUILD', 'FF_CURING', 'BIAS', 'RADIAL', 'RETREAD_OPS'];
      const idxA = order.indexOf(a.id.split('_')[1] || '');
      const idxB = order.indexOf(b.id.split('_')[1] || '');
      return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
    });

    return buildNode(tKey, teamTitle, 'TEAM', teamWorkers, processNodes);
  });

  // Level 0: PLANT Root Node
  const root = buildNode('PLANT', 'Plant', 'PLANT', allWorkers, teamNodes);

  return { root, allWorkers };
}
