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
  const loc = classifyPlantLocation(dept, costCenter, position, machine);
  if (loc.teamKey === 'QTECH') return 'QTECH';
  if (loc.teamKey === 'ENG') return 'ENG';
  if (loc.teamKey === 'SUPPORT') return 'SHARE';
  return 'PRODUCTION';
}

export interface PlantClassification {
  teamKey: 'BCA' | 'CONSUMER' | 'AERO' | 'RETREAD' | 'ENG' | 'QTECH' | 'SUPPORT';
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

  // 1. SUPPORT DEPT (7th Branch: CC 1050, 1200, 1850, 1860)
  if (
    ['1050', '1200', '1850', '1860'].includes(cc) ||
    d.includes('1050') ||
    d.includes('1200') ||
    d.includes('1850') ||
    d.includes('1860') ||
    d.includes('WAREHOUSE') ||
    d.includes('RECEIVING') ||
    d.includes('WASTE') ||
    d.includes('PPIC') ||
    d.includes('KANBAN') ||
    d.includes('HR') ||
    d.includes('HUMAN RESOURCE') ||
    p.includes('WAREHOUSE') ||
    p.includes('RECEIVING') ||
    p.includes('WASTE') ||
    p.includes('PPIC') ||
    p.includes('KANBAN') ||
    p.includes('PAYROLL') ||
    p.includes('HR ')
  ) {
    let machKey = '1200';
    let machName = '1200 : Receiving & Warehouse';
    if (cc === '1050' || d.includes('1050') || combined.includes('1050') || d.includes('HR') || p.includes('PAYROLL') || p.includes('HUMAN RESOURCE')) {
      machKey = '1050';
      machName = '1050 : HR';
    } else if (cc === '1850' || combined.includes('1850') || combined.includes('WASTE')) {
      machKey = '1850';
      machName = '1850 : Waste Yard';
    } else if (cc === '1860' || combined.includes('1860') || combined.includes('PPIC') || combined.includes('KANBAN')) {
      machKey = '1860';
      machName = '1860 : PPIC & Kanban';
    }
    return {
      teamKey: 'SUPPORT',
      teamName: 'Support Dept',
      processKey: 'SUPPORT_OPS',
      processName: 'Support Operations',
      machineKey: machKey,
      machineName: machName
    };
  }

