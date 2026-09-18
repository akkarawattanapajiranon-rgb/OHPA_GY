import { ParsedShiftRecord, EmployeeInfo, DailyAdjustmentRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { StockingTonnageReport, OhpaSummary, OhpaShiftMetrics, OhpaDeptMetrics, OhpaAreaMetrics, OhpaAreaDeptItem, MonthlyStaffMetrics, MtdOhpaSummary, DailyMtdItem } from '../types/ohpa';
import { PdiBeadReport, DEFAULT_PDI_BEAD_REPORT } from '../data/default_pdi_bead';
import { processScanRecords } from './parser';

export function isGyDept6320(r: ParsedShiftRecord): boolean {
  const cc = (r.costCenter || '').trim();
  const d = (r.dept || '').trim();
  return cc === '6320' || d.startsWith('6320') || d.includes('6320');
}

export function isContDept6320(r: ContractorScanRecord): boolean {
  const closing = (r.closing || '').trim();
  const loc = (r.location || '').trim().toLowerCase();
  const dept = (r.department || '').trim();
  return closing === '6320' || loc === 'retread' || dept.includes('6320');
}

export function getMonthlyStaffMetrics(dateStr: string): MonthlyStaffMetrics {
  const clean = (dateStr || '').replace(/^[📅📄\s]*วันที่\s*/, '').trim();
  const parts = clean.split(/[/.-]/);
  let d = 14, m = 9, y = 2026;
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      d = parseInt(parts[0], 10) || 14;
      m = parseInt(parts[1], 10) || 9;
      y = parseInt(parts[2], 10) || 2026;
    } else if (parts[0].length === 4) {
      y = parseInt(parts[0], 10) || 2026;
      m = parseInt(parts[1], 10) || 9;
      d = parseInt(parts[2], 10) || 14;
    }
  }
  const dt = new Date(y, m - 1, d);
  const dayOfWeek = dt.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

  let hoursPerPerson = 0;
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    // วันจันทร์ - ศุกร์: คิด 8 ชม.
    hoursPerPerson = 8;
  } else if (dayOfWeek === 6) {
    // วันเสาร์: คิด 4 ชม.
    hoursPerPerson = 4;
  } else {
    // วันอาทิตย์: วันหยุด (0 ชม.)
    hoursPerPerson = 0;
  }

  const count = 62;
  const totalHours = count * hoursPerPerson;

  const wasCount = 9;
  const wasTotalHours = wasCount * hoursPerPerson;

  return {
    count,
    hoursPerPerson,
    totalHours,
    dayName: dayNames[dayOfWeek],
    wasCount,
    wasTotalHours,
    combinedCount: count + wasCount,
    combinedTotalHours: totalHours + wasTotalHours
  };
}

export const AREA_5_KEYS = ['BCA', 'Consumer', 'Bias Aero', 'Radial Aero', 'Retread'] as const;
export type Area5Key = typeof AREA_5_KEYS[number];

export const AREA_5_METADATA: Record<Area5Key, {
  name: string;
  label: string;
  icon: string;
  order: number;
  headcountStandard: number;
  isExcluded6320?: boolean;
}> = {
  'BCA': {
    name: 'BCA (Banbury, Calender, Stock Prep & Components)',
    label: 'BCA',
    icon: '🏢',
    order: 1,
    headcountStandard: 287,
  },
  'Consumer': {
    name: 'Consumer (Building & Curing)',
    label: 'Consumer',
    icon: '🚗',
    order: 2,
    headcountStandard: 232,
  },
  'Bias Aero': {
    name: 'Bias Aero (Aviation Bias Tire)',
    label: 'Bias Aero',
    icon: '✈️',
    order: 3,
    headcountStandard: 172,
  },
  'Radial Aero': {
    name: 'Radial Aero (Aviation Radial Tire)',
    label: 'Radial Aero',
    icon: '🛫',
    order: 4,
    headcountStandard: 104,
  },
  'Retread': {
    name: 'Retread (แผนก 6320 และส่วนงานหล่อดอกยาง)',
    label: 'Retread (หล่อดอก)',
    icon: '🔄',
    order: 5,
    headcountStandard: 108,
    isExcluded6320: true,
  },
};

export const classifyArea = (
  category?: string,
  dept?: string,
  costCenter?: string,
  pbu?: string,
  location?: string,
  closing?: string,
  mu?: string
): { key: Area5Key; name: string; label: string; icon: string; order: number; headcountStandard: number; isExcluded6320?: boolean } => {
  const muClean = (mu || '').trim();
  if (muClean && AREA_5_METADATA[muClean as Area5Key]) {
    const meta = AREA_5_METADATA[muClean as Area5Key];
    return {
      key: muClean as Area5Key,
      ...meta
    };
  }

  const d = String(dept || '').toUpperCase().trim();
  const cc = String(costCenter || '').toUpperCase().trim();
  const cls = String(closing || '').toUpperCase().trim();
  const c = String(category || '').toLowerCase().trim();
  const loc = String(location || '').toUpperCase().trim();

  // Extract 4-5 character code from closing, costCenter, dept in priority order
  const extractCode = (str: string): string => {
    const m = str.match(/([A-Z]?\d{4})/i);
    return m ? m[1].toUpperCase() : '';
  };

  const code = extractCode(cls) || extractCode(cc) || extractCode(d);

  // 1. Retread (แผนก 6320)
  if (
    code === '6320' ||
    c.includes('retread') ||
    loc.includes('RETREAD') ||
    d.includes('หล่อดอก')
  ) {
    return {
      key: 'Retread',
      ...AREA_5_METADATA['Retread']
    };
  }

  // 2. Bias Aero: แผนก A5110, A5120, A5130
  if (
    ['A5110', 'A5120', 'A5130'].includes(code) ||
    c.includes('bias aero') ||
    (c.includes('aero') && !c.includes('radial') && !loc.includes('STA'))
  ) {
    return {
      key: 'Bias Aero',
      ...AREA_5_METADATA['Bias Aero']
    };
  }

  // 3. Radial Aero: แผนก S5110, S5120, S5130
  if (
    ['S5110', 'S5120', 'S5130'].includes(code) ||
    c.includes('radial aero') ||
    (c.includes('radial') && c.includes('aero')) ||
    loc.includes('STA')
  ) {
    return {
      key: 'Radial Aero',
      ...AREA_5_METADATA['Radial Aero']
    };
  }

  // 4. Consumer: แผนก 4140, 5110, 5120, 5130
  if (
    ['4140', '5110', '5120', '5130'].includes(code) ||
    c.includes('consumer')
  ) {
    return {
      key: 'Consumer',
      ...AREA_5_METADATA['Consumer']
    };
  }

  // 5. BCA: แผนก 3200, 3300, 3700, 4110, 4120, 4130, 4200, 4300
  return {
    key: 'BCA',
    ...AREA_5_METADATA['BCA']
  };
};

export interface AreaAccumulator {
  areaKey: string;
  areaName: string;
  areaLabel: string;
  icon: string;
  order: number;
  headcountStandard: number;
  isExcluded6320?: boolean;
  gyHc: number;
  contHc: number;
  monthlyHc: number;
  gyNormal: number;
  gyOt: number;
  contNormal: number;
  contOt: number;
  monthlyNormal: number;
  nonHptAllocatedHours: number;
  nonHptAllocatedHC: number;
  consumerBiasAllocatedHours: number;
  consumerBiasAllocatedHC: number;
  beadAddHours: number;
  pdiDeductHours: number;
  bcaReductionHours: number;
  bcaDevHours: number;
  retreadReceivedHours: number;
  finalOpahHours: number;
  deptMap: Record<string, OhpaAreaDeptItem>;
}

export function createEmptyAreaMap(): Record<string, AreaAccumulator> {
  const map: Record<string, AreaAccumulator> = {};
  AREA_5_KEYS.forEach(k => {
    const meta = AREA_5_METADATA[k];
    map[k] = {
      areaKey: k,
      areaName: meta.name,
      areaLabel: meta.label,
      icon: meta.icon,
      order: meta.order,
      headcountStandard: meta.headcountStandard,
      isExcluded6320: meta.isExcluded6320,
      gyHc: 0,
      contHc: 0,
      monthlyHc: 0,
      gyNormal: 0,
      gyOt: 0,
      contNormal: 0,
      contOt: 0,
      monthlyNormal: 0,
      nonHptAllocatedHours: 0,
      nonHptAllocatedHC: 0,
      consumerBiasAllocatedHours: 0,
      consumerBiasAllocatedHC: 0,
      beadAddHours: 0,
      pdiDeductHours: 0,
      bcaReductionHours: 0,
      bcaDevHours: 0,
      retreadReceivedHours: 0,
      finalOpahHours: 0,
      deptMap: {}
    };
  });
  return map;
}

