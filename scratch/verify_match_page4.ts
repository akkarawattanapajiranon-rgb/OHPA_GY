import { defaultScanPresets } from '../src/data/default_scan_record';
import { defaultContractorRecordsByDate } from '../src/data/default_contractor_data';
import { defaultEmployeeMapping } from '../src/data/default_attendance_data';
import { calculateArea5DailyMetrics, getMonthlyStaffMetrics } from '../src/utils/ohpaCalculator';

const preset = defaultScanPresets[0]; // 01/09/2026
const contRecords = defaultContractorRecordsByDate[preset.dateFormatted]?.records || [];
const monthlyMetrics = getMonthlyStaffMetrics(preset.dateFormatted);

const p4Metrics = calculateArea5DailyMetrics(
  preset.records,
  contRecords,
  monthlyMetrics,
  0,
  {},
  defaultEmployeeMapping,
  preset.dateFormatted,
  defaultScanPresets,
  defaultContractorRecordsByDate,
  []
);

console.log('=== PAGE 4 AREA 5 METRICS ===');
console.log('BCA: HC =', p4Metrics.bca.headcountScanned, ', Normal =', p4Metrics.bca.normalHours, ', OT =', p4Metrics.bca.otHours, ', Base =', p4Metrics.bca.baseHours);
console.log('Consumer: HC =', p4Metrics.consumer.headcountScanned, ', Normal =', p4Metrics.consumer.normalHours, ', OT =', p4Metrics.consumer.otHours, ', Base =', p4Metrics.consumer.baseHours);
console.log('Bias Aero: HC =', p4Metrics.biasAero.headcountScanned, ', Normal =', p4Metrics.biasAero.normalHours, ', OT =', p4Metrics.biasAero.otHours, ', Base =', p4Metrics.biasAero.baseHours);
console.log('Radial Aero: HC =', p4Metrics.radialAero.headcountScanned, ', Normal =', p4Metrics.radialAero.normalHours, ', OT =', p4Metrics.radialAero.otHours, ', Base =', p4Metrics.radialAero.baseHours);
console.log('Total Aviation: HC =', p4Metrics.totalAviation.headcountScanned, ', Normal =', p4Metrics.totalAviation.normalHours, ', OT =', p4Metrics.totalAviation.otHours, ', Base =', p4Metrics.totalAviation.baseHours);
console.log('Retread: HC =', p4Metrics.retread.headcountScanned, ', Normal =', p4Metrics.retread.normalHours, ', OT =', p4Metrics.retread.otHours, ', Base =', p4Metrics.retread.baseHours);
console.log('Grand Total: HC =', p4Metrics.grandTotal.headcountScanned, ', Normal =', p4Metrics.grandTotal.normalHours, ', OT =', p4Metrics.grandTotal.otHours, ', Base =', p4Metrics.grandTotal.baseHours);
