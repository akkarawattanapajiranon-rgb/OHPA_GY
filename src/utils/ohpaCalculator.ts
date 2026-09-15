import { ParsedShiftRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { StockingTonnageReport, OhpaSummary, OhpaShiftMetrics, OhpaDeptMetrics } from '../types/ohpa';

export function calculateOhpaSummary(
  records: ParsedShiftRecord[],
  contractorRecords: ContractorScanRecord[] = [],
  tonnageReport: StockingTonnageReport | null,
  productionDayFormatted: string
): OhpaSummary {
  // 1. Goodyear Stats
  const gyEmployeesCount = records.length;
  const gyNormalHours = records.reduce((sum, r) => sum + (r.normalWorkHours || 0), 0);
  const gyOtHours = records.reduce((sum, r) => sum + (r.otHours || 0), 0);
  const gyTotalHours = gyNormalHours + gyOtHours;

  // 2. Contractor Stats
  const activeContractorRecords = contractorRecords.filter(r => r.hasScannedIn || r.totalHours > 0);
  const contractorEmployeesCount = activeContractorRecords.length;
  const contractorNormalHours = activeContractorRecords.reduce((sum, r) => sum + (r.normalHours || 0), 0);
  const contractorOtHours = activeContractorRecords.reduce((sum, r) => sum + (r.otHours || 0), 0);
  const contractorTotalHours = contractorNormalHours + contractorOtHours;

  // 3. Grand Total (GY + Contractor)
  const totalEmployeesCount = gyEmployeesCount + contractorEmployeesCount;
  const totalNormalHours = gyNormalHours + contractorNormalHours;
  const totalOtHours = gyOtHours + contractorOtHours;
  const totalWorkingHours = gyTotalHours + contractorTotalHours;

  // 4. Tonnage & Pounds (lbs)
  const LBS_CONVERSION_FACTOR = 2.2046;
  const totalTonnageKg = tonnageReport?.total?.dailyTotalTonnage || 0;
  const totalTonnageTon = totalTonnageKg / 1000;
  const totalTonnageLbs = Math.round(totalTonnageKg * LBS_CONVERSION_FACTOR * 100) / 100;
  const totalPallets = tonnageReport?.total?.dailyTotalPallets || 0;

  // 5. OPAH Calculation: OPAH = (Stocking kg x 2.2046) / Total working hour (lbs/hr)
  const overallOpahLbsPerHour = totalWorkingHours > 0
    ? Math.round(((totalTonnageKg * LBS_CONVERSION_FACTOR) / totalWorkingHours) * 100) / 100
    : 0;

  const gyOpahLbsPerHour = gyTotalHours > 0
    ? Math.round(((totalTonnageKg * LBS_CONVERSION_FACTOR) / gyTotalHours) * 100) / 100
    : 0;

  const contractorOpahLbsPerHour = contractorTotalHours > 0
    ? Math.round(((totalTonnageKg * LBS_CONVERSION_FACTOR) / contractorTotalHours) * 100) / 100
    : 0;

  // 6. Shift Breakdown (Combining GY + Contractor for each shift)
  const shiftList: (1 | 2 | 3)[] = [1, 2, 3];
  const shifts: OhpaShiftMetrics[] = shiftList.map(shiftNum => {
    // GY records for this shift
    const gyShiftRecs = records.filter(r => r.shift === shiftNum);
    const gyHc = gyShiftRecs.length;
    const gyNorm = gyShiftRecs.reduce((sum, r) => sum + (r.normalWorkHours || 0), 0);
    const gyOt = gyShiftRecs.reduce((sum, r) => sum + (r.otHours || 0), 0);
    const gyTot = gyNorm + gyOt;

    // Contractor records for this shift
    const contShiftRecs = activeContractorRecords.filter(r => r.shiftNumber === shiftNum);
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

  // 7. Department Breakdown (GY Departments + Contractor Departments)
  const deptMap: Record<string, { isContractor: boolean; headcount: number; normalHours: number; otHours: number; totalHours: number }> = {};

  // GY Depts
  records.forEach(r => {
    const d = r.dept || 'ไม่ระบุแผนก (GY)';
    if (!deptMap[d]) {
      deptMap[d] = { isContractor: false, headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += (r.normalWorkHours || 0);
    deptMap[d].otHours += (r.otHours || 0);
    deptMap[d].totalHours += ((r.normalWorkHours || 0) + (r.otHours || 0));
  });

  // Contractor Depts
  activeContractorRecords.forEach(r => {
    const d = `Contractor WAS (${r.location || r.closing || 'MFG'})`;
    if (!deptMap[d]) {
      deptMap[d] = { isContractor: true, headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += (r.normalHours || 0);
    deptMap[d].otHours += (r.otHours || 0);
    deptMap[d].totalHours += ((r.normalHours || 0) + (r.otHours || 0));
  });

  const departmentBreakdown: OhpaDeptMetrics[] = Object.entries(deptMap)
    .map(([dept, val]) => ({
      dept,
      isContractor: val.isContractor,
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

    totalTonnageKg,
    totalTonnageTon: Math.round(totalTonnageTon * 1000) / 1000,
    totalTonnageLbs,
    totalPallets,
    overallOpahLbsPerHour,
    shifts,
    departmentBreakdown
  };
}