export function accumulateRecordsIntoAreaMap(
  areaMap: Record<string, AreaAccumulator>,
  gyRecords: ParsedShiftRecord[],
  contRecords: ContractorScanRecord[],
  monthlyStaff: { count: number; hoursPerPerson: number; totalHours: number; wasCount?: number; wasTotalHours?: number },
  beadAddHours: number = 0,
  pdiDeductMap: Record<string, number> = {},
  employeeMapping: Record<string, EmployeeInfo> = {},
  bcaReductionHours: number = 0,
  bcaDevHours: number = 0
): void {
  // Helper to get MU
  const getEmpMu = (empId: string, fallbackMu?: string, category?: string, dept?: string, costCenter?: string): string => {
    const emp = employeeMapping[empId] || employeeMapping[empId.replace(/^0+/, '')] || employeeMapping[empId.padStart(5, '0')];
    if (emp?.mu) return emp.mu.trim();
    if (fallbackMu) return fallbackMu.trim();
    return 'Non-HPT';
  };

  // 1. Process Goodyear scanned records
  gyRecords.forEach(r => {
    const d = r.dept || 'ไม่ระบุแผนก (GY)';
    const nHours = r.normalWorkHours || 0;
    const otH = r.otHours || 0;
    const totH = nHours + otH;
    const mu = getEmpMu(r.empId, r.mu, r.category, r.dept, r.costCenter);

    if (AREA_5_KEYS.includes(mu as Area5Key)) {
      const a = areaMap[mu];
      a.gyHc += 1;
      a.gyNormal += nHours;
      a.gyOt += otH;

      const deptKey = `GY: ${d}`;
      if (!a.deptMap[deptKey]) {
        a.deptMap[deptKey] = {
          dept: d,
          isContractor: false,
          isMonthly: false,
          headcount: 0,
          normalHours: 0,
          otHours: 0,
          totalHours: 0
        };
      }
      a.deptMap[deptKey].headcount += 1;
      a.deptMap[deptKey].normalHours += nHours;
      a.deptMap[deptKey].otHours += otH;
      a.deptMap[deptKey].totalHours += totH;
    } else if (mu === 'Consumer/Bias Aero') {
      ['Consumer', 'Bias Aero'].forEach(k => {
        const a = areaMap[k];
        a.consumerBiasAllocatedHC += 0.5;
        a.consumerBiasAllocatedHours += totH * 0.5;
        a.gyHc += 0.5;
        a.gyNormal += nHours * 0.5;
        a.gyOt += otH * 0.5;

        const deptKey = `Shared Con/Bias (GY): ${d}`;
        if (!a.deptMap[deptKey]) {
          a.deptMap[deptKey] = {
            dept: `${d} (แบ่ง 50% Con/Bias)`,
            isContractor: false,
            isMonthly: false,
            headcount: 0,
            normalHours: 0,
            otHours: 0,
            totalHours: 0
          };
        }
        a.deptMap[deptKey].headcount += 0.5;
        a.deptMap[deptKey].normalHours += nHours * 0.5;
        a.deptMap[deptKey].otHours += otH * 0.5;
        a.deptMap[deptKey].totalHours += totH * 0.5;
      });
    } else {
      // Non-HPT: Split into 5 Areas equally (20% each)
      AREA_5_KEYS.forEach(k => {
        const a = areaMap[k];
        a.nonHptAllocatedHC += 0.2;
        a.nonHptAllocatedHours += totH * 0.2;
        a.gyHc += 0.2;
        a.gyNormal += nHours * 0.2;
        a.gyOt += otH * 0.2;

        const deptKey = `Non-HPT (GY): ${d}`;
        if (!a.deptMap[deptKey]) {
          a.deptMap[deptKey] = {
            dept: `${d} (จัดสรร Non-HPT 1/5)`,
            isContractor: false,
            isMonthly: false,
            headcount: 0,
            normalHours: 0,
            otHours: 0,
            totalHours: 0
          };
        }
        a.deptMap[deptKey].headcount += 0.2;
        a.deptMap[deptKey].normalHours += nHours * 0.2;
        a.deptMap[deptKey].otHours += otH * 0.2;
        a.deptMap[deptKey].totalHours += totH * 0.2;
      });
    }
  });

  // 2. Process Contractor scanned records
  let hasScannedWasMonthly = false;
  contRecords.forEach(r => {
    const isMonthlyCont = r.type === 'Salary' || (r as any).isMonthly;
    if (isMonthlyCont) hasScannedWasMonthly = true;
    const code = (r.closing || r.department || 'MFG').trim();
    const loc = r.location ? ` (${r.location})` : '';
    const d = isMonthlyCont ? `Cont รายเดือน แผนก ${code}${loc}` : `Cont แผนก ${code}${loc}`;
    const nHours = r.normalHours || 0;
    const otH = r.otHours || 0;
    const totH = nHours + otH;
    const empCode = r.empCode || (r as any).workerId || '';
    const mu = getEmpMu(empCode, '', '', r.department, r.closing);

    if (AREA_5_KEYS.includes(mu as Area5Key)) {
      const a = areaMap[mu];
      a.contHc += 1;
      a.contNormal += nHours;
      a.contOt += otH;

      const deptKey = isMonthlyCont ? `Cont Monthly: ${code}${loc}` : `Cont: ${code}${loc}`;
      if (!a.deptMap[deptKey]) {
        a.deptMap[deptKey] = {
          dept: d,
          isContractor: true,
          isMonthly: isMonthlyCont,
          headcount: 0,
          normalHours: 0,
          otHours: 0,
          totalHours: 0
        };
      }
      a.deptMap[deptKey].headcount += 1;
      a.deptMap[deptKey].normalHours += nHours;
      a.deptMap[deptKey].otHours += otH;
      a.deptMap[deptKey].totalHours += totH;
    } else if (mu === 'Consumer/Bias Aero') {
      ['Consumer', 'Bias Aero'].forEach(k => {
        const a = areaMap[k];
        a.consumerBiasAllocatedHC += 0.5;
        a.consumerBiasAllocatedHours += totH * 0.5;
        a.contHc += 0.5;
        a.contNormal += nHours * 0.5;
        a.contOt += otH * 0.5;

        const deptKey = `Shared Con/Bias (Cont): ${code}${loc}`;
        if (!a.deptMap[deptKey]) {
          a.deptMap[deptKey] = {
            dept: `${d} (แบ่ง 50% Con/Bias)`,
            isContractor: true,
            isMonthly: isMonthlyCont,
            headcount: 0,
            normalHours: 0,
            otHours: 0,
            totalHours: 0
          };
        }
        a.deptMap[deptKey].headcount += 0.5;
        a.deptMap[deptKey].normalHours += nHours * 0.5;
        a.deptMap[deptKey].otHours += otH * 0.5;
        a.deptMap[deptKey].totalHours += totH * 0.5;
      });
    } else {
      // Non-HPT: Split into 5 Areas equally (20% each)
      AREA_5_KEYS.forEach(k => {
        const a = areaMap[k];
        a.nonHptAllocatedHC += 0.2;
        a.nonHptAllocatedHours += totH * 0.2;
        a.contHc += 0.2;
        a.contNormal += nHours * 0.2;
        a.contOt += otH * 0.2;

        const deptKey = `Non-HPT (Cont): ${code}${loc}`;
        if (!a.deptMap[deptKey]) {
          a.deptMap[deptKey] = {
            dept: `${d} (จัดสรร Non-HPT 1/5)`,
            isContractor: true,
            isMonthly: isMonthlyCont,
            headcount: 0,
            normalHours: 0,
            otHours: 0,
            totalHours: 0
          };
        }
        a.deptMap[deptKey].headcount += 0.2;
        a.deptMap[deptKey].normalHours += nHours * 0.2;
        a.deptMap[deptKey].otHours += otH * 0.2;
        a.deptMap[deptKey].totalHours += totH * 0.2;
      });
    }
  });

  // 3. Process Monthly Staff from Master Database (Salaries)
  const monthlyStaffList = Object.values(employeeMapping).filter(e => e.sourceSheet === 'Salaries' || e.mor === 'Salaried');
  const hoursPerPerson = monthlyStaff.hoursPerPerson || 0;

  if (hoursPerPerson > 0 && monthlyStaffList.length > 0) {
    monthlyStaffList.forEach(e => {
      const mu = (e.mu || 'Non-HPT').trim();
      const nHours = hoursPerPerson;
      const deptName = e.dept || 'Salaries Monthly Staff';

      if (AREA_5_KEYS.includes(mu as Area5Key)) {
        const a = areaMap[mu];
        a.monthlyHc += 1;
        a.monthlyNormal += nHours;

        const deptKey = `Salaries Monthly: ${deptName}`;
        if (!a.deptMap[deptKey]) {
          a.deptMap[deptKey] = {
            dept: `รายเดือน: ${deptName}`,
            isContractor: false,
            isMonthly: true,
            headcount: 0,
            normalHours: 0,
            otHours: 0,
            totalHours: 0
          };
        }
        a.deptMap[deptKey].headcount += 1;
        a.deptMap[deptKey].normalHours += nHours;
        a.deptMap[deptKey].totalHours += nHours;
      } else if (mu === 'Consumer/Bias Aero') {
        ['Consumer', 'Bias Aero'].forEach(k => {
          const a = areaMap[k];
          a.consumerBiasAllocatedHC += 0.5;
          a.consumerBiasAllocatedHours += nHours * 0.5;
          a.monthlyHc += 0.5;
          a.monthlyNormal += nHours * 0.5;

          const deptKey = `Shared Con/Bias (Monthly): ${deptName}`;
          if (!a.deptMap[deptKey]) {
            a.deptMap[deptKey] = {
              dept: `รายเดือน: ${deptName} (แบ่ง 50% Con/Bias)`,
              isContractor: false,
              isMonthly: true,
              headcount: 0,
              normalHours: 0,
              otHours: 0,
              totalHours: 0
            };
          }
          a.deptMap[deptKey].headcount += 0.5;
          a.deptMap[deptKey].normalHours += nHours * 0.5;
          a.deptMap[deptKey].totalHours += nHours * 0.5;
        });
      } else {
        // Non-HPT (20% to each of the 5 areas)
        AREA_5_KEYS.forEach(k => {
          const a = areaMap[k];
          a.nonHptAllocatedHC += 0.2;
          a.nonHptAllocatedHours += nHours * 0.2;
          a.monthlyHc += 0.2;
          a.monthlyNormal += nHours * 0.2;

          const deptKey = `Non-HPT (Monthly): ${deptName}`;
          if (!a.deptMap[deptKey]) {
            a.deptMap[deptKey] = {
              dept: `รายเดือน: ${deptName} (จัดสรร Non-HPT 1/5)`,
              isContractor: false,
              isMonthly: true,
              headcount: 0,
              normalHours: 0,
              otHours: 0,
              totalHours: 0
            };
          }
          a.deptMap[deptKey].headcount += 0.2;
          a.deptMap[deptKey].normalHours += nHours * 0.2;
          a.deptMap[deptKey].totalHours += nHours * 0.2;
        });
      }
    });
  } else if (hoursPerPerson > 0 && monthlyStaff.count > 0) {
    // Fallback if master employee mapping does not have individual Salaries rows
    const gyMonthlyHours = monthlyStaff.totalHours;
    AREA_5_KEYS.forEach(k => {
      const a = areaMap[k];
      const hcSplit = monthlyStaff.count * 0.2;
      const hSplit = gyMonthlyHours * 0.2;
      a.monthlyHc += hcSplit;
      a.monthlyNormal += hSplit;
      const deptKey = `GY Monthly Staff (1/5)`;
      if (!a.deptMap[deptKey]) {
        a.deptMap[deptKey] = {
          dept: `พนักงานรายเดือน GY (${monthlyStaff.count} คน @ ${hoursPerPerson} ชม. จัดสรร 1/5)`,
          isContractor: false,
          isMonthly: true,
          headcount: 0,
          normalHours: 0,
          otHours: 0,
          totalHours: 0
        };
      }
      a.deptMap[deptKey].headcount += hcSplit;
      a.deptMap[deptKey].normalHours += hSplit;
      a.deptMap[deptKey].totalHours += hSplit;
    });
  }

  // Fallback WAS Monthly Staff (if not scanned in contRecords)
  const fallbackWasCount = hasScannedWasMonthly ? 0 : (monthlyStaff.wasCount || 9);
  const fallbackWasHours = hasScannedWasMonthly ? 0 : (monthlyStaff.wasTotalHours ?? (fallbackWasCount * hoursPerPerson));
  if (!hasScannedWasMonthly && fallbackWasCount > 0 && fallbackWasHours > 0) {
    AREA_5_KEYS.forEach(k => {
      const a = areaMap[k];
      const hcSplit = fallbackWasCount * 0.2;
      const hSplit = fallbackWasHours * 0.2;
      a.monthlyHc += hcSplit;
      a.monthlyNormal += hSplit;
      const deptKey = `WAS Monthly Staff (1/5)`;
      if (!a.deptMap[deptKey]) {
        a.deptMap[deptKey] = {
          dept: `พนักงานรายเดือน WAS (${fallbackWasCount} คน @ ${hoursPerPerson} ชม. จัดสรร 1/5)`,
          isContractor: true,
          isMonthly: true,
          headcount: 0,
          normalHours: 0,
          otHours: 0,
          totalHours: 0
        };
      }
      a.deptMap[deptKey].headcount += hcSplit;
      a.deptMap[deptKey].normalHours += hSplit;
      a.deptMap[deptKey].totalHours += hSplit;
    });
  }

  // 4. B-EAD (Include) -> Add directly into Consumer Area
  if (beadAddHours > 0) {
    const aConsumer = areaMap['Consumer'];
    aConsumer.beadAddHours += beadAddHours;
    const beadKey = `B-end Bead (ชั่วโมงบวกเพิ่ม OPAH - Bead Component)`;
    if (!aConsumer.deptMap['B-end Bead']) {
      aConsumer.deptMap['B-end Bead'] = {
        dept: beadKey,
        isContractor: false,
        isMonthly: false,
        isBead: true,
        headcount: 0,
        normalHours: 0,
        otHours: 0,
        totalHours: 0
      };
    }
    aConsumer.deptMap['B-end Bead'].normalHours += beadAddHours;
    aConsumer.deptMap['B-end Bead'].totalHours += beadAddHours;
  }

  // 5. Development + PDI Hours (Deduct) -> Deduct from matching areas
  Object.entries(pdiDeductMap).forEach(([areaKey, hrs]) => {
    if (hrs > 0 && areaMap[areaKey]) {
      const a = areaMap[areaKey];
      a.pdiDeductHours += hrs;
      const pdiKey = `PDI & Dev Deduction (หักชั่วโมง OPAH)`;
      if (!a.deptMap['PDI & Dev']) {
        a.deptMap['PDI & Dev'] = {
          dept: pdiKey,
          isContractor: false,
          isMonthly: false,
          headcount: 0,
          normalHours: 0,
          otHours: 0,
          totalHours: 0
        };
      }
      a.deptMap['PDI & Dev'].normalHours -= hrs;
      a.deptMap['PDI & Dev'].totalHours -= hrs;
    }
  });

  // 6. BCA Reduction (Work done by BCA for Retread) -> Deduct from BCA, Add to Retread
  if (bcaReductionHours > 0) {
    const aBca = areaMap['BCA'];
    if (aBca) {
      aBca.bcaReductionHours += bcaReductionHours;
      const bcaRedKey = `BCA -> Retread Transfer (หักงานผลิตให้ Retread)`;
      if (!aBca.deptMap['BCA_Retread_Transfer']) {
        aBca.deptMap['BCA_Retread_Transfer'] = {
          dept: bcaRedKey,
          isContractor: false,
          isMonthly: false,
          headcount: 0,
          normalHours: 0,
          otHours: 0,
          totalHours: 0
        };
      }
      aBca.deptMap['BCA_Retread_Transfer'].normalHours -= bcaReductionHours;
      aBca.deptMap['BCA_Retread_Transfer'].totalHours -= bcaReductionHours;
    }

    const aRetread = areaMap['Retread'];
    if (aRetread) {
      aRetread.retreadReceivedHours += bcaReductionHours;
      const retreadAddKey = `Received from BCA (รับโอนงานผลิต Compound/Cement จาก BCA)`;
      if (!aRetread.deptMap['BCA_Retread_Received']) {
        aRetread.deptMap['BCA_Retread_Received'] = {
          dept: retreadAddKey,
          isContractor: false,
          isMonthly: false,
          headcount: 0,
          normalHours: 0,
          otHours: 0,
          totalHours: 0
        };
      }
      aRetread.deptMap['BCA_Retread_Received'].normalHours += bcaReductionHours;
      aRetread.deptMap['BCA_Retread_Received'].totalHours += bcaReductionHours;
    }
  }

  // 7. BCA DEV (Development compound in BCA) -> Deduct from BCA
  if (bcaDevHours > 0) {
    const aBca = areaMap['BCA'];
    if (aBca) {
      aBca.bcaDevHours += bcaDevHours;
      const bcaDevKey = `BCA DEV Compound (หักชั่วโมง Development BCA)`;
      if (!aBca.deptMap['BCA_DEV_Compound']) {
        aBca.deptMap['BCA_DEV_Compound'] = {
          dept: bcaDevKey,
          isContractor: false,
          isMonthly: false,
          headcount: 0,
          normalHours: 0,
          otHours: 0,
          totalHours: 0
        };
      }
      aBca.deptMap['BCA_DEV_Compound'].normalHours -= bcaDevHours;
      aBca.deptMap['BCA_DEV_Compound'].totalHours -= bcaDevHours;
    }
  }
}

