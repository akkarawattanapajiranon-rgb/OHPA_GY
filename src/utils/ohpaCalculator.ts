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
  let mtdOpahWorkingHours = 0;

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
    const pdiDeductHours = pdiBeadReport?.pdiDailyTotals?.[d] || 0;
    const beadAddHours = pdiBeadReport?.beadDailyTotals?.[d] || 0;
    const dayOpahHours = Math.max(0, dayTotalHours - pdiDeductHours + beadAddHours);

    mtdGyHours += gyHours;
    mtdContractorHours += contractorHours;
    mtdMonthlyHours += monthlyHours;
    mtdTotalHours += dayTotalHours;
    mtdPdiDeductHours += pdiDeductHours;
    mtdBeadAddHours += beadAddHours;
    mtdOpahWorkingHours += dayOpahHours;

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
      pdiDeductHours: Math.round(pdiDeductHours * 10) / 10,
      beadAddHours: Math.round(beadAddHours * 10) / 10,
      opahWorkingHours: Math.round(dayOpahHours * 10) / 10,
      cumulativeTotalHours: Math.round(mtdTotalHours * 10) / 10,
      cumulativeOpahWorkingHours: Math.round(mtdOpahWorkingHours * 10) / 10
    });
  }

  const LBS_FACTOR = 2.2046;
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

  return {
    targetDate: clean || `${String(targetDay).padStart(2, '0')}/${String(targetMonth).padStart(2, '0')}/${targetYear}`,
    daysCount: targetDay,
    mtdTotalHours: Math.round(mtdTotalHours * 10) / 10,
    mtdGyHours: Math.round(mtdGyHours * 10) / 10,
    mtdContractorHours: Math.round(mtdContractorHours * 10) / 10,
    mtdMonthlyHours: Math.round(mtdMonthlyHours * 10) / 10,
    mtdPdiDeductHours: Math.round(mtdPdiDeductHours * 10) / 10,
    mtdBeadAddHours: Math.round(mtdBeadAddHours * 10) / 10,
    mtdOpahWorkingHours: Math.round(mtdOpahWorkingHours * 10) / 10,
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
  dailyAdjustments: DailyAdjustmentRecord[] = [],
  pdiBeadReport: PdiBeadReport = DEFAULT_PDI_BEAD_REPORT
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

  // 4.1 PDI Deduct & B-end (Bead) Addition for OPAH
  const cleanDate = (productionDayFormatted || '').replace(/^[📅📄\s]*วันที่\s*/, '').trim();
  const dateParts = cleanDate.split(/[/.-]/);
  let targetDay = 14;
  if (dateParts.length === 3) {
    if (dateParts[2].length === 4) targetDay = parseInt(dateParts[0], 10) || 14;
    else if (dateParts[0].length === 4) targetDay = parseInt(dateParts[2], 10) || 14;
  }
  const pdiDeductHours = pdiBeadReport?.pdiDailyTotals?.[targetDay] || 0;
  const beadAddHours = pdiBeadReport?.beadDailyTotals?.[targetDay] || 0;
  const opahWorkingHours = Math.max(0, Math.round((totalWorkingHours - pdiDeductHours + beadAddHours) * 10) / 10);

  // 5. Tonnage & Pounds (lbs)
  const LBS_CONVERSION_FACTOR = 2.2046;
  const totalTonnageKg = tonnageReport?.total?.dailyTotalTonnage || 0;
  const totalTonnageTon = totalTonnageKg / 1000;
  const totalTonnageLbs = Math.round(totalTonnageKg * LBS_CONVERSION_FACTOR * 100) / 100;
  const totalPallets = tonnageReport?.total?.dailyTotalPallets || 0;

  // 6. OPAH Calculation: OPAH = (Stocking kg x 2.2046) / Net OPAH Working Hours (lbs/hr)
  const overallOpahLbsPerHour = opahWorkingHours > 0
    ? Math.round(((totalTonnageKg * LBS_CONVERSION_FACTOR) / opahWorkingHours) * 100) / 100
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

  // 8. Area Classification Helper (8 Exact User-Specified Areas)
  const classifyArea = (
    category?: string,
    dept?: string,
    costCenter?: string,
    pbu?: string,
    location?: string,
    closing?: string,
    isMonthly?: boolean
  ): { key: string; name: string; label: string; icon: string; order: number; headcountStandard: number; isExcluded6320?: boolean } => {
    if (isMonthly) {
      return {
        key: 'Non-MFG : Others',
        name: 'Non-MFG : Others (แผนก 1860 และส่วนสนับสนุน)',
        label: 'Others',
        icon: '📦',
        headcountStandard: 6,
        order: 8
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

    // 1. Bias Aero (121 คน): แผนก A5110, A5120, A5130
    if (
      ['A5110', 'A5120', 'A5130'].includes(code) ||
      c.includes('bias aero') ||
      (c.includes('aero') && !c.includes('radial') && !loc.includes('STA'))
    ) {
      return {
        key: 'Bias Aero',
        name: 'Bias Aero (แผนก A5110, A5120, A5130)',
        label: 'Bias Aero',
        icon: '✈️',
        headcountStandard: 121,
        order: 3
      };
    }

    // 2. Radial Aero (74 คน): แผนก S5110, S5120, S5130
    if (
      ['S5110', 'S5120', 'S5130'].includes(code) ||
      c.includes('radial aero') ||
      (c.includes('radial') && c.includes('aero')) ||
      loc.includes('STA')
    ) {
      return {
        key: 'Radial Aero',
        name: 'Radial Aero (แผนก S5110, S5120, S5130)',
        label: 'Radial Aero',
        icon: '🛫',
        headcountStandard: 74,
        order: 4
      };
    }

    // 3. BCA (208 คน): แผนก 3200, 3300, 3700, 4110, 4120, 4130, 4200, 4300
    if (
      ['3200', '3300', '3700', '4110', '4120', '4130', '4200', '4300'].includes(code) ||
      c.includes('bca') ||
      c.includes('banbury') ||
      c.includes('calender') ||
      c.includes('stock prep')
    ) {
      return {
        key: 'BCA',
        name: 'BCA (แผนก 3200, 3300, 3700, 4110, 4120, 4130, 4200, 4300)',
        label: 'BCA',
        icon: '🏢',
        headcountStandard: 208,
        order: 1
      };
    }

    // 4. Consumer (148 คน): แผนก 4140, 5110, 5120, 5130
    if (
      ['4140', '5110', '5120', '5130'].includes(code) ||
      c.includes('consumer')
    ) {
      return {
        key: 'Consumer',
        name: 'Consumer (แผนก 4140, 5110, 5120, 5130)',
        label: 'Consumer',
        icon: '🚗',
        headcountStandard: 148,
        order: 2
      };
    }

    // 5. Retread (71 คน): แผนก 6320 และส่วนงานหล่อดอกยาง
    if (
      code === '6320' ||
      c.includes('retread') ||
      loc.includes('RETREAD') ||
      d.includes('หล่อดอก')
    ) {
      return {
        key: 'Retread',
        name: 'Retread (แผนก 6320 และส่วนงานหล่อดอกยาง)',
        label: 'Retread (หล่อดอก)',
        icon: '🔄',
        headcountStandard: 71,
        order: 5,
        isExcluded6320: true
      };
    }

    // 6. Non-MFG : Engineering (65 คน): แผนก 1100, 1110, 1161, 1164, 1210, S1100
    if (
      ['1100', '1110', '1161', '1164', '1210', 'S1100'].includes(code) ||
      c.includes('engineering') ||
      loc.includes('ENG') ||
      c.includes('maintenance')
    ) {
      return {
        key: 'Non-MFG : Engineering',
        name: 'Non-MFG : Engineering (แผนก 1100, 1110, 1161, 1164, 1210, S1100)',
        label: 'Engineering',
        icon: '🔧',
        headcountStandard: 65,
        order: 6
      };
    }

    // 7. Non-MFG : Quality (57 คน): แผนก 1021, 1022, 1040, S1040
    if (
      ['1021', '1022', '1040', 'S1040'].includes(code) ||
      c.includes('quality') ||
      loc.includes('Q-TECH') ||
      loc.includes('QUALITY') ||
      c.includes('q-tech')
    ) {
      return {
        key: 'Non-MFG : Quality',
        name: 'Non-MFG : Quality (แผนก 1021, 1022, 1040, S1040)',
        label: 'Quality',
        icon: '🔬',
        headcountStandard: 57,
        order: 7
      };
    }

    // 8. Non-MFG : Others (6 คน): แผนก 1860 (และ 1850, 1200)
    return {
      key: 'Non-MFG : Others',
      name: 'Non-MFG : Others (แผนก 1860 และส่วนสนับสนุน)',
      label: 'Others',
      icon: '📦',
      headcountStandard: 6,
      order: 8
    };
  };

  // 9. Area Breakdown Map (8 Exact Categories)
  const areaMap: Record<string, {
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
    deptMap: Record<string, OhpaAreaDeptItem>;
  }> = {
    'BCA': {
      areaKey: 'BCA',
      areaName: 'BCA (แผนก 3200, 3300, 3700, 4110, 4120, 4130, 4200, 4300)',
      areaLabel: 'BCA',
      icon: '🏢',
      order: 1,
      headcountStandard: 208,
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
    'Consumer': {
      areaKey: 'Consumer',
      areaName: 'Consumer (แผนก 4140, 5110, 5120, 5130)',
      areaLabel: 'Consumer',
      icon: '🚗',
      order: 2,
      headcountStandard: 148,
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
    'Bias Aero': {
      areaKey: 'Bias Aero',
      areaName: 'Bias Aero (แผนก A5110, A5120, A5130)',
      areaLabel: 'Bias Aero',
      icon: '✈️',
      order: 3,
      headcountStandard: 121,
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
    'Radial Aero': {
      areaKey: 'Radial Aero',
      areaName: 'Radial Aero (แผนก S5110, S5120, S5130)',
      areaLabel: 'Radial Aero',
      icon: '🛫',
      order: 4,
      headcountStandard: 74,
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
    'Retread': {
      areaKey: 'Retread',
      areaName: 'Retread (แผนก 6320 และส่วนงานหล่อดอกยาง)',
      areaLabel: 'Retread (หล่อดอก)',
      icon: '🔄',
      order: 5,
      headcountStandard: 71,
      isExcluded6320: true,
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
    'Non-MFG : Engineering': {
      areaKey: 'Non-MFG : Engineering',
      areaName: 'Non-MFG : Engineering (แผนก 1100, 1110, 1161, 1164, 1210, S1100)',
      areaLabel: 'Engineering',
      icon: '🔧',
      order: 6,
      headcountStandard: 65,
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
    'Non-MFG : Quality': {
      areaKey: 'Non-MFG : Quality',
      areaName: 'Non-MFG : Quality (แผนก 1021, 1022, 1040, S1040)',
      areaLabel: 'Quality',
      icon: '🔬',
      order: 7,
      headcountStandard: 57,
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
    'Non-MFG : Others': {
      areaKey: 'Non-MFG : Others',
      areaName: 'Non-MFG : Others (แผนก 1860 และส่วนสนับสนุน)',
      areaLabel: 'Others',
      icon: '📦',
      order: 8,
      headcountStandard: 6,
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

  // 10. Process All Goodyear Records (Active + 6320) into Areas & Depts
  const deptMap: Record<string, { isContractor: boolean; isMonthly?: boolean; isExcluded6320?: boolean; headcount: number; normalHours: number; otHours: number; totalHours: number }> = {};

  records.forEach(r => {
    const isExcluded = isGyDept6320(r);
    const d = r.dept || 'ไม่ระบุแผนก (GY)';
    const nHours = r.normalWorkHours || 0;
    const otH = r.otHours || 0;
    const totH = nHours + otH;

    // Dept map
    if (!deptMap[d]) {
      deptMap[d] = { isContractor: false, isExcluded6320: isExcluded, headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += nHours;
    deptMap[d].otHours += otH;
    deptMap[d].totalHours += totH;

    // Area map
    const areaInfo = classifyArea(r.category, r.dept, r.costCenter, '', '', '');
    const a = areaMap[areaInfo.key] || areaMap['Non-MFG : Others'];
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

  // 11. Process All Contractor Records (Active + 6320) into Areas & Depts (separated by exact department)
  rawContActive.forEach(r => {
    const isExcluded = isContDept6320(r);
    const code = (r.closing || r.department || 'MFG').trim();
    const loc = r.location ? ` (${r.location})` : '';
    const d = `Cont แผนก ${code}${loc}`;
    const nHours = r.normalHours || 0;
    const otH = r.otHours || 0;
    const totH = nHours + otH;

    // Dept map
    if (!deptMap[d]) {
      deptMap[d] = { isContractor: true, isExcluded6320: isExcluded, headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += nHours;
    deptMap[d].otHours += otH;
    deptMap[d].totalHours += totH;

    // Area map
    const areaInfo = classifyArea('', r.department, r.closing, '', r.location, r.closing);
    const a = areaMap[areaInfo.key] || areaMap['Non-MFG : Others'];
    a.contHc++;
    a.contNormal += nHours;
    a.contOt += otH;

    const deptKey = `Cont: ${code}${loc}`;
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

    const aOther = areaMap['Non-MFG : Others'];
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
        headcountStandard: a.headcountStandard,
        isExcluded6320: a.isExcluded6320,
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
        percentageOfTotalHours: totalWorkingHours > 0 && !a.isExcluded6320
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

