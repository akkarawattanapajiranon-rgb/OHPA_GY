import { ParsedShiftRecord, EmployeeInfo, DailyAdjustmentRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { StockingTonnageReport, OhpaSummary, OhpaShiftMetrics, OhpaDeptMetrics, OhpaAreaMetrics, OhpaAreaDeptItem, MonthlyStaffMetrics, MtdOhpaSummary, DailyMtdItem } from '../types/ohpa';
import { processScanRecords } from './parser';

export function isGyDept6320(r: ParsedShiftRecord): boolean {
  const cc = (r.costCenter || '').trim();
  const d = (r.dept || '').trim();
  const cat = (r.category || '').trim().toLowerCase();
  const m = (r.machine || '').trim().toLowerCase();
  return cc === '6320' || d.includes('6320') || cat === 'retread' || m.includes('buffing') || m.includes('retread');
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

  return {
    count,
    hoursPerPerson,
    totalHours,
    dayName: dayNames[dayOfWeek]
  };
}

export function calculateMtdSummary(
  targetDateStr: string,
  currentGyRecords: ParsedShiftRecord[],
  currentContRecords: ContractorScanRecord[],
  tonnageReport: StockingTonnageReport | null,
  allScanPresets: { name: string; dateFormatted?: string; content: string }[] = [],
  contractorRecordsByDate: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }> = {},
  employeeMapping: Record<string, EmployeeInfo> = {},
  dailyAdjustments: DailyAdjustmentRecord[] = []
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

  const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

  for (let d = 1; d <= targetDay; d++) {
    const dPad = String(d).padStart(2, '0');
    const mPad = String(targetMonth).padStart(2, '0');
    const dayDateStr = `${dPad}/${mPad}/${targetYear}`;
    const dt = new Date(targetYear, targetMonth - 1, d);
    const dayOfWeek = dt.getDay();
    const dayName = dayNames[dayOfWeek];

    let gyHeadcount = 0;
    let gyHours = 0;

    let contractorHeadcount = 0;
    let contractorHours = 0;

    // 1. Goodyear Data
    if (d === targetDay) {
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
        const active = parsed.records.filter(r => !isGyDept6320(r));
        gyHeadcount = active.length;
        gyHours = active.reduce((sum, r) => sum + (r.normalWorkHours || 0) + (r.otHours || 0), 0);
      }
    }

    // 2. Contractor Data
    if (d === targetDay) {
      const active = currentContRecords.filter(r => (r.hasScannedIn || r.totalHours > 0) && !isContDept6320(r));
      contractorHeadcount = active.length;
      contractorHours = active.reduce((sum, r) => sum + (r.normalHours || 0) + (r.otHours || 0), 0);
    } else {
      const contEntry = contractorRecordsByDate[`${d}/${targetMonth}/${targetYear}`] ||
        contractorRecordsByDate[dayDateStr] ||
        contractorRecordsByDate[`${targetYear}-${mPad}-${dPad}`];

      if (contEntry && contEntry.records) {
        const active = contEntry.records.filter(r => (r.hasScannedIn || r.totalHours > 0) && !isContDept6320(r));
        contractorHeadcount = active.length;
        contractorHours = active.reduce((sum, r) => sum + (r.normalHours || 0) + (r.otHours || 0), 0);
      }
    }

    // 3. Monthly Staff Data
    const monthlyStaff = getMonthlyStaffMetrics(dayDateStr);
    const monthlyHours = monthlyStaff.totalHours;

    const dayTotalHours = gyHours + contractorHours + monthlyHours;

    mtdGyHours += gyHours;
    mtdContractorHours += contractorHours;
    mtdMonthlyHours += monthlyHours;
    mtdTotalHours += dayTotalHours;

    dailyItems.push({
      day: d,
      dateStr: dayDateStr,
      dayName,
      gyHeadcount,
      gyHours: Math.round(gyHours * 10) / 10,
      contractorHeadcount,
      contractorHours: Math.round(contractorHours * 10) / 10,
      monthlyHours: Math.round(monthlyHours * 10) / 10,
      totalHours: Math.round(dayTotalHours * 10) / 10,
      cumulativeTotalHours: Math.round(mtdTotalHours * 10) / 10
    });
  }

  const LBS_FACTOR = 2.2046;
  const mtdStockingKg = tonnageReport?.total?.mtdTonnage || (tonnageReport?.total?.dailyTotalTonnage ? tonnageReport.total.dailyTotalTonnage * targetDay : 0);
  const mtdStockingLbs = Math.round(mtdStockingKg * LBS_FACTOR * 100) / 100;
  const mtdStockingTon = Math.round((mtdStockingKg / 1000) * 1000) / 1000;
  const mtdPallets = tonnageReport?.total?.mtdPallets || 0;

  const mtdOpahLbsPerHour = mtdTotalHours > 0
    ? Math.round(((mtdStockingKg * LBS_FACTOR) / mtdTotalHours) * 100) / 100
    : 0;

  const mtdGyOpahLbsPerHour = mtdGyHours > 0
    ? Math.round(((mtdStockingKg * LBS_FACTOR) / mtdGyHours) * 100) / 100
    : 0;

  const mtdContractorOpahLbsPerHour = mtdContractorHours > 0
    ? Math.round(((mtdStockingKg * LBS_FACTOR) / mtdContractorHours) * 100) / 100
    : 0;

  return {
    targetDate: clean || `${String(targetDay).padStart(2, '0')}/${String(targetMonth).padStart(2, '0')}/${targetYear}`,
    daysCount: targetDay,
    mtdTotalHours: Math.round(mtdTotalHours * 10) / 10,
    mtdGyHours: Math.round(mtdGyHours * 10) / 10,
    mtdContractorHours: Math.round(mtdContractorHours * 10) / 10,
    mtdMonthlyHours: Math.round(mtdMonthlyHours * 10) / 10,
    mtdStockingKg,
    mtdStockingLbs,
    mtdStockingTon,
    mtdPallets,
    mtdOpahLbsPerHour,
    mtdGyOpahLbsPerHour,
    mtdContractorOpahLbsPerHour,
    dailyItems
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
  dailyAdjustments: DailyAdjustmentRecord[] = []
): OhpaSummary {
  // 1. Separate Department 6320 (Retread) from Goodyear
  const gyActiveRecords = records.filter(r => !isGyDept6320(r));
  const gy6320Records = records.filter(r => isGyDept6320(r));

  const gyEmployeesCount = gyActiveRecords.length;
  const gyNormalHours = gyActiveRecords.reduce((sum, r) => sum + (r.normalWorkHours || 0), 0);
  const gyOtHours = gyActiveRecords.reduce((sum, r) => sum + (r.otHours || 0), 0);
  const gyTotalHours = gyNormalHours + gyOtHours;

  const excluded6320GyCount = gy6320Records.length;
  const excluded6320GyHours = gy6320Records.reduce((sum, r) => sum + (r.normalWorkHours || 0) + (r.otHours || 0), 0);

  // 2. Separate Department 6320 (Retread) from Contractor
  const rawContActive = contractorRecords.filter(r => r.hasScannedIn || r.totalHours > 0);
  const contActiveRecords = rawContActive.filter(r => !isContDept6320(r));
  const cont6320Records = rawContActive.filter(r => isContDept6320(r));

  const contractorEmployeesCount = contActiveRecords.length;
  const contractorNormalHours = contActiveRecords.reduce((sum, r) => sum + (r.normalHours || 0), 0);
  const contractorOtHours = contActiveRecords.reduce((sum, r) => sum + (r.otHours || 0), 0);
  const contractorTotalHours = contractorNormalHours + contractorOtHours;

  const excluded6320ContCount = cont6320Records.length;
  const excluded6320ContHours = cont6320Records.reduce((sum, r) => sum + (r.normalHours || 0) + (r.otHours || 0), 0);

  // 3. Monthly Staff (62 persons: Mon-Fri 8h, Sat 4h, Sun 0h)
  const monthlyStaff = getMonthlyStaffMetrics(productionDayFormatted);

  // 4. Grand Total (GY active + Contractor active + Monthly staff)
  const totalEmployeesCount = gyEmployeesCount + contractorEmployeesCount + monthlyStaff.count;
  const totalNormalHours = gyNormalHours + contractorNormalHours + monthlyStaff.totalHours;
  const totalOtHours = gyOtHours + contractorOtHours;
  const totalWorkingHours = gyTotalHours + contractorTotalHours + monthlyStaff.totalHours;

  // 5. Tonnage & Pounds (lbs)
  const LBS_CONVERSION_FACTOR = 2.2046;
  const totalTonnageKg = tonnageReport?.total?.dailyTotalTonnage || 0;
  const totalTonnageTon = totalTonnageKg / 1000;
  const totalTonnageLbs = Math.round(totalTonnageKg * LBS_CONVERSION_FACTOR * 100) / 100;
  const totalPallets = tonnageReport?.total?.dailyTotalPallets || 0;

  // 6. OPAH Calculation: OPAH = (Stocking kg x 2.2046) / Total working hour (lbs/hr)
  const overallOpahLbsPerHour = totalWorkingHours > 0
    ? Math.round(((totalTonnageKg * LBS_CONVERSION_FACTOR) / totalWorkingHours) * 100) / 100
    : 0;

  const gyOpahLbsPerHour = gyTotalHours > 0
    ? Math.round(((totalTonnageKg * LBS_CONVERSION_FACTOR) / gyTotalHours) * 100) / 100
    : 0;

  const contractorOpahLbsPerHour = contractorTotalHours > 0
    ? Math.round(((totalTonnageKg * LBS_CONVERSION_FACTOR) / contractorTotalHours) * 100) / 100
    : 0;

  // 7. Shift Breakdown (Allocating working hours & OT to the actual shift operating time window)
  // Shift 1 window: 07:00 - 15:00
  // Shift 2 window: 15:00 - 23:00 (Includes Shift 1 OT 15:00-23:00, Shift 3 pre-OT/เข้าทุ่ม 19:00-23:00, Cont Day OT 15:00-19:00, Cont Night OT 19:00-23:00)
  // Shift 3 window: 23:00 - 07:00 (Includes Shift 2 post-OT past 23:00, Shift 1 extended OT past 23:00)
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

  // Goodyear Allocation
  gyActiveRecords.forEach(r => {
    const s = r.shift;
    const norm = r.normalWorkHours || 0;
    const ot = r.otHours || 0;

    if (s === 1) {
      shiftAlloc[1].gyNorm += norm;
      shiftAlloc[1].gyHc++;
      if (ot > 0) {
        if (r.empId === '01454' || r.empId === '1454') {
          // Special 01454: Pre-shift morning OT (03:00 - 07:00) credits to Shift 1
          shiftAlloc[1].gyOt += ot;
        } else {
          // Standard Shift 1 Post-shift OT: 15:00 - 23:00 goes to Shift 2, excess goes to Shift 3
          const s2Ot = Math.min(8, ot);
          const s3Ot = Math.max(0, ot - 8);
          shiftAlloc[2].gyOt += s2Ot;
          shiftAlloc[3].gyOt += s3Ot;
        }
      }
    } else if (s === 2) {
      shiftAlloc[2].gyNorm += norm;
      shiftAlloc[2].gyHc++;
      if (ot > 0) {
        if (r.isPreShiftReliefOt) {
          // Pre-shift break relief (11:00 - 15:00) goes to Shift 1
          shiftAlloc[1].gyOt += ot;
        } else {
          // Post-shift OT (23:00 - 07:00) goes to Shift 3
          shiftAlloc[3].gyOt += ot;
        }
      }
    } else if (s === 3) {
      shiftAlloc[3].gyNorm += norm;
      shiftAlloc[3].gyHc++;
      if (ot > 0) {
        const inH = r.inTime ? (typeof r.inTime.getHours === 'function' ? r.inTime.getHours() : new Date(r.inTime).getHours()) : 23;
        if (inH >= 17 && inH < 22) {
          // Pre-shift OT / เข้าทุ่ม (17:30 - 23:00) goes to Shift 2
          shiftAlloc[2].gyOt += ot;
        } else {
          // Post-shift OT (07:00 - 15:00) goes to Shift 1
          shiftAlloc[1].gyOt += ot;
        }
      }
    }
  });

  // Contractor Allocation
  contActiveRecords.forEach(r => {
    const s = r.shiftNumber;
    const norm = r.normalHours || 0;
    const ot = r.otHours || 0;

    if (s === 1) {
      shiftAlloc[1].contNorm += norm;
      shiftAlloc[1].contHc++;
      if (ot > 0) {
        // Day shift OT (15:00 - 19:00 / 23:00) goes to Shift 2 window
        const s2Ot = Math.min(8, ot);
        const s3Ot = Math.max(0, ot - 8);
        shiftAlloc[2].contOt += s2Ot;
        shiftAlloc[3].contOt += s3Ot;
      }
    } else if (s === 2) {
      shiftAlloc[2].contNorm += norm;
      shiftAlloc[2].contOt += ot;
      shiftAlloc[2].contHc++;
    } else if (s === 3) {
      shiftAlloc[3].contNorm += norm;
      shiftAlloc[3].contHc++;
      if (ot > 0) {
        // Night shift pre-OT / เข้าทุ่ม (19:00 - 23:00 or 15:00 - 23:00) goes to Shift 2 window
        shiftAlloc[2].contOt += ot;
      }
    }
  });

  const shiftList: (1 | 2 | 3)[] = [1, 2, 3];
  const shifts: OhpaShiftMetrics[] = shiftList.map(shiftNum => {
    const alloc = shiftAlloc[shiftNum];
    const gyHc = alloc.gyHc;
    const contHc = alloc.contHc;
    const headcount = gyHc + contHc;

    const gyNorm = alloc.gyNorm;
    const gyOt = alloc.gyOt;
    const gyTot = gyNorm + gyOt;

    const contNorm = alloc.contNorm;
    const contOt = alloc.contOt;
    const contTot = contNorm + contOt;

    const normalHours = gyNorm + contNorm;
    const otHours = gyOt + contOt;
    const totalHours = gyTot + contTot;

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
    const opahLbsPerHour = totalHours > 0
      ? Math.round(((tonnageKg * LBS_CONVERSION_FACTOR) / totalHours) * 100) / 100
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
      normalHours: Math.round(normalHours * 10) / 10,
      otHours: Math.round(otHours * 10) / 10,
      totalHours: Math.round(totalHours * 10) / 10,
      gyTotalHours: Math.round(gyTot * 10) / 10,
      contractorTotalHours: Math.round(contTot * 10) / 10,
      tonnageKg,
      tonnageTon: Math.round(tonnageTon * 1000) / 1000,
      tonnageLbs,
      pallets,
      opahLbsPerHour
    };
  });

  // 8. Area Classification Helper
  const classifyArea = (
    category?: string,
    dept?: string,
    costCenter?: string,
    pbu?: string,
    location?: string,
    closing?: string,
    isMonthly?: boolean
  ): { key: 'BCA' | 'Consumer' | 'Aero' | 'Eng' | 'อื่นๆ'; name: string; label: string; icon: string; order: number } => {
    if (isMonthly) {
      return {
        key: 'อื่นๆ',
        name: 'อื่นๆ (Quality / Retread / Support & Staff)',
        label: 'อื่นๆ / สนับสนุน',
        icon: '📦',
        order: 5
      };
    }

    const cat = (category || '').toLowerCase();
    const d = (dept || costCenter || closing || '').toUpperCase();
    const p = (pbu || '').toLowerCase();
    const loc = (location || '').toUpperCase();

    // 1. BCA
    if (
      cat.includes('bca') ||
      d.includes('3200') ||
      d.includes('3300') ||
      p.includes('bca') ||
      p.includes('shared') ||
      loc.includes('BTB') ||
      loc.includes('BCA')
    ) {
      return {
        key: 'BCA',
        name: 'BCA (Banbury / Mixing / Calender / Extruder)',
        label: 'BCA (เตรียมวัตถุดิบ)',
        icon: '🏢',
        order: 1
      };
    }

    // 2. Consumer
    if (
      cat.includes('consumer') ||
      d.includes('5110') ||
      d.includes('5120') ||
      d.includes('5130') ||
      d.includes('4110') ||
      d.includes('4120') ||
      d.includes('4130') ||
      d.includes('4300') ||
      d.includes('4200') ||
      loc.includes('BTC') ||
      loc.includes('CONSUMER')
    ) {
      return {
        key: 'Consumer',
        name: 'Consumer (Building / Curing / Final Finish)',
        label: 'Consumer (ยางรถยนต์นั่ง)',
        icon: '🚗',
        order: 2
      };
    }

    // 3. Aero
    if (
      cat.includes('aero') ||
      d.startsWith('A') ||
      d.includes('1850') ||
      p.includes('aero') ||
      loc.includes('BTA') ||
      loc.includes('AERO')
    ) {
      return {
        key: 'Aero',
        name: 'Aero (Aviation Radial & Bias Tire)',
        label: 'Aero (ยางเครื่องบิน)',
        icon: '✈️',
        order: 3
      };
    }

    // 4. Engineering
    if (
      cat.includes('engineering') ||
      d.includes('1110') ||
      d.includes('1120') ||
      d.includes('1100') ||
      d.includes('1130') ||
      d.includes('1140') ||
      d.includes('1200') ||
      loc.includes('ENG')
    ) {
      return {
        key: 'Eng',
        name: 'Engineering & Maintenance (ซ่อมบำรุง / วิศวกรรม)',
        label: 'Engineering (วิศวกรรม)',
        icon: '🔧',
        order: 4
      };
    }

    // 5. อื่นๆ (Others)
    return {
      key: 'อื่นๆ',
      name: 'อื่นๆ (Quality / Retread / Warehouse / Support)',
      label: 'อื่นๆ / สนับสนุน',
      icon: '📦',
      order: 5
    };
  };

  // 9. Area Breakdown Map
  const areaMap: Record<string, {
    areaKey: string;
    areaName: string;
    areaLabel: string;
    icon: string;
    order: number;
    gyHc: number;
    contHc: number;
    monthlyHc: number;
    gyNormal: number;
    gyOt: number;
    contNormal: number;
    contOt: number;
    monthlyNormal: number;
    deptMap: Record<string, OhpaAreaDeptItem>;
  }> = {
    BCA: {
      areaKey: 'BCA',
      areaName: 'BCA (Banbury / Mixing / Calender / Extruder)',
      areaLabel: 'BCA (เตรียมวัตถุดิบ)',
      icon: '🏢',
      order: 1,
      gyHc: 0,
      contHc: 0,
      monthlyHc: 0,
      gyNormal: 0,
      gyOt: 0,
      contNormal: 0,
      contOt: 0,
      monthlyNormal: 0,
      deptMap: {}
    },
    Consumer: {
      areaKey: 'Consumer',
      areaName: 'Consumer (Building / Curing / Final Finish)',
      areaLabel: 'Consumer (ยางรถยนต์นั่ง)',
      icon: '🚗',
      order: 2,
      gyHc: 0,
      contHc: 0,
      monthlyHc: 0,
      gyNormal: 0,
      gyOt: 0,
      contNormal: 0,
      contOt: 0,
      monthlyNormal: 0,
      deptMap: {}
    },
    Aero: {
      areaKey: 'Aero',
      areaName: 'Aero (Aviation Radial & Bias Tire)',
      areaLabel: 'Aero (ยางเครื่องบิน)',
      icon: '✈️',
      order: 3,
      gyHc: 0,
      contHc: 0,
      monthlyHc: 0,
      gyNormal: 0,
      gyOt: 0,
      contNormal: 0,
      contOt: 0,
      monthlyNormal: 0,
      deptMap: {}
    },
    Eng: {
      areaKey: 'Eng',
      areaName: 'Engineering & Maintenance (ซ่อมบำรุง / วิศวกรรม)',
      areaLabel: 'Engineering (วิศวกรรม)',
      icon: '🔧',
      order: 4,
      gyHc: 0,
      contHc: 0,
      monthlyHc: 0,
      gyNormal: 0,
      gyOt: 0,
      contNormal: 0,
      contOt: 0,
      monthlyNormal: 0,
      deptMap: {}
    },
    'อื่นๆ': {
      areaKey: 'อื่นๆ',
      areaName: 'อื่นๆ (Quality / Retread / Warehouse / Support)',
      areaLabel: 'อื่นๆ / สนับสนุน',
      icon: '📦',
      order: 5,
      gyHc: 0,
      contHc: 0,
      monthlyHc: 0,
      gyNormal: 0,
      gyOt: 0,
      contNormal: 0,
      contOt: 0,
      monthlyNormal: 0,
      deptMap: {}
    }
  };

  // 10. Process GY Active Records into Areas & Depts
  const deptMap: Record<string, { isContractor: boolean; isMonthly?: boolean; isExcluded6320?: boolean; headcount: number; normalHours: number; otHours: number; totalHours: number }> = {};

  gyActiveRecords.forEach(r => {
    const d = r.dept || 'ไม่ระบุแผนก (GY)';
    const nHours = r.normalWorkHours || 0;
    const otH = r.otHours || 0;
    const totH = nHours + otH;

    // Dept map
    if (!deptMap[d]) {
      deptMap[d] = { isContractor: false, headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += nHours;
    deptMap[d].otHours += otH;
    deptMap[d].totalHours += totH;

    // Area map
    const areaInfo = classifyArea(r.category, r.dept, r.costCenter, '', '', '');
    const a = areaMap[areaInfo.key] || areaMap['อื่นๆ'];
    a.gyHc++;
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
    a.deptMap[deptKey].headcount++;
    a.deptMap[deptKey].normalHours += nHours;
    a.deptMap[deptKey].otHours += otH;
    a.deptMap[deptKey].totalHours += totH;
  });

  // 11. Process Contractor Active Records into Areas & Depts
  contActiveRecords.forEach(r => {
    const d = `Contractor WAS (${r.location || r.closing || 'MFG'})`;
    const nHours = r.normalHours || 0;
    const otH = r.otHours || 0;
    const totH = nHours + otH;

    // Dept map
    if (!deptMap[d]) {
      deptMap[d] = { isContractor: true, headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += nHours;
    deptMap[d].otHours += otH;
    deptMap[d].totalHours += totH;

    // Area map
    const areaInfo = classifyArea('', r.department, r.closing, '', r.location, r.closing);
    const a = areaMap[areaInfo.key] || areaMap['อื่นๆ'];
    a.contHc++;
    a.contNormal += nHours;
    a.contOt += otH;

    const deptKey = `Cont: ${d}`;
    if (!a.deptMap[deptKey]) {
      a.deptMap[deptKey] = {
        dept: d,
        isContractor: true,
        isMonthly: false,
        headcount: 0,
        normalHours: 0,
        otHours: 0,
        totalHours: 0
      };
    }
    a.deptMap[deptKey].headcount++;
    a.deptMap[deptKey].normalHours += nHours;
    a.deptMap[deptKey].otHours += otH;
    a.deptMap[deptKey].totalHours += totH;
  });

  // 12. Add Monthly Staff
  if (monthlyStaff.count > 0) {
    const monthlyKey = `พนักงานรายเดือน (Monthly Staff - 62 คน @ ${monthlyStaff.hoursPerPerson} ชม.)`;
    deptMap[monthlyKey] = {
      isContractor: false,
      isMonthly: true,
      headcount: monthlyStaff.count,
      normalHours: monthlyStaff.totalHours,
      otHours: 0,
      totalHours: monthlyStaff.totalHours
    };

    const aOther = areaMap['อื่นๆ'];
    aOther.monthlyHc = monthlyStaff.count;
    aOther.monthlyNormal = monthlyStaff.totalHours;
    aOther.deptMap['Monthly Staff'] = {
      dept: monthlyKey,
      isContractor: false,
      isMonthly: true,
      headcount: monthlyStaff.count,
      normalHours: monthlyStaff.totalHours,
      otHours: 0,
      totalHours: monthlyStaff.totalHours
    };
  }

  // 13. Build final areaBreakdown list
  const areaBreakdown: OhpaAreaMetrics[] = Object.values(areaMap)
    .map(a => {
      const normalH = a.gyNormal + a.contNormal + a.monthlyNormal;
      const otH = a.gyOt + a.contOt;
      const totH = normalH + otH;
      const totHc = a.gyHc + a.contHc + a.monthlyHc;
      const gyTot = a.gyNormal + a.gyOt;
      const contTot = a.contNormal + a.contOt;

      const subDepts = Object.values(a.deptMap)
        .map(d => ({
          ...d,
          normalHours: Math.round(d.normalHours * 10) / 10,
          otHours: Math.round(d.otHours * 10) / 10,
          totalHours: Math.round(d.totalHours * 10) / 10
        }))
        .sort((x, y) => y.totalHours - x.totalHours);

      return {
        areaKey: a.areaKey,
        areaName: a.areaName,
        areaLabel: a.areaLabel,
        icon: a.icon,
        order: a.order,
        totalHeadcount: totHc,
        gyHeadcount: a.gyHc,
        contractorHeadcount: a.contHc,
        monthlyHeadcount: a.monthlyHc > 0 ? a.monthlyHc : undefined,
        normalHours: Math.round(normalH * 10) / 10,
        otHours: Math.round(otH * 10) / 10,
        totalHours: Math.round(totH * 10) / 10,
        gyNormalHours: Math.round(a.gyNormal * 10) / 10,
        gyOtHours: Math.round(a.gyOt * 10) / 10,
        gyTotalHours: Math.round(gyTot * 10) / 10,
        contractorNormalHours: Math.round(a.contNormal * 10) / 10,
        contractorOtHours: Math.round(a.contOt * 10) / 10,
        contractorTotalHours: Math.round(contTot * 10) / 10,
        monthlyHours: a.monthlyNormal > 0 ? Math.round(a.monthlyNormal * 10) / 10 : undefined,
        percentageOfTotalHours: totalWorkingHours > 0
          ? Math.round((totH / totalWorkingHours) * 1000) / 10
          : 0,
        departments: subDepts
      };
    })
    .sort((a, b) => a.order - b.order);

  // 14. Department Breakdown (for backwards compatibility)
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
    dailyAdjustments
  );

  return {
    productionDay: productionDayFormatted,
    totalEmployeesCount,
    totalNormalHours: Math.round(totalNormalHours * 10) / 10,
    totalOtHours: Math.round(totalOtHours * 10) / 10,
    totalWorkingHours: Math.round(totalWorkingHours * 10) / 10,

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