export function getAreaTonnage(
  areaKey: string,
  tonnageReport: StockingTonnageReport | null,
  mode: 'DAILY' | 'MTD' = 'DAILY'
): { codes: string; kg: number; lbs: number; ton: number } {
  if (!tonnageReport) {
    return { codes: '-', kg: 0, lbs: 0, ton: 0 };
  }

  const rows = tonnageReport.rows || [];
  const getRowKg = (code: string): number => {
    const r = rows.find(x => x.code.trim().toUpperCase() === code.trim().toUpperCase());
    if (!r) return 0;
    return mode === 'MTD' ? (r.mtdTonnage || 0) : (r.dailyTotalTonnage || 0);
  };

  let kg = 0;
  let codes = '';

  if (areaKey === 'BCA') {
    codes = 'TOTAL (ทุก Code)';
    if (tonnageReport.total) {
      kg = mode === 'MTD' ? (tonnageReport.total.mtdTonnage || 0) : (tonnageReport.total.dailyTotalTonnage || 0);
    } else {
      kg = rows.reduce((sum, r) => sum + (mode === 'MTD' ? (r.mtdTonnage || 0) : (r.dailyTotalTonnage || 0)), 0);
    }
  } else if (areaKey === 'Consumer') {
    codes = 'CODE Q + W';
    kg = getRowKg('Q') + getRowKg('W');
  } else if (areaKey === 'Bias Aero') {
    codes = 'CODE A + B';
    kg = getRowKg('A') + getRowKg('B');
  } else if (areaKey === 'Radial Aero') {
    codes = 'CODE 6';
    kg = getRowKg('6');
  } else {
    codes = 'ตัดออก (6320)';
    kg = 0;
  }

  const LBS_FACTOR = 2.20462;
  const lbs = Math.round(kg * LBS_FACTOR * 100) / 100;
  const ton = Math.round((kg / 1000) * 1000) / 1000;

  return { codes, kg, lbs, ton };
}