  // 2. ENGINEERING & MAINTENANCE (5th Branch: CC 1110, 1100, S1100, 1161, 1164, 1210)
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
    const machKey = cc || (isMaintenance ? '1110' : '1100');
    let machName = isMaintenance ? `${machKey} : Plant Maintenance` : `${machKey} : Plant Eng & Facilities`;
    if (cc === '1161' || combined.includes('DRUM')) {
      machName = '1161 : Drum Repair';
    } else if (cc === 'S1100') {
      machName = 'S1100 : Aviation Eng';
    }
    return {
      teamKey: 'ENG',
      teamName: 'Engineering',
      processKey: isMaintenance ? 'ENG_MAINT' : 'ENG_PLANT',
      processName: isMaintenance ? 'Maintenance & Repairs' : 'Plant Eng & Facilities',
      machineKey: machKey,
      machineName: machName
    };
  }

  // 3. QTECH (6th Branch: Qtech A, Qtech B, Aero, QA)
  if (
    ['1022', '1021', '1040', 'S1040'].includes(cc) ||
    d.includes('QTECH') ||
    d.includes('QUALITY') ||
    d.includes(' 1021') ||
    d.includes(' 1022') ||
    d.includes(' 1040') ||
    d.includes('S1040') ||
    p.includes('QTECH') ||
    p.includes('CERTIFYING') ||
    p.includes('SHEAROGRAPHY') ||
    p.includes('RESILIOMETER')
  ) {
    // 3.1 Qtech A: CC 1022 ทั้งหมด (แยกเป็น Die tech / Lab Technician)
    if (
      cc === '1022' ||
      d.includes('1022') ||
      combined.includes('1022') ||
      (d.includes('QUALITY') && (combined.includes('DIE') || combined.includes('LAB') || combined.includes('COMPOUND')))
    ) {
      const isDie = combined.includes('DIE');
      return {
        teamKey: 'QTECH',
        teamName: 'Qtech',
        processKey: 'QTECH_A',
        processName: 'Qtech A',
        machineKey: isDie ? '1022_DIE' : '1022_LAB',
        machineName: isDie ? '1022 : Die Tech' : '1022 : Lab Technician'
      };
    }

    // 3.2 Qtech B: CC 1021 ทั้งหมด (Build Monitor / Cure Monitor / NTI / อื่นๆ)
    if (
      cc === '1021' ||
      d.includes('1021') ||
      combined.includes('1021') ||
      (d.includes('QUALITY') && (combined.includes('BUILD') || combined.includes('CURE') || combined.includes('NTI') || combined.includes('MONITOR')))
    ) {
      let machKey = '1021_OTHER';
      let machName = '1021 : Monitor & Support';
      if (combined.includes('BUILD') || combined.includes('TIRE') || combined.includes('RADIAL TIRE') || combined.includes('CTA')) {
        machKey = '1021_BUILD';
        machName = '1021 : Build Monitor';
      } else if (combined.includes('CURE') || combined.includes('PRESS') || combined.includes('THERMO')) {
        machKey = '1021_CURE';
        machName = '1021 : Cure Monitor';
      } else if (combined.includes('NTI') || combined.includes('NPI')) {
        machKey = '1021_NTI';
        machName = '1021 : NTI';
      }
      return {
        teamKey: 'QTECH',
        teamName: 'Qtech',
        processKey: 'QTECH_B',
        processName: 'Qtech B',
        machineKey: machKey,
        machineName: machName
      };
    }

    // 3.3 Qtech Aero: CC S1040, 1040 (Aero Certifying Staff / SDS Shearography / Burst Test)
    if (
      cc === 'S1040' ||
      d.includes('S1040') ||
      combined.includes('S1040') ||
      combined.includes('AERO') ||
      combined.includes('SHEAROGRAPHY') ||
      combined.includes('SDS') ||
      combined.includes('BURST') ||
      combined.includes('RADIAL AV')
    ) {
      let machKey = 'S1040_CERT';
      let machName = 'S1040 : Aero Certifying Staff';
      if (combined.includes('BURST') || combined.includes('CUT TIRE')) {
        machKey = '1040_BURST';
        machName = '1040 : Burst Test';
      } else if (combined.includes('SHEAROGRAPHY') || combined.includes('SDS') || combined.includes('GEOMETRY')) {
        machKey = 'S1040_SDS';
        machName = 'S1040 : SDS Shearography';
      }
      return {
        teamKey: 'QTECH',
        teamName: 'Qtech',
        processKey: 'QTECH_AERO',
        processName: 'Qtech Aero',
        machineKey: machKey,
        machineName: machName
      };
    }

    // 3.4 QA: CC 1040 (QA Process Auditor / QA Inspector / PDI Inspector / Resiliometer (DOT) / X-Ray)
    let machKey = '1040_INSPECT';
    let machName = '1040 : QA Inspector';
    if (combined.includes('RESILIOMETER') || combined.includes('DOT')) {
      machKey = '1040_RESILIO';
      machName = '1040 : Resiliometer (DOT)';
    } else if (combined.includes('X-RAY') || combined.includes('XRAY')) {
      machKey = '1040_XRAY';
      machName = '1040 : X-Ray';
    } else if (combined.includes('PDI')) {
      machKey = '1040_PDI';
      machName = '1040 : PDI Inspector';
    } else if (combined.includes('AUDITOR') || combined.includes('AUDIT')) {
      machKey = '1040_AUDIT';
      machName = '1040 : QA Process Auditor';
    }
    return {
      teamKey: 'QTECH',
      teamName: 'Qtech',
      processKey: 'QTECH_QA',
      processName: 'QA',
      machineKey: machKey,
      machineName: machName
    };
  }

  // 4. RETREAD PLANT (CC 6320, 6300)
  if (cc === '6320' || cc === '6300' || d.startsWith('6') || combined.includes('RETREAD')) {
    return {
      teamKey: 'RETREAD',
      teamName: 'Retread Plant',
      processKey: 'RETREAD_OPS',
      processName: 'Retread Operations',
      machineKey: '6320',
      machineName: '6320 : Retread Operations'
    };
  }

  // 5. AERO (AVIATION TIRES)
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
          machineKey: 'S5120',
          machineName: 'S5120 : Radial Curing'
        };
      } else if (cc === 'S5130' || combined.includes('FINISH') || combined.includes('INSPECT')) {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'RADIAL',
          processName: 'Radial Aero',
          machineKey: 'S5130',
          machineName: 'S5130 : Radial Final Finish'
        };
      } else {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'RADIAL',
          processName: 'Radial Aero',
          machineKey: 'S5110',
          machineName: 'S5110 : Radial Building'
        };
      }
    } else {
      if (cc === 'A5120' || cc === '5230' || combined.includes('CURE')) {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'BIAS',
          processName: 'Bias Aero',
          machineKey: 'A5120',
          machineName: 'A5120 : Bias Curing'
        };
      } else if (cc === 'A5130' || combined.includes('FINISH') || combined.includes('INSPECT')) {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'BIAS',
          processName: 'Bias Aero',
          machineKey: 'A5130',
          machineName: 'A5130 : Bias Final Finish'
        };
      } else {
        return {
          teamKey: 'AERO',
          teamName: 'Aero (Aviation)',
          processKey: 'BIAS',
          processName: 'Bias Aero',
          machineKey: 'A5110',
          machineName: 'A5110 : Bias Building'
        };
      }
    }
  }

  // 6. CONSUMER (PASSENGER & LIGHT TRUCK)
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
        machineKey: '5120',
        machineName: '5120 : Curing'
      };
    } else if (cc === '5130' || combined.includes('FINISH') || combined.includes('INSPECT')) {
      return {
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: 'FF_CURING',
        processName: 'FF / Curing',
        machineKey: '5130',
        machineName: '5130 : Final Finish'
      };
    } else {
      return {
        teamKey: 'CONSUMER',
        teamName: 'Consumer',
        processKey: 'BUILD',
        processName: 'Build (Building)',
        machineKey: '5110',
        machineName: '5110 : Building'
      };
    }
  }

  // 7. BCA (BANBURY / CALENDER / PREP)
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
        machineKey: '3300',
        machineName: '3300 : Cement House'
      };
    } else if (cc === '3700') {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'MIX_EXTRUSION',
        processName: 'Mix & Extrusion',
        machineKey: '3700',
        machineName: '3700 : Mix Support'
      };
    } else if (cc === '4300' || combined.includes('QUAD') || combined.includes('TUBER') || combined.includes('6"X8"') || combined.includes('6X8')) {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'MIX_EXTRUSION',
        processName: 'Mix & Extrusion',
        machineKey: '4300',
        machineName: '4300 : Tuber & Extrusion'
      };
    } else {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'MIX_EXTRUSION',
        processName: 'Mix & Extrusion',
        machineKey: '3200',
        machineName: '3200 : Banbury & Mixing'
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
        machineKey: '4120',
        machineName: '4120 : Steel Calender'
      };
    } else if (cc === '4130' || combined.includes('BAND72') || combined.includes('BAND 72')) {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'COMPONENT_PREP',
        processName: 'Component Prep',
        machineKey: '4130',
        machineName: '4130 : Bead & Band 72"'
      };
    } else if (cc === '4140') {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'COMPONENT_PREP',
        processName: 'Component Prep',
        machineKey: '4140',
        machineName: '4140 : Bladder & Tube'
      };
    } else if (cc === '4200' || combined.includes('HEX BEAD') || combined.includes('APEX')) {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'COMPONENT_PREP',
        processName: 'Component Prep',
        machineKey: '4200',
        machineName: '4200 : Apex & Hex Bead'
      };
    } else {
      return {
        teamKey: 'BCA',
        teamName: 'BCA',
        processKey: 'COMPONENT_PREP',
        processName: 'Component Prep',
        machineKey: '4110',
        machineName: '4110 : Fabric Calender & Prep'
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

  // 2. Process Contractor Records (Both Hourly and Salary WAS) strictly by Department & Cost Center
  activeContRecords.forEach(r => {
    if (!r.hasScannedIn && r.totalHours <= 0) return;
    if (shiftFilter !== 'ALL' && r.shiftNumber !== shiftFilter) return;

    const dept = (r.department || '').trim();
    const cc = (r.closing || '').trim();
    const pos = (r.position || '').trim();
    const mach = (r.location || pos || 'General Contractor').trim();

    const isHourly1050 = cc === '1050' || dept.includes('1050');
    const isMonthly = !isHourly1050 && (r.type === 'Salary' || (r as any).isMonthly);
    const empType: EmploymentType = isMonthly ? 'MONTHLY' : 'CONTRACTOR_HOURLY';
    const empLabel = isMonthly ? 'Contractor รายเดือน (Salary WAS)' : 'Contractor รายชั่วโมง (WAS)';

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
  // Level 1: 7 Branches (BCA, CONSUMER, AERO, RETREAD, ENG, QTECH, SUPPORT)
  const teamKeys: Array<'BCA' | 'CONSUMER' | 'AERO' | 'RETREAD' | 'ENG' | 'QTECH' | 'SUPPORT'> = [
    'BCA',
    'CONSUMER',
    'AERO',
    'RETREAD',
    'ENG',
    'QTECH',
    'SUPPORT'
  ];
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
        : tKey === 'QTECH'
        ? 'Qtech'
        : 'Support Dept';

    // Level 2: Processes under this team
    const processMap = new Map<string, HierarchyWorker[]>();
    teamWorkers.forEach(w => {
      if (!processMap.has(w.processKey)) processMap.set(w.processKey, []);
      processMap.get(w.processKey)!.push(w);
    });

    // Ensure SUPPORT_OPS always exists under SUPPORT
    if (tKey === 'SUPPORT' && !processMap.has('SUPPORT_OPS')) {
      processMap.set('SUPPORT_OPS', []);
    }

    const processNodes: HierarchyNode[] = Array.from(processMap.entries()).map(([pKey, pWorkers]) => {
      const pTitle = pWorkers[0]?.processName || (pKey === 'SUPPORT_OPS' ? 'Support Operations' : pKey);

      // Level 3: Machines under this process
      const machineMap = new Map<string, HierarchyWorker[]>();
      pWorkers.forEach(w => {
        if (!machineMap.has(w.machineKey)) machineMap.set(w.machineKey, []);
        machineMap.get(w.machineKey)!.push(w);
      });

      // Ensure all standard Support Ops stations are always present
      if (pKey === 'SUPPORT_OPS') {
        const supportStationDefaults: Record<string, string> = {
          '1050': '1050 : HR',
          '1200': '1200 : Receiving & Warehouse',
          '1850': '1850 : Waste Yard',
          '1860': '1860 : PPIC & Kanban'
        };
        for (const sKey of Object.keys(supportStationDefaults)) {
          if (!machineMap.has(sKey)) machineMap.set(sKey, []);
        }
      }

      const machineNodes: HierarchyNode[] = Array.from(machineMap.entries()).map(([mKey, mWorkers]) => {
        const defaultTitleMap: Record<string, string> = {
          '1050': '1050 : HR',
          '1200': '1200 : Receiving & Warehouse',
          '1850': '1850 : Waste Yard',
          '1860': '1860 : PPIC & Kanban'
        };
        const mTitle = mWorkers[0]?.machineName || defaultTitleMap[mKey] || mKey;
        return buildNode(`${tKey}_${pKey}_${mKey}`, mTitle, 'MACHINE', mWorkers);
      });

      // Sort machines strictly by standard Cost Center sequence
      const costCenterOrder = [
        // BCA Mix & Extrusion
        '3200',
        '3300',
        '3700',
        '4300',
        // BCA Component Prep
        '4110',
        '4120',
        '4130',
        '4140',
        '4200',
        // Consumer
        '5110',
        '5120',
        '5130',
        // Bias Aero
        'A5110',
        'A5120',
        'A5130',
        // Radial Aero
        'S5110',
        'S5120',
        'S5130',
        // Retread
        '6320',
        // Engineering
        '1110',
        '1100',
        'S1100',
        '1161',
        '1164',
        '1210',
        // Qtech A (CC 1022)
        '1022_DIE',
        '1022_LAB',
        '1022',
        // Qtech B (CC 1021)
        '1021_BUILD',
        '1021_CURE',
        '1021_NTI',
        '1021_OTHER',
        '1021',
        // Qtech Aero (CC S1040, 1040)
        'S1040_CERT',
        'S1040_SDS',
        '1040_BURST',
        'S1040',
        // QA (CC 1040)
        '1040_AUDIT',
        '1040_INSPECT',
        '1040_PDI',
        '1040_RESILIO',
        '1040_XRAY',
        '1040',
        // Support Dept (CC 1050, 1200, 1850, 1860)
        '1050',
        '1200',
        '1850',
        '1860'
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
        'QTECH_QA',
        'SUPPORT_OPS'
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
