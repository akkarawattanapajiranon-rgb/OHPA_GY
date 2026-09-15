import { ParsedShiftRecord } from '../types/attendance';
import { StockingTonnageReport, OhpaSummary, OhpaShiftMetrics, OhpaDeptMetrics } from '../types/ohpa';

export function calculateOhpaSummary(
  records: ParsedShiftRecord[],
  tonnageReport: StockingTonnageReport | null,
  productionDayFormatted: string
): OhpaSummary {
  const totalEmployeesCount = records.length;
  const totalNormalHours = records.reduce((sum, r) => sum + (r.normalWorkHours || 0), 0);
  const totalOtHours = records.reduce((sum, r) => sum + (r.otHours || 0), 0);
  const totalWorkingHours = totalNormalHours + totalOtHours;

  const totalTonnageKg = tonnageReport?.total?.dailyTotalTonnage || 0;
  const totalTonnageTon = totalTonnageKg / 1000;
  const totalPallets = tonnageReport?.total?.dailyTotalPallets || 0;

  const overallOhpaHoursPerTon = totalTonnageTon > 0
    ? Math.round((totalWorkingHours / totalTonnageTon) * 100) / 100
    : 0;

  const overallOhpaHoursPerPallet = totalPallets > 0
    ? Math.round((totalWorkingHours / totalPallets) * 100) / 100
    : 0;

  // Shift Breakdown
  const shiftList: (1 | 2 | 3)[] = [1, 2, 3];
  const shifts: OhpaShiftMetrics[] = shiftList.map(shiftNum => {
    const shiftRecords = records.filter(r => r.shift === shiftNum);
    const headcount = shiftRecords.length;
    const normalHours = shiftRecords.reduce((sum, r) => sum + (r.normalWorkHours || 0), 0);
    const otHours = shiftRecords.reduce((sum, r) => sum + (r.otHours || 0), 0);
    const totalHours = normalHours + otHours;

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
    const ohpaHoursPerTon = tonnageTon > 0
      ? Math.round((totalHours / tonnageTon) * 100) / 100
      : 0;

    const ohpaHoursPerPallet = pallets > 0
      ? Math.round((totalHours / pallets) * 100) / 100
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
      normalHours: Math.round(normalHours * 10) / 10,
      otHours: Math.round(otHours * 10) / 10,
      totalHours: Math.round(totalHours * 10) / 10,
      tonnageKg,
      tonnageTon: Math.round(tonnageTon * 1000) / 1000,
      pallets,
      ohpaHoursPerTon,
      ohpaHoursPerPallet
    };
  });

  // Department Breakdown
  const deptMap: Record<string, { headcount: number; normalHours: number; otHours: number; totalHours: number }> = {};
  records.forEach(r => {
    const d = r.dept || 'ไม่ระบุแผนก';
    if (!deptMap[d]) {
      deptMap[d] = { headcount: 0, normalHours: 0, otHours: 0, totalHours: 0 };
    }
    deptMap[d].headcount++;
    deptMap[d].normalHours += (r.normalWorkHours || 0);
    deptMap[d].otHours += (r.otHours || 0);
    deptMap[d].totalHours += ((r.normalWorkHours || 0) + (r.otHours || 0));
  });

  const departmentBreakdown: OhpaDeptMetrics[] = Object.entries(deptMap)
    .map(([dept, val]) => ({
      dept,
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
    totalTonnageKg,
    totalTonnageTon: Math.round(totalTonnageTon * 1000) / 1000,
    totalPallets,
    overallOhpaHoursPerTon,
    overallOhpaHoursPerPallet,
    shifts,
    departmentBreakdown
  };
}