export function getDeptSortPriority(d: OhpaAreaDeptItem): number {
  const name = d.dept || '';
  const isNonHpt = name.includes('Non-HPT') || name.includes('1/5');
  const isShared = name.includes('50% Con/Bias') || name.includes('Shared');

  // 1. Direct Production - Goodyear
  if (!isNonHpt && !isShared && !d.isContractor && !d.isMonthly && !d.isBead && !name.includes('PDI')) {
    return 10;
  }

  // 2. Direct Production - Contractor
  if (!isNonHpt && !isShared && d.isContractor && !d.isMonthly) {
    return 20;
  }

  // 3. Direct Area - Monthly Salaries
  if (!isNonHpt && !isShared && d.isMonthly) {
    return 30;
  }

  // 4. Shared Consumer/Bias Aero 50%
  if (isShared) {
    if (!d.isContractor && !d.isMonthly) return 40;
    if (d.isContractor && !d.isMonthly) return 41;
    return 42;
  }

  // 5. Adjustments: Bead Component (+) & PDI Deduction (-)
  if (d.isBead) return 50;
  if (name.includes('PDI')) return 51;

  // 6. Non-HPT 1/5 Allocated Support - Goodyear
  if (isNonHpt && !d.isContractor && !d.isMonthly) {
    return 60;
  }

  // 7. Non-HPT 1/5 Allocated Support - Contractor
  if (isNonHpt && d.isContractor && !d.isMonthly) {
    return 70;
  }

  // 8. Non-HPT 1/5 Allocated Support - Monthly Staff
  if (isNonHpt && d.isMonthly) {
    return 80;
  }

  return 90;
}

export function extractDeptCode(deptName: string): string {
  const match = deptName.match(/(?:แผนก\s*|รายเดือน:\s*|:\s*|^|\s)([A-Z]?\d{4}|[A-Z]?\d{3})/i) || deptName.match(/\b([A-Z]?\d{4})\b/i);
  return match ? match[1].toUpperCase() : deptName;
}

export function compareDeptItems(a: OhpaAreaDeptItem, b: OhpaAreaDeptItem): number {
  const pA = getDeptSortPriority(a);
  const pB = getDeptSortPriority(b);
  if (pA !== pB) return pA - pB;

  const codeA = extractDeptCode(a.dept);
  const codeB = extractDeptCode(b.dept);
  const cmp = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  if (cmp !== 0) return cmp;

  return b.totalHours - a.totalHours;
}

export function buildAreaBreakdownList(
  areaMap: Record<string, AreaAccumulator>,
  totalWorkingHours: number,
  daysCount: number = 1,
  tonnageReport: StockingTonnageReport | null = null,
  mode: 'DAILY' | 'MTD' = 'DAILY'
): OhpaAreaMetrics[] {
  const avgDays = Math.max(1, daysCount);
  const LBS_FACTOR = 2.20462;
  return Object.values(areaMap)
    .map(a => {
      const normalH = a.gyNormal + a.contNormal + a.monthlyNormal;
      const otH = a.gyOt + a.contOt;
      const grossTotH = normalH + otH;
      const beadH = a.beadAddHours;
      const pdiH = a.pdiDeductHours;
      const bcaRedH = a.bcaReductionHours;
      const bcaDevH = a.bcaDevHours;
      const retreadRecH = a.retreadReceivedHours;
      const finalOpah = grossTotH + beadH - pdiH - bcaRedH - bcaDevH + retreadRecH;

      const totHc = Math.round(((a.gyHc + a.contHc + a.monthlyHc) / avgDays) * 10) / 10;
      const gyHc = Math.round((a.gyHc / avgDays) * 10) / 10;
      const contHc = Math.round((a.contHc / avgDays) * 10) / 10;
      const monthlyHc = a.monthlyHc > 0 ? Math.round((a.monthlyHc / avgDays) * 10) / 10 : undefined;
      const gyTot = a.gyNormal + a.gyOt;
      const contTot = a.contNormal + a.contOt;

      const subDepts = Object.values(a.deptMap)
        .map(d => ({
          ...d,
          headcount: Math.round((d.headcount / avgDays) * 10) / 10,
          normalHours: Math.round(d.normalHours * 10) / 10,
          otHours: Math.round(d.otHours * 10) / 10,
          totalHours: Math.round(d.totalHours * 10) / 10
        }))
        .sort(compareDeptItems);

      const areaTonnage = getAreaTonnage(a.areaKey, tonnageReport, mode);
      const areaOpahLbsPerHour = (!a.isExcluded6320 && finalOpah > 0 && areaTonnage.kg > 0)
        ? Math.round(((areaTonnage.kg * LBS_FACTOR) / finalOpah) * 100) / 100
        : undefined;

      return {
        areaKey: a.areaKey,
        areaName: a.areaName,
        areaLabel: a.areaLabel,
        icon: a.icon,
        order: a.order,
        headcountStandard: a.headcountStandard,
        isExcluded6320: a.isExcluded6320,
        totalHeadcount: totHc,
        gyHeadcount: gyHc,
        contractorHeadcount: contHc,
        monthlyHeadcount: monthlyHc,
        normalHours: Math.round(normalH * 10) / 10,
        otHours: Math.round(otH * 10) / 10,
        totalHours: Math.round(grossTotH * 10) / 10,
        gyNormalHours: Math.round(a.gyNormal * 10) / 10,
        gyOtHours: Math.round(a.gyOt * 10) / 10,
        gyTotalHours: Math.round(gyTot * 10) / 10,
        contractorNormalHours: Math.round(a.contNormal * 10) / 10,
        contractorOtHours: Math.round(a.contOt * 10) / 10,
        contractorTotalHours: Math.round(contTot * 10) / 10,
        monthlyHours: a.monthlyNormal > 0 ? Math.round(a.monthlyNormal * 10) / 10 : undefined,
        nonHptAllocatedHours: Math.round(a.nonHptAllocatedHours * 10) / 10,
        nonHptAllocatedHC: Math.round(a.nonHptAllocatedHC * 10) / 10,
        consumerBiasAllocatedHours: Math.round(a.consumerBiasAllocatedHours * 10) / 10,
        consumerBiasAllocatedHC: Math.round(a.consumerBiasAllocatedHC * 10) / 10,
        beadAddHours: Math.round(beadH * 10) / 10,
        pdiDeductHours: Math.round(pdiH * 10) / 10,
        bcaReductionHours: Math.round(bcaRedH * 10) / 10,
        bcaDevHours: Math.round(bcaDevH * 10) / 10,
        retreadReceivedHours: Math.round(retreadRecH * 10) / 10,
        finalOpahHours: Math.round(finalOpah * 10) / 10,
        percentageOfTotalHours: totalWorkingHours > 0 && !a.isExcluded6320
          ? Math.round((grossTotH / totalWorkingHours) * 1000) / 10
          : 0,
        departments: subDepts,
        areaTonnageCodes: areaTonnage.codes,
        areaTonnageKg: areaTonnage.kg,
        areaTonnageLbs: areaTonnage.lbs,
        areaTonnageTon: areaTonnage.ton,
        areaOpahLbsPerHour
      };
    })
    .sort((a, b) => a.order - b.order);
}

export function buildPdiDeductMap(pdiBeadReport: PdiBeadReport, day: number): Record<string, number> {
  const map: Record<string, number> = {
    'BCA': 0,
    'Consumer': 0,
    'Bias Aero': 0,
    'Radial Aero': 0,
    'Retread': 0
  };

  if (!pdiBeadReport || !pdiBeadReport.pdiPersons) return map;

  pdiBeadReport.pdiPersons.forEach(person => {
    const hrs = person.dailyHours?.[day] || 0;
    if (hrs <= 0) return;
    const g = (person.group || '').toLowerCase();
    const d = (person.desc || '').toLowerCase();
    const name = (person.name || '').toLowerCase();

    if (name.includes('vattana') || g.includes('aviation') || g.includes('bia/radial') || d.includes('aviation')) {
      map['Bias Aero'] += hrs * 0.5;
      map['Radial Aero'] += hrs * 0.5;
    } else if (name.includes('kitipan') || g.includes('bias') || d.includes('bias')) {
      map['Bias Aero'] += hrs;
    } else if (name.includes('damrongsak') || g.includes('radial') || d.includes('radial') || d.includes('sapphire')) {
      map['Radial Aero'] += hrs;
    } else if (name.includes('somrudee') || name.includes('sangpian') || g.includes('consumer') || d.includes('consumer')) {
      map['Consumer'] += hrs;
    } else {
      map['Consumer'] += hrs;
    }
  });

  return map;
}

