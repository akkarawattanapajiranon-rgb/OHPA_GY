import { ParsedShiftRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { StockingTonnageReport, OhpaSummary, OhpaShiftMetrics, OhpaDeptMetrics, MonthlyStaffMetrics } from '../types/ohpa';

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

export function calculateOhpaSummary(
  records: ParsedShiftRecord[],
  contractorRecords: ContractorScanRecord[] = [],
  tonnageReport: StockingTonnageReport | null,
  productionDayFormatted: string
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

  // 7. Shift Breakdown (Combining GY non-6320 + Contractor non-6320 for each shift)
  const shiftList: (1 | 2 | 3)[] = [1, 2, 3];
  const shifts: OhpaShiftMetrics[] = shiftList.map(shiftNum => {
    // GY records for this shift
    const gyShiftRecs = gyActiveRecords.filter(r => r.shift === shiftNum);
    const gyHc = gyShiftRecs.length;
    const gyNorm = gyShiftRecs.reduce((sum, r) => sum + (r.normalWorkHours || 0), 0);
    const gyOt = gyShiftRecs.reduce((sum, r) => sum + (r.otHours || 0), 0);
    const gyTot = gyNorm + gyOt;

    // Contractor records for this shift
    const contShiftRecs = contActiveRecords.filter(r => r.shiftNumber === shiftNum);
    const contHc = contShiftRecs.length;
    const contNorm = contShiftRecs.reduce((sum, r) => sum + (r.normalHours || 0), 0);
    const contOt = contShiftRecs.reduce((sum, r) => sum + (r.otHours || 0), 0);
    const contTot = contNorm + contOt;

    // Combined Shift Totals
    const headcount = gyHc + contHc;
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

  // 8. Department Breakdown
  const deptMap: Record<string, { isContractor: boolean; isMonthly?: boolean; isExcluded6320?: boolean; headcount: number; normalHours: number; otHours: number; totalHours: number }> = {};

  // GY Active Depts (non-6320)
  gyActiveRecords.forEach(r => {
    const d = r.dept || 'ไม่ระบุแผนก (GY)';
    if (!deptMap[d]) {
      deptMap[d] = { isContractor: false, headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += (r.normalWorkHours || 0);
    deptMap[d].otHours += (r.otHours || 0);
    deptMap[d].totalHours += ((r.normalWorkHours || 0) + (r.otHours || 0));
  });

  // Contractor Active Depts (non-6320)
  contActiveRecords.forEach(r => {
    const d = `Contractor WAS (${r.location || r.closing || 'MFG'})`;
    if (!deptMap[d]) {
      deptMap[d] = { isContractor: true, headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += (r.normalHours || 0);
    deptMap[d].otHours += (r.otHours || 0);
    deptMap[d].totalHours += ((r.normalHours || 0) + (r.otHours || 0));
  });

  // Add Monthly Staff row
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
    departmentBreakdown
  };
}

