import { ParsedShiftRecord, EmployeeInfo, DailyAdjustmentRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { getMonthShiftCycleInfo, getPreviousMonthShift3Records } from './ohpaCalculator';

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

  // 3. Default: Direct Manufacturing Production (Operators, Leaders, Line Workers, Material Handling)
  return 'PRODUCTION';
}

export interface PlantClassification {
  teamKey: 'BCA' | 'CONSUMER' | 'AERO' | 'RETREAD' | 'ENG' | 'QTECH';
  teamName: string;
  processKey: string;
  processName: string;
  machineKey: string;
  machineName: string;
}

export function extractCleanCostCenter(costCenter?: string, dept?: string): string {
  let cc = (costCenter || '').trim().toUpperCase();
  if (!cc && dept) {
    const match = dept.trim().toUpperCase().match(/^[A-Z]?\d+/);
    if (match) cc = match[0];
  }
  return cc;
}

export function classifyPlantLocation(dept: string, costCenter: string, position: string, machine: string): PlantClassification {
  const cc = extractCleanCostCenter(costCenter, dept);
  const d = (dept || '').toUpperCase();
  const p = (position || '').toUpperCase();
  const m = (machine || '').toUpperCase();
  const combined = `${d} ${cc} ${p} ${m}`;

  // 1. ENGINEERING & MAINTENANCE (5th Branch: CC 1110, 1100, S1100, 1161, 1164, 1210)
  if (
    ['1110', '1100', 'S1100', '1161', '1164', '1210'].includes(cc) ||
    d.includes('ENGINEERING') ||
    d.includes(' 1110') ||
    d.includes(' 1100') ||
    p.includes('MECHANIC') ||
    p.includes('ELECTRIC') ||
    p.includes('DRUM REPAIR')
  ) {
    const isMaintenance = cc === '1110' || p.includes('MECHANIC') || p.includes('ELECTRIC') || p.includes('DRUM') || p.includes('MAINT');
    return {
      teamKey: 'ENG',
      teamName: 'Engineering',
      processKey: isMaintenance ? 'ENG_MAINT' : 'ENG_PLANT',
      processName: isMaintenance ? 'Maintenance & Repairs' : 'Plant Eng & Facilities',
      machineKey: `CC_${cc || (isMaintenance ? '1110' : '1100')}`,
      machineName: isMaintenance ? `CC ${cc || '1110'} : Plant Maintenance` : `CC ${cc || '1100'} : Engineering & Reliability`
    };
  }

  // 2. QTECH (6th Branch: Qtech A, Qtech B, Aero, QA - CC 1021, 1022, S1040, 1040)
  if (
    ['1021', '1022', '1040', 'S1040'].includes(cc) ||
    d.includes('QTECH') ||
    d.includes('QUALITY') ||
    d.includes(' 1021') ||
    d.includes(' 1022') ||
    d.includes(' 1040') ||
    d.includes('S1040') ||
    p.includes('QTECH') ||
    p.includes('INSPECTOR') ||
    p.includes('AUDITOR') ||
    p.includes('CERTIFYING') ||
    p.includes('SHEAROGRAPHY') ||
    p.includes('RESILIOMETER')
  ) {
    if (cc === '1021' || combined.includes('1021') || combined.includes('QTECH A') || combined.includes('LAB A')) {
      return {
        teamKey: 'QTECH',
        teamName: 'Qtech',
        processKey: 'QTECH_A',
        processName: 'Qtech A',
        machineKey: 'CC_1021',
        machineName: 'CC 1021 : Qtech A'
      };
    } else if (cc === '1022' || combined.includes('1022') || combined.includes('QTECH B') || combined.includes('LAB B') || combined.includes('DIE TECH')) {
      return {
        teamKey: 'QTECH',
        teamName: 'Qtech',
        processKey: 'QTECH_B',
        processName: 'Qtech B',
        machineKey: 'CC_1022',
        machineName: 'CC 1022 : Qtech B'
      };
    } else if (
      cc === 'S1040' ||
      combined.includes('S1040') ||
      combined.includes('AERO') ||
      combined.includes('AV') ||
      combined.includes('SHEAROGRAPHY') ||
      combined.includes('SDS') ||
      combined.includes('RESILIOMETER') ||
      combined.includes('X-RAY') ||
      combined.includes('BURST') ||
      combined.includes('CERTIFYING')
    ) {
      return {
        teamKey: 'QTECH',
        teamName: 'Qtech',
        processKey: 'QTECH_AERO',
        processName: 'Qtech Aero',
        machineKey: cc === 'S1040' ? 'CC_S1040' : (cc ? `CC_${cc}` : 'CC_S1040'),
        machineName: `CC ${cc || 'S1040'} : Qtech Aero`
      };
    } else {
      // Default / CC 1040 / QA / PDI / Process Auditor
      return {
        teamKey: 'QTECH',
        teamName: 'Qtech',
        processKey: 'QTECH_QA',
        processName: 'QA',
        machineKey: 'CC_1040',
        machineName: 'CC 1040 : QA'
      };
    }
  }

  // 3. RETREAD PLANT (CC 6320, 6300)
  if (cc === '6320' || cc === '6300' || d.startsWith('6') || combined.includes('RETREAD')) {
    return {
      teamKey: 'RETREAD',
      teamName: 'Retread Plant',
      processKey: 'RETREAD_OPS',
      processName: 'Retread Operations',
      machineKey: 'CC_6320',
      machineName: 'CC 6320 : Retread Operations'
    };
  }

  // 4. AERO (AVIATION TIRES)
  // Bias Aero: A5110, A5120, A5130 (or 5210, 5230)
  // Radial Aero: S5110, S5120, S5130 (or 5310, 5330)
  if (
    cc.startsWith('A5') ||
    cc.startsWith('S5') ||
    ['5210', '5230', '5310', '5330'].includes(cc) ||
    d.startsWith('A5') ||
    d.startsWith('S5') ||
    combined.includes('AERO') ||
    combined.includes('AVIATION')
  ) {
    const isRadial = cc.startsWith('S5') || cc === '5310' || cc === '5330' || d.startsWith('S5') || combined.includes('RADIAL');
    const subProcessKey = isRadial ? 'RADIAL' : 'BIAS';
    const subProcessName = isRadial ? 'Radial Aero' : 'Bias Aero';

    if (isRadial) {
      if (cc === 'S5120' || cc === '5330' || combined.includes('CURE')) {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'RADIAL',
          processName: 'Radial Aero',
          machineKey: 'CC_S5120',
          machineName: 'CC S5120 : Radial Curing'
        };
      } else if (cc === 'S5130' || combined.includes('FINISH') || combined.includes('INSPECT')) {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'RADIAL',
          processName: 'Radial Aero',
          machineKey: 'CC_S5130',
          machineName: 'CC S5130 : Radial Final Finish'
        };
      } else {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'RADIAL',
          processName: 'Radial Aero',
          machineKey: 'CC_S5110',
          machineName: 'CC S5110 : Radial Building'
        };
      }
    } else {
      if (cc === 'A5120' || cc === '5230' || combined.includes('CURE')) {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'BIAS',
          processName: 'Bias Aero',
          machineKey: 'CC_A5120',
          machineName: 'CC A5120 : Bias Curing'
        };
      } else if (cc === 'A5130' || combined.includes('FINISH') || combined.includes('INSPECT')) {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'BIAS',
          processName: 'Bias Aero',
          machineKey: 'CC_A5130',
          machineName: 'CC A5130 : Bias Final Finish'
        };
      } else {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'BIAS',
          processName: 'Bias Aero',
          machineKey: 'CC_A5110',
          machineName: 'CC A5110 : Bias Building'
        };
      }
    }
  }

  // 4. CONSUMER (PASSENGER & LIGHT TRUCK)
  // Build: 5110
  // FF / Curing: 5120, 5130
  if (
    ['5110', '5120', '5130'].includes(cc) ||
    d.startsWith('5110') ||
    d.startsWith('5120') ||
    d.startsWith('5130') ||
    combined.includes('CONSUMER')
  ) {
    if (cc === '5120' || combined.includes('CURE')) {
      return {
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: 'FF_CURING',
        processName: 'FF / Curing',
        machineKey: 'CC_5120',
        machineName: 'CC 5120 : Curing'
      };
    } else if (cc === '5130' || combined.includes('FINISH') || combined.includes('INSPECT')) {
      return {
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: 'FF_CURING',
        processName: 'FF / Curing',
        machineKey: 'CC_5130',
        machineName: 'CC 5130 : Final Finish'
      };
    } else {
      return {
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: 'BUILD',
        processName: 'Build (Building)',
        machineKey: 'CC_5110',
        machineName: 'CC 5110 : Building'
      };
    }
  }

  // 5. BCA (BANBURY / CALENDER / PREP)
  // Mix & Extrusion: 3200, 3300, 3700, 4300
  // Component Prep: 4110, 4120, 4130, 4140, 4200
  const isMix =
    ['3200', '3300', '3700', '4300'].includes(cc) ||
    cc.startsWith('3') ||
    d.startsWith('3') ||
    combined.includes('BANBURY') ||
    combined.includes('MIXER') ||
    combined.includes('PIGMENT') ||
    combined.includes('TUBER') ||
    combined.includes('QUAD');

  if (isMix) {
    if (cc === '3300' || combined.includes('CEMENT')) {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'MIX_EXTRUSION',
        processName: 'Mix & Extrusion',
        machineKey: 'CC_3300',
        machineName: 'CC 3300 : Cement House'
      };
    } else if (cc === '3700') {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'MIX_EXTRUSION',
        processName: 'Mix & Extrusion',
        machineKey: 'CC_3700',
        machineName: 'CC 3700 : Mix Support'
      };
    } else if (cc === '4300' || combined.includes('QUAD') || combined.includes('TUBER') || combined.includes('6"X8"') || combined.includes('6X8')) {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'MIX_EXTRUSION',
        processName: 'Mix & Extrusion',
        machineKey: 'CC_4300',
        machineName: 'CC 4300 : Tuber & Extrusion'
      };
    } else {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'MIX_EXTRUSION',
        processName: 'Mix & Extrusion',
        machineKey: 'CC_3200',
        machineName: 'CC 3200 : Banbury & Mixing'
      };
    }
  } else {
    // Component Prep: 4110, 4120, 4130, 4140, 4200
    if (cc === '4120' || combined.includes('BAND54') || combined.includes('BAND 54')) {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'COMPONENT_PREP',
        processName: 'Component Prep',
        machineKey: 'CC_4120',
        machineName: 'CC 4120 : Steel Calender'
      };
    } else if (cc === '4130' || combined.includes('BAND72') || combined.includes('BAND 72')) {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'COMPONENT_PREP',
        processName: 'Component Prep',
        machineKey: 'CC_4130',
        machineName: 'CC 4130 : Bead & Band 72"'
      };
    } else if (cc === '4140') {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'COMPONENT_PREP',
        processName: 'Component Prep',
        machineKey: 'CC_4140',
        machineName: 'CC 4140 : Bladder & Tube'
      };
    } else if (cc === '4200' || combined.includes('HEX BEAD') || combined.includes('APEX')) {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'COMPONENT_PREP',
        processName: 'Component Prep',
        machineKey: 'CC_4200',
        machineName: 'CC 4200 : Apex & Hex Bead'
      };
    } else {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'COMPONENT_PREP',
        processName: 'Component Prep',
        machineKey: 'CC_4110',
        machineName: 'CC 4110 : Fabric Calender & Prep'
      };
    }
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

  // 1. Process GY Hourly Records strictly by Department & Cost Center
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
    const baseName = r.nameTH || r.nameEN || empInfo?.nameTH || empInfo?.nameEN || `พนักงาน ${r.empId}`;

    allWorkers.push({
      empId: r.empId,
      name: baseName,
      headcount: 1,
      employmentType: 'GY_HOURLY',
      employmentLabel: 'พนักงาน GY (รายกะ)',
      functionType: fnType,
      functionLabel: fnLabel,
      teamKey: loc.teamKey,
      teamName: loc.teamName,
      processKey: loc.processKey,
      processName: loc.processName,
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
  });

  // 2. Process Contractor Hourly Records strictly by Department & Cost Center
  activeContRecords.forEach(r => {
    if (!r.hasScannedIn && r.totalHours <= 0) return;
    if (shiftFilter !== 'ALL' && r.shiftNumber !== shiftFilter) return;

    // Cut monthly / salaried contractor out completely per user request
    const isMonthly = r.type === 'Salary' || (r as any).isMonthly;
    if (isMonthly) return;

    const empType: EmploymentType = 'CONTRACTOR_HOURLY';
    const empLabel = 'Contractor รายชั่วโมง (WAS)';

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
    const normH = r.normalHours || 0;
    const otH = r.otHours || 0;
    const totH = normH + otH;
    const baseName = r.nameTh || r.nameEn || r.empCode || 'Contractor Worker';

    allWorkers.push({
      empId: empCode || 'CONT',
      name: baseName,
      headcount: 1,
      employmentType: empType,
      employmentLabel: empLabel,
      functionType: fnType,
      functionLabel: fnLabel,
      teamKey: loc.teamKey,
      teamName: loc.teamName,
      processKey: loc.processKey,
      processName: loc.processName,
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
  });

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
  // Level 1: 6 Branches (BCA, CONSUMER, AERO, RETREAD, ENG, QTECH)
  const teamKeys: Array<'BCA' | 'CONSUMER' | 'AERO' | 'RETREAD' | 'ENG' | 'QTECH'> = ['BCA', 'CONSUMER', 'AERO', 'RETREAD', 'ENG', 'QTECH'];
  const teamNodes: HierarchyNode[] = teamKeys.map(tKey => {
    const teamWorkers = allWorkers.filter(w => w.teamKey === tKey);
    const teamTitle =
      tKey === 'BCA'
        ? 'BCA'
        : tKey === 'CONSUMER'
        ? 'CONSUMER'
        : tKey === 'AERO'
        ? 'AERO'
        : tKey === 'RETREAD'
        ? 'Retread'
        : tKey === 'ENG'
        ? 'Engineering'
        : 'Qtech';

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

      // Sort machines strictly by standard Cost Center sequence
      const costCenterOrder = [
        // BCA Mix & Extrusion
        'CC_3200',
        'CC_3300',
        'CC_3700',
        'CC_4300',
        // BCA Component Prep
        'CC_4110',
        'CC_4120',
        'CC_4130',
        'CC_4140',
        'CC_4200',
        // Consumer
        'CC_5110',
        'CC_5120',
        'CC_5130',
        // Bias Aero
        'CC_A5110',
        'CC_A5120',
        'CC_A5130',
        // Radial Aero
        'CC_S5110',
        'CC_S5120',
        'CC_S5130',
        // Retread
        'CC_6320',
        // Engineering
        'CC_1110',
        'CC_1100',
        'CC_S1100',
        'CC_1161',
        'CC_1164',
        'CC_1210',
        // Qtech
        'CC_1021',
        'CC_1022',
        'CC_S1040',
        'CC_1040'
      ];

      machineNodes.sort((a, b) => {
        const keyA = a.id.replace(`${tKey}_${pKey}_`, '');
        const keyB = b.id.replace(`${tKey}_${pKey}_`, '');

        const idxA = costCenterOrder.indexOf(keyA);
        const idxB = costCenterOrder.indexOf(keyB);
        if (idxA >= 0 && idxB >= 0) return idxA - idxB;
        if (idxA >= 0) return -1;
        if (idxB >= 0) return 1;

        return b.metrics.totalHours - a.metrics.totalHours;
      });

      return buildNode(`${tKey}_${pKey}`, pTitle, 'PROCESS', pWorkers, machineNodes);
    });

    // Sort processes in standard order
    processNodes.sort((a, b) => {
      const order = [
        'MIX_EXTRUSION',
        'COMPONENT_PREP',
        'BUILD',
        'FF_CURING',
        'BIAS',
        'RADIAL',
        'RETREAD_OPS',
        'ENG_MAINT',
        'ENG_PLANT',
        'QTECH_A',
        'QTECH_B',
        'QTECH_AERO',
        'QTECH_QA'
      ];
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