export function calculateMtdSummary(
  targetDateStr: string,
  currentGyRecords: ParsedShiftRecord[],
  currentContRecords: ContractorScanRecord[],
  tonnageReport: StockingTonnageReport | null,
  allScanPresets: { name: string; dateFormatted?: string; content: string }[] = [],
  contractorRecordsByDate: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }> = {},
  employeeMapping: Record<string, EmployeeInfo> = {},
  dailyAdjustments: DailyAdjustmentRecord[] = [],
  pdiBeadReport: PdiBeadReport = DEFAULT_PDI_BEAD_REPORT
): MtdOhpaSummary {
  const clean = (targetDateStr || '').replace(/^[📅📄\s]*วันที่\s*/, '').trim();
  const parts = clean.split(/[/.-]/);
  let targetDay = 14, targetMonth = 9, targetYear = 2026;
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      targetDay = parseInt(parts[0], 10) || 14;
      targetMonth = parseInt(parts[1], 10) || 9;
      targetYear = parseInt(parts[2], 10) || 2026;
    } else if (parts[0].length === 4) {
      targetYear = parseInt(parts[0], 10) || 2026;
      targetMonth = parseInt(parts[1], 10) || 9;
      targetDay = parseInt(parts[2], 10) || 14;
    }
  }

  const dailyItems: DailyMtdItem[] = [];
  let mtdTotalHours = 0;
  let mtdGyHours = 0;
  let mtdContractorHours = 0;
  let mtdMonthlyHours = 0;
  let mtdPdiDeductHours = 0;
  let mtdBeadAddHours = 0;
  let mtdBcaReductionHours = 0;
  let mtdBcaDevHours = 0;
  let mtdOpahWorkingHours = 0;

  const mtdAreaMap = createEmptyAreaMap();
  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

  for (let d = 1; d <= targetDay; d++) {
    const dPad = String(d).padStart(2, '0');
    const mPad = String(targetMonth).padStart(2, '0');
    const dayDateStr = `${dPad}/${mPad}/${targetYear}`;
    const dt = new Date(targetYear, targetMonth - 1, d);
    const dayOfWeek = dt.getDay();
    const dayName = dayNames[dayOfWeek];

    let dayGyRecords: ParsedShiftRecord[] = [];
    let gyHeadcount = 0;
    let gyHours = 0;

    let dayContRecords: ContractorScanRecord[] = [];
    let contractorHeadcount = 0;
    let contractorHours = 0;

    // 1. Goodyear Data
    if (d === targetDay) {
      dayGyRecords = currentGyRecords;
      const active = currentGyRecords.filter(r => !isGyDept6320(r));
      gyHeadcount = active.length;
      gyHours = active.reduce((sum, r) => sum + (r.normalWorkHours || 0) + (r.otHours || 0), 0);
    } else {
      const preset = allScanPresets.find(p => {
        const pName = p.name || '';
        const pDate = p.dateFormatted || '';
        if (pName.includes(`${targetYear}${mPad}${dPad}`) || pName.includes(`${mPad}${dPad}${targetYear}`)) return true;
        if (pDate.includes(dayDateStr) || pDate.includes(`${d}/${targetMonth}/${targetYear}`)) return true;
        return false;
      });

      if (preset && preset.content) {
        const parsed = processScanRecords(preset.content, employeeMapping, dailyAdjustments);
        dayGyRecords = parsed.records;
        const active = parsed.records.filter(r => !isGyDept6320(r));
        gyHeadcount = active.length;
        gyHours = active.reduce((sum, r) => sum + (r.normalWorkHours || 0) + (r.otHours || 0), 0);
      }
    }

    // 2. Contractor Data
    let contHourlyRecords: ContractorScanRecord[] = [];
    let contMonthlyRecords: ContractorScanRecord[] = [];

    if (d === targetDay) {
      dayContRecords = currentContRecords.filter(r => r.hasScannedIn || r.totalHours > 0);
      const active = dayContRecords.filter(r => !isContDept6320(r));
      contHourlyRecords = active.filter(r => r.type !== 'Salary' && !(r as any).isMonthly);
      contMonthlyRecords = active.filter(r => r.type === 'Salary' || (r as any).isMonthly);
      contractorHeadcount = contHourlyRecords.length;
      contractorHours = contHourlyRecords.reduce((sum, r) => sum + (r.normalHours || 0) + (r.otHours || 0), 0);
    } else {
      const contEntry = contractorRecordsByDate[`${d}/${targetMonth}/${targetYear}`] ||
        contractorRecordsByDate[dayDateStr] ||
        contractorRecordsByDate[`${targetYear}-${mPad}-${dPad}`];

      if (contEntry && contEntry.records) {
        dayContRecords = contEntry.records.filter(r => r.hasScannedIn || r.totalHours > 0);
        const active = dayContRecords.filter(r => !isContDept6320(r));
        contHourlyRecords = active.filter(r => r.type !== 'Salary' && !(r as any).isMonthly);
        contMonthlyRecords = active.filter(r => r.type === 'Salary' || (r as any).isMonthly);
        contractorHeadcount = contHourlyRecords.length;
        contractorHours = contHourlyRecords.reduce((sum, r) => sum + (r.normalHours || 0) + (r.otHours || 0), 0);
      }
    }

    // 3. Monthly Staff Data (Goodyear 62 + WAS 9)
    const monthlyStaff = getMonthlyStaffMetrics(dayDateStr);

    const pdiDeductHours = pdiBeadReport?.pdiDailyTotals?.[d] || 0;
    const beadAddHours = pdiBeadReport?.beadDailyTotals?.[d] || 0;
    const bcaReductionHours = pdiBeadReport?.bcaReductionDailyHours?.[d] || (pdiBeadReport?.bcaReductionDailyMinutes?.[d] ? Math.round((pdiBeadReport.bcaReductionDailyMinutes[d] / 60) * 100) / 100 : 0);
    const bcaDevHours = pdiBeadReport?.bcaDevDailyHours?.[d] || (pdiBeadReport?.bcaDevDailyMinutes?.[d] ? Math.round((pdiBeadReport.bcaDevDailyMinutes[d] / 60) * 100) / 100 : 0);
    const dayPdiDeductMap = buildPdiDeductMap(pdiBeadReport, d);

    // Calculate day-level area breakdown
    const dayAreaMap = createEmptyAreaMap();
    accumulateRecordsIntoAreaMap(
      dayAreaMap,
      dayGyRecords,
      dayContRecords,
      monthlyStaff,
      beadAddHours,
      dayPdiDeductMap,
      employeeMapping,
      bcaReductionHours,
      bcaDevHours
    );

    // Accumulate area breakdown for day d into MTD
    accumulateRecordsIntoAreaMap(
      mtdAreaMap,
      dayGyRecords,
      dayContRecords,
      monthlyStaff,
      beadAddHours,
      dayPdiDeductMap,
      employeeMapping,
      bcaReductionHours,
      bcaDevHours
    );

    // Derive active 4 areas for day d
    const dayActiveAreas = (['BCA', 'Consumer', 'Bias Aero', 'Radial Aero'] as Area5Key[]).map(k => dayAreaMap[k]);
    const dayGyHc = Math.round(dayActiveAreas.reduce((s, a) => s + a.gyHc, 0) * 10) / 10;
    const dayGyH = Math.round(dayActiveAreas.reduce((s, a) => s + a.gyNormal + a.gyOt, 0) * 10) / 10;
    const dayContHc = Math.round(dayActiveAreas.reduce((s, a) => s + a.contHc, 0) * 10) / 10;
    const dayContH = Math.round(dayActiveAreas.reduce((s, a) => s + a.contNormal + a.contOt, 0) * 10) / 10;
    const dayMonthlyH = Math.round(dayActiveAreas.reduce((s, a) => s + a.monthlyNormal, 0) * 10) / 10;
    const dayTotalHours = Math.round((dayGyH + dayContH + dayMonthlyH) * 10) / 10;
    const dayOpahHours = Math.max(0, Math.round((dayTotalHours - pdiDeductHours + beadAddHours - bcaReductionHours - bcaDevHours) * 10) / 10);

    mtdGyHours += dayGyH;
    mtdContractorHours += dayContH;
    mtdMonthlyHours += dayMonthlyH;
    mtdTotalHours += dayTotalHours;
    mtdPdiDeductHours += pdiDeductHours;
    mtdBeadAddHours += beadAddHours;
    mtdBcaReductionHours += bcaReductionHours;
    mtdBcaDevHours += bcaDevHours;
    mtdOpahWorkingHours += dayOpahHours;

    const LBS_CONST = 2.20462;
    const dayAreaBreakdown = buildAreaBreakdownList(dayAreaMap, dayTotalHours, 1, tonnageReport, 'DAILY');

    // Calculate/Estimate daily stocking tonnage
    let dayStockingKg = 0;
    if (d === targetDay && tonnageReport?.total?.dailyTotalTonnage) {
      dayStockingKg = tonnageReport.total.dailyTotalTonnage;
    } else if (tonnageReport?.total?.mtdTonnage && targetDay > 0) {
      dayStockingKg = Math.round((tonnageReport.total.mtdTonnage / targetDay) * 100) / 100;
    } else if (tonnageReport?.total?.dailyTotalTonnage) {
      dayStockingKg = tonnageReport.total.dailyTotalTonnage;
    }
    const dayStockingLbs = Math.round(dayStockingKg * LBS_CONST * 100) / 100;
    const dailyOpahLbsPerHour = dayOpahHours > 0 && dayStockingLbs > 0
      ? Math.round((dayStockingLbs / dayOpahHours) * 100) / 100
      : 0;

    const cumulativeStockingKg = (tonnageReport?.total?.mtdTonnage && targetDay > 0)
      ? Math.round((tonnageReport.total.mtdTonnage / targetDay * d) * 100) / 100
      : dayStockingKg * d;
    const cumulativeOpahLbsPerHour = mtdOpahWorkingHours > 0 && cumulativeStockingKg > 0
      ? Math.round(((cumulativeStockingKg * LBS_CONST) / mtdOpahWorkingHours) * 100) / 100
      : 0;

    dailyItems.push({
      day: d,
      dateStr: dayDateStr,
      dayName,
      gyHeadcount: dayGyHc,
      gyHours: Math.round(dayGyH * 10) / 10,
      contractorHeadcount: dayContHc,
      contractorHours: Math.round(dayContH * 10) / 10,
      monthlyHours: Math.round(dayMonthlyH * 10) / 10,
      totalHours: Math.round(dayTotalHours * 10) / 10,
      pdiDeductHours: Math.round(pdiDeductHours * 10) / 10,
      beadAddHours: Math.round(beadAddHours * 10) / 10,
      bcaReductionHours: Math.round(bcaReductionHours * 10) / 10,
      bcaDevHours: Math.round(bcaDevHours * 10) / 10,
      opahWorkingHours: Math.round(dayOpahHours * 10) / 10,
      cumulativeTotalHours: Math.round(mtdTotalHours * 10) / 10,
      cumulativeOpahWorkingHours: Math.round(mtdOpahWorkingHours * 10) / 10,
      stockingKg: dayStockingKg,
      stockingLbs: dayStockingLbs,
      dailyOpahLbsPerHour,
      cumulativeOpahLbsPerHour,
      areaBreakdown: dayAreaBreakdown
    });
  }

  const LBS_FACTOR = 2.20462;
  const mtdStockingKg = tonnageReport?.total?.mtdTonnage || (tonnageReport?.total?.dailyTotalTonnage ? tonnageReport.total.dailyTotalTonnage * targetDay : 0);
  const mtdStockingLbs = Math.round(mtdStockingKg * LBS_FACTOR * 100) / 100;
  const mtdStockingTon = Math.round((mtdStockingKg / 1000) * 1000) / 1000;
  const mtdPallets = tonnageReport?.total?.mtdPallets || 0;

  const mtdOpahLbsPerHour = mtdOpahWorkingHours > 0
    ? Math.round(((mtdStockingKg * LBS_FACTOR) / mtdOpahWorkingHours) * 100) / 100
    : 0;

  const mtdGyOpahLbsPerHour = mtdGyHours > 0
    ? Math.round(((mtdStockingKg * LBS_FACTOR) / mtdGyHours) * 100) / 100
    : 0;

  const mtdContractorOpahLbsPerHour = mtdContractorHours > 0
    ? Math.round(((mtdStockingKg * LBS_FACTOR) / mtdContractorHours) * 100) / 100
    : 0;

  const areaBreakdown = buildAreaBreakdownList(mtdAreaMap, mtdTotalHours, targetDay, tonnageReport, 'MTD');

  return {
    targetDate: clean || `${String(targetDay).padStart(2, '0')}/${String(targetMonth).padStart(2, '0')}/${targetYear}`,
    daysCount: targetDay,
    mtdTotalHours: Math.round(mtdTotalHours * 10) / 10,
    mtdGyHours: Math.round(mtdGyHours * 10) / 10,
    mtdContractorHours: Math.round(mtdContractorHours * 10) / 10,
    mtdMonthlyHours: Math.round(mtdMonthlyHours * 10) / 10,
    mtdPdiDeductHours: Math.round(mtdPdiDeductHours * 10) / 10,
    mtdBeadAddHours: Math.round(mtdBeadAddHours * 10) / 10,
    mtdBcaReductionHours: Math.round(mtdBcaReductionHours * 10) / 10,
    mtdBcaDevHours: Math.round(mtdBcaDevHours * 10) / 10,
    mtdOpahWorkingHours: Math.round(mtdOpahWorkingHours * 10) / 10,
    mtdStockingKg,
    mtdStockingLbs,
    mtdStockingTon,
    mtdPallets,
    mtdOpahLbsPerHour,
    mtdGyOpahLbsPerHour,
    mtdContractorOpahLbsPerHour,
    dailyItems,
    areaBreakdown
  };
}

export function calculateOhpaSummary(
  records: ParsedShiftRecord[],
  contractorRecords: ContractorScanRecord[] = [],
  tonnageReport: StockingTonnageReport | null,
  productionDayFormatted: string,
  allScanPresets: { name: string; dateFormatted?: string; content: string }[] = [],
  contractorRecordsByDate: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }> = {},
  employeeMapping: Record<string, EmployeeInfo> = {},
  dailyAdjustments: DailyAdjustmentRecord[] = [],
  pdiBeadReport: PdiBeadReport = DEFAULT_PDI_BEAD_REPORT
): OhpaSummary {
  const rawContActive = (contractorRecords || []).filter(r => r && (r.hasScannedIn || r.totalHours > 0));

  // 1. Monthly Staff
  const monthlyStaff = getMonthlyStaffMetrics(productionDayFormatted);
  const hasScannedWasMonthly = rawContActive.some(r => r.type === 'Salary' || (r as any).isMonthly);
  const fallbackWasCount = hasScannedWasMonthly ? 0 : (monthlyStaff.wasCount ?? 9);
  const fallbackWasHours = hasScannedWasMonthly ? 0 : (monthlyStaff.wasTotalHours ?? (fallbackWasCount * monthlyStaff.hoursPerPerson));

  // 2. PDI Deduct & B-end (Bead) Addition for OPAH
  const cleanDate = (productionDayFormatted || '').replace(/^[📅📄\s]*วันที่\s*/, '').trim();
  const dateParts = cleanDate.split(/[/.-]/);
  let targetDay = 14;
  if (dateParts.length === 3) {
    if (dateParts[2].length === 4) targetDay = parseInt(dateParts[0], 10) || 14;
    else if (dateParts[0].length === 4) targetDay = parseInt(dateParts[2], 10) || 14;
  }
  const pdiDeductHours = pdiBeadReport?.pdiDailyTotals?.[targetDay] || 0;
  const beadAddHours = pdiBeadReport?.beadDailyTotals?.[targetDay] || 0;
  const bcaReductionHours = pdiBeadReport?.bcaReductionDailyHours?.[targetDay] || (pdiBeadReport?.bcaReductionDailyMinutes?.[targetDay] ? Math.round((pdiBeadReport.bcaReductionDailyMinutes[targetDay] / 60) * 100) / 100 : 0);
  const bcaDevHours = pdiBeadReport?.bcaDevDailyHours?.[targetDay] || (pdiBeadReport?.bcaDevDailyMinutes?.[targetDay] ? Math.round((pdiBeadReport.bcaDevDailyMinutes[targetDay] / 60) * 100) / 100 : 0);
  const pdiDeductMap = buildPdiDeductMap(pdiBeadReport, targetDay);

  // 3. Process Area Breakdown (5 Areas based on Master Headcount 16 Sep)
  const areaMap = createEmptyAreaMap();
  accumulateRecordsIntoAreaMap(
    areaMap,
    records,
    rawContActive,
    monthlyStaff,
    beadAddHours,
    pdiDeductMap,
    employeeMapping,
    bcaReductionHours,
    bcaDevHours
  );

  // Active 4 Areas & Retread derived from areaBreakdown
  const areaBreakdown = buildAreaBreakdownList(areaMap, 0, 1, tonnageReport, 'DAILY');
  const activeAreas = areaBreakdown.filter(a => !a.isExcluded6320);
  const retreadArea = areaBreakdown.find(a => a.isExcluded6320);

  const totalNormalHours = Math.round(activeAreas.reduce((s, a) => s + a.normalHours, 0) * 10) / 10;
  const totalOtHours = Math.round(activeAreas.reduce((s, a) => s + a.otHours, 0) * 10) / 10;
  const totalWorkingHours = Math.round(activeAreas.reduce((s, a) => s + a.totalHours, 0) * 10) / 10;
  const totalEmployeesCount = Math.round(activeAreas.reduce((s, a) => s + a.totalHeadcount, 0) * 10) / 10;

  const gyEmployeesCount = Math.round(activeAreas.reduce((s, a) => s + a.gyHeadcount, 0) * 10) / 10;
  const gyTotalHours = Math.round(activeAreas.reduce((s, a) => s + a.gyTotalHours, 0) * 10) / 10;
  const gyNormalHours = Math.round(activeAreas.reduce((s, a) => s + a.gyNormalHours, 0) * 10) / 10;
  const gyOtHours = Math.round(activeAreas.reduce((s, a) => s + a.gyOtHours, 0) * 10) / 10;

  const contractorEmployeesCount = Math.round(activeAreas.reduce((s, a) => s + a.contractorHeadcount, 0) * 10) / 10;
  const contractorTotalHours = Math.round(activeAreas.reduce((s, a) => s + a.contractorTotalHours, 0) * 10) / 10;
  const contractorNormalHours = Math.round(activeAreas.reduce((s, a) => s + a.contractorNormalHours, 0) * 10) / 10;
  const contractorOtHours = Math.round(activeAreas.reduce((s, a) => s + a.contractorOtHours, 0) * 10) / 10;

  const activePdiHours = Math.round(activeAreas.reduce((s, a) => s + (a.pdiDeductHours || 0), 0) * 10) / 10;
  const activeBeadHours = Math.round(activeAreas.reduce((s, a) => s + (a.beadAddHours || 0), 0) * 10) / 10;
  const opahWorkingHours = Math.round(activeAreas.reduce((s, a) => s + a.finalOpahHours, 0) * 10) / 10;

  const excluded6320GyCount = Math.round((retreadArea?.gyHeadcount || 0) * 10) / 10;
  const excluded6320GyHours = Math.round((retreadArea?.gyTotalHours || 0) * 10) / 10;
  const excluded6320ContCount = Math.round((retreadArea?.contractorHeadcount || 0) * 10) / 10;
  const excluded6320ContHours = Math.round((retreadArea?.contractorTotalHours || 0) * 10) / 10;

  // 4. Tonnage & Pounds (lbs)
  const LBS_CONVERSION_FACTOR = 2.20462;
  const totalTonnageKg = tonnageReport?.total?.dailyTotalTonnage || 0;
  const totalTonnageTon = totalTonnageKg / 1000;
  const totalTonnageLbs = Math.round(totalTonnageKg * LBS_CONVERSION_FACTOR * 100) / 100;
  const totalPallets = tonnageReport?.total?.dailyTotalPallets || 0;

  // 5. OPAH Calculation: OPAH = (Stocking kg x 2.20462) / Net OPAH Working Hours (lbs/hr)
  const overallOpahLbsPerHour = opahWorkingHours > 0
    ? Math.round(((totalTonnageKg * LBS_CONVERSION_FACTOR) / opahWorkingHours) * 100) / 100
    : 0;

  const gyOpahLbsPerHour = gyTotalHours > 0
    ? Math.round(((totalTonnageKg * LBS_CONVERSION_FACTOR) / gyTotalHours) * 100) / 100
    : 0;

  const contractorOpahLbsPerHour = contractorTotalHours > 0
    ? Math.round(((totalTonnageKg * LBS_CONVERSION_FACTOR) / contractorTotalHours) * 100) / 100
    : 0;

  // Helper to get MU
  const getEmpMu = (empId: string, fallbackMu?: string, category?: string, dept?: string, costCenter?: string): string => {
    const emp = employeeMapping[empId] || employeeMapping[empId.replace(/^0+/, '')] || employeeMapping[empId.padStart(5, '0')];
    if (emp?.mu) return emp.mu.trim();
    if (fallbackMu) return fallbackMu.trim();
    return 'Non-HPT';
  };

  const gyActiveRecords = records.filter(r => {
    const mu = getEmpMu(r.empId, r.mu, r.category, r.dept, r.costCenter);
    return mu !== 'Retread' && !isGyDept6320(r);
  });

  const contActiveRecords = rawContActive.filter(r => {
    const empCode = r.empCode || (r as any).workerId || '';
    const mu = getEmpMu(empCode, '', '', r.department, r.closing);
    return mu !== 'Retread' && !isContDept6320(r);
  });

  // 7. Shift Breakdown (Allocating working hours & OT to the actual shift operating time window)
  const shiftAlloc: Record<1 | 2 | 3, {
    gyNorm: number;
    gyOt: number;
    gyHc: number;
    contNorm: number;
    contOt: number;
    contHc: number;
  }> = {
    1: { gyNorm: 0, gyOt: 0, gyHc: 0, contNorm: 0, contOt: 0, contHc: 0 },
    2: { gyNorm: 0, gyOt: 0, gyHc: 0, contNorm: 0, contOt: 0, contHc: 0 },
    3: { gyNorm: 0, gyOt: 0, gyHc: 0, contNorm: 0, contOt: 0, contHc: 0 }
  };

  // Goodyear Allocation (Applying Non-HPT 80% active weight)
  gyActiveRecords.forEach(r => {
    const s = r.shift;
    const mu = getEmpMu(r.empId, r.mu, r.category, r.dept, r.costCenter);
    const weight = mu === 'Non-HPT' ? 0.8 : 1.0;
    const norm = (r.normalWorkHours || 0) * weight;
    const ot = (r.otHours || 0) * weight;

    if (s === 1) {
      shiftAlloc[1].gyNorm += norm;
      shiftAlloc[1].gyHc += weight;
      if (ot > 0) {
        if (r.empId === '01454' || r.empId === '1454') {
          shiftAlloc[1].gyOt += ot;
        } else {
          const s2Ot = Math.min(8 * weight, ot);
          const s3Ot = Math.max(0, ot - 8 * weight);
          shiftAlloc[2].gyOt += s2Ot;
          shiftAlloc[3].gyOt += s3Ot;
        }
      }
    } else if (s === 2) {
      shiftAlloc[2].gyNorm += norm;
      shiftAlloc[2].gyHc += weight;
      if (ot > 0) {
        if (r.isPreShiftReliefOt) {
          shiftAlloc[1].gyOt += ot;
        } else {
          shiftAlloc[3].gyOt += ot;
        }
      }
    } else if (s === 3) {
      shiftAlloc[3].gyNorm += norm;
      shiftAlloc[3].gyHc += weight;
      if (ot > 0) {
        const inH = r.inTime ? (typeof r.inTime.getHours === 'function' ? r.inTime.getHours() : new Date(r.inTime).getHours()) : 23;
        if (inH >= 17 && inH < 22) {
          shiftAlloc[2].gyOt += ot;
        } else {
          shiftAlloc[1].gyOt += ot;
        }
      }
    }
  });

  // Contractor Allocation (Applying Non-HPT 80% active weight)
  contActiveRecords.forEach(r => {
    const s = r.shiftNumber;
    const empCode = r.empCode || (r as any).workerId || '';
    const mu = getEmpMu(empCode, '', '', r.department, r.closing);
    const weight = mu === 'Non-HPT' ? 0.8 : 1.0;
    const norm = (r.normalHours || 0) * weight;
    const ot = (r.otHours || 0) * weight;

    if (s === 1) {
      shiftAlloc[1].contNorm += norm;
      shiftAlloc[1].contHc += weight;
      if (ot > 0) {
        const s2Ot = Math.min(8 * weight, ot);
        const s3Ot = Math.max(0, ot - 8 * weight);
        shiftAlloc[2].contOt += s2Ot;
        shiftAlloc[3].contOt += s3Ot;
      }
    } else if (s === 2) {
      shiftAlloc[2].contNorm += norm;
      shiftAlloc[2].contOt += ot;
      shiftAlloc[2].contHc += weight;
    } else if (s === 3) {
      shiftAlloc[3].contNorm += norm;
      shiftAlloc[3].contHc += weight;
      if (ot > 0) {
        shiftAlloc[2].contOt += ot;
      }
    }
  });

  const totalMonthlyHours = (monthlyStaff.combinedTotalHours || (monthlyStaff.totalHours + (monthlyStaff.wasTotalHours || 0))) || 560;
  const totalMonthlyHc = monthlyStaff.combinedCount || 70;

  const shiftList: (1 | 2 | 3)[] = [1, 2, 3];
  const shifts: OhpaShiftMetrics[] = shiftList.map(shiftNum => {
    const alloc = shiftAlloc[shiftNum];
    const gyHc = Math.round(alloc.gyHc * 10) / 10;
    const contHc = Math.round(alloc.contHc * 10) / 10;
    const headcount = Math.round((gyHc + contHc) * 10) / 10;

    const gyNorm = Math.round(alloc.gyNorm * 10) / 10;
    const gyOt = Math.round(alloc.gyOt * 10) / 10;
    const gyTot = Math.round((gyNorm + gyOt) * 10) / 10;

    const contNorm = Math.round(alloc.contNorm * 10) / 10;
    const contOt = Math.round(alloc.contOt * 10) / 10;
    const contTot = Math.round((contNorm + contOt) * 10) / 10;

    const normalHours = Math.round((gyNorm + contNorm) * 10) / 10;
    const otHours = Math.round((gyOt + contOt) * 10) / 10;

    // Distribute monthly staff, PDI deduct, and Bead add equally across 3 shifts
    const monthlyHours = shiftNum === 3
      ? Math.round((totalMonthlyHours - Math.round(totalMonthlyHours / 3 * 10) / 10 * 2) * 10) / 10
      : Math.round(totalMonthlyHours / 3 * 10) / 10;

    const monthlyHeadcount = Math.round(totalMonthlyHc / 3 * 10) / 10;

    const shiftPdiDeduct = shiftNum === 3
      ? Math.round((activePdiHours - Math.round(activePdiHours / 3 * 10) / 10 * 2) * 10) / 10
      : Math.round(activePdiHours / 3 * 10) / 10;

    const shiftBeadAdd = shiftNum === 3
      ? Math.round((activeBeadHours - Math.round(activeBeadHours / 3 * 10) / 10 * 2) * 10) / 10
      : Math.round(activeBeadHours / 3 * 10) / 10;

    const grossHours = Math.round((gyTot + contTot + monthlyHours) * 10) / 10;
    const opahWorkingHours = Math.round((grossHours - shiftPdiDeduct + shiftBeadAdd) * 10) / 10;
    const totalHours = opahWorkingHours; // Set totalHours to Net OPAH Working Hours

    let tonnageKg = 0;
    let pallets = 0;

    if (tonnageReport?.total) {
      if (shiftNum === 1) {
        tonnageKg = tonnageReport.total.shift1Tonnage;
        pallets = tonnageReport.total.shift1Pallets;
      } else if (shiftNum === 2) {
        tonnageKg = tonnageReport.total.shift2Tonnage;
        pallets = tonnageReport.total.shift2Pallets;
      } else if (shiftNum === 3) {
        tonnageKg = tonnageReport.total.shift3Tonnage;
        pallets = tonnageReport.total.shift3Pallets;
      }
    }

    const tonnageTon = tonnageKg / 1000;
    const tonnageLbs = Math.round(tonnageKg * LBS_CONVERSION_FACTOR * 100) / 100;
    const opahLbsPerHour = opahWorkingHours > 0
      ? Math.round(((tonnageKg * LBS_CONVERSION_FACTOR) / opahWorkingHours) * 100) / 100
      : 0;

    const shiftLabel = shiftNum === 1
      ? 'กะ 1 (07:00 - 15:00)'
      : shiftNum === 2
      ? 'กะ 2 (15:00 - 23:00)'
      : 'กะ 3 (23:00 - 07:00)';

    return {
      shift: shiftNum,
      shiftLabel,
      headcount,
      gyHeadcount: gyHc,
      contractorHeadcount: contHc,
      monthlyHeadcount,
      normalHours,
      otHours,
      grossHours,
      totalHours,
      gyTotalHours: gyTot,
      contractorTotalHours: contTot,
      monthlyHours,
      pdiDeductHours: shiftPdiDeduct,
      beadAddHours: shiftBeadAdd,
      opahWorkingHours,
      tonnageKg,
      tonnageTon: Math.round(tonnageTon * 1000) / 1000,
      tonnageLbs,
      pallets,
      opahLbsPerHour
    };
  });

  // 8. Department Breakdown (for backwards compatibility)
  const deptMap: Record<string, { isContractor: boolean; isMonthly?: boolean; isBead?: boolean; isExcluded6320?: boolean; headcount: number; normalHours: number; otHours: number; totalHours: number }> = {};

  records.forEach(r => {
    const isExcluded = isGyDept6320(r);
    const d = r.dept || 'ไม่ระบุแผนก (GY)';
    const nHours = r.normalWorkHours || 0;
    const otH = r.otHours || 0;
    const totH = nHours + otH;

    if (!deptMap[d]) {
      deptMap[d] = { isContractor: false, isExcluded6320: isExcluded, headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += nHours;
    deptMap[d].otHours += otH;
    deptMap[d].totalHours += totH;
  });

  rawContActive.forEach(r => {
    const isExcluded = isContDept6320(r);
    const isMonthlyCont = r.type === 'Salary' || (r as any).isMonthly;
    const code = (r.closing || r.department || 'MFG').trim();
    const loc = r.location ? ` (${r.location})` : '';
    const d = isMonthlyCont ? `Cont รายเดือน แผนก ${code}${loc}` : `Cont แผนก ${code}${loc}`;
    const nHours = r.normalHours || 0;
    const otH = r.otHours || 0;
    const totH = nHours + otH;

    if (!deptMap[d]) {
      deptMap[d] = { isContractor: true, isMonthly: isMonthlyCont, isExcluded6320: isExcluded, headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += nHours;
    deptMap[d].otHours += otH;
    deptMap[d].totalHours += totH;
  });

  if (monthlyStaff.count > 0) {
    const gyMonthlyKey = `พนักงานรายเดือน GY (Goodyear Monthly Staff - ${monthlyStaff.count} คน @ ${monthlyStaff.hoursPerPerson} ชม.)`;
    deptMap[gyMonthlyKey] = {
      isContractor: false,
      isMonthly: true,
      headcount: monthlyStaff.count,
      normalHours: monthlyStaff.totalHours,
      otHours: 0,
      totalHours: monthlyStaff.totalHours
    };
  }

  if (!hasScannedWasMonthly && fallbackWasCount > 0 && fallbackWasHours > 0) {
    const wasMonthlyKey = `พนักงานรายเดือน WAS (WAS Monthly Staff - ${fallbackWasCount} คน @ ${monthlyStaff.hoursPerPerson} ชม.)`;
    deptMap[wasMonthlyKey] = {
      isContractor: true,
      isMonthly: true,
      headcount: fallbackWasCount,
      normalHours: fallbackWasHours,
      otHours: 0,
      totalHours: fallbackWasHours
    };
  }

  if (beadAddHours > 0) {
    const beadKey = `B-end Bead (ชั่วโมงบวกเพิ่ม OPAH - Bead Component)`;
    deptMap[beadKey] = {
      isContractor: false,
      isMonthly: false,
      isBead: true,
      headcount: 0,
      normalHours: beadAddHours,
      otHours: 0,
      totalHours: beadAddHours
    };
  }

  if (bcaReductionHours > 0) {
    const bcaRedKey = `BCA -> Retread Transfer (หักงานผลิตให้ Retread - ${bcaReductionHours} ชม.)`;
    deptMap[bcaRedKey] = {
      isContractor: false,
      isMonthly: false,
      headcount: 0,
      normalHours: -bcaReductionHours,
      otHours: 0,
      totalHours: -bcaReductionHours
    };
  }

  if (bcaDevHours > 0) {
    const bcaDevKey = `BCA DEV Compound (หักชั่วโมง Development BCA - ${bcaDevHours} ชม.)`;
    deptMap[bcaDevKey] = {
      isContractor: false,
      isMonthly: false,
      headcount: 0,
      normalHours: -bcaDevHours,
      otHours: 0,
      totalHours: -bcaDevHours
    };
  }

  const departmentBreakdown: OhpaDeptMetrics[] = Object.entries(deptMap)
    .map(([dept, val]) => ({
      dept,
      isContractor: val.isContractor,
      isMonthly: val.isMonthly,
      isExcluded6320: val.isExcluded6320,
      headcount: val.headcount,
      normalHours: Math.round(val.normalHours * 10) / 10,
      otHours: Math.round(val.otHours * 10) / 10,
      totalHours: Math.round(val.totalHours * 10) / 10,
      percentageOfTotalHours: totalWorkingHours > 0
        ? Math.round((val.totalHours / totalWorkingHours) * 1000) / 10
        : 0
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  const mtd = calculateMtdSummary(
    productionDayFormatted,
    records,
    contractorRecords,
    tonnageReport,
    allScanPresets,
    contractorRecordsByDate,
    employeeMapping,
    dailyAdjustments,
    pdiBeadReport
  );

  return {
    productionDay: productionDayFormatted,
    totalEmployeesCount,
    totalNormalHours: Math.round(totalNormalHours * 10) / 10,
    totalOtHours: Math.round(totalOtHours * 10) / 10,
    totalWorkingHours: Math.round(totalWorkingHours * 10) / 10,

    pdiDeductHours: Math.round(pdiDeductHours * 10) / 10,
    beadAddHours: Math.round(beadAddHours * 10) / 10,
    bcaReductionHours: Math.round(bcaReductionHours * 10) / 10,
    bcaDevHours: Math.round(bcaDevHours * 10) / 10,
    opahWorkingHours: Math.round(opahWorkingHours * 10) / 10,

    gyEmployeesCount,
    gyNormalHours: Math.round(gyNormalHours * 10) / 10,
    gyOtHours: Math.round(gyOtHours * 10) / 10,
    gyTotalHours: Math.round(gyTotalHours * 10) / 10,
    gyOpahLbsPerHour,

    contractorEmployeesCount,
    contractorNormalHours: Math.round(contractorNormalHours * 10) / 10,
    contractorOtHours: Math.round(contractorOtHours * 10) / 10,
    contractorTotalHours: Math.round(contractorTotalHours * 10) / 10,
    contractorOpahLbsPerHour,

    monthlyStaff,

    excluded6320GyCount,
    excluded6320GyHours: Math.round(excluded6320GyHours * 10) / 10,
    excluded6320ContCount,
    excluded6320ContHours: Math.round(excluded6320ContHours * 10) / 10,

    totalTonnageKg,
    totalTonnageTon: Math.round(totalTonnageTon * 1000) / 1000,
    totalTonnageLbs,
    totalPallets,
    overallOpahLbsPerHour,
    shifts,
    areaBreakdown,
    departmentBreakdown,
    mtd
  };
}

