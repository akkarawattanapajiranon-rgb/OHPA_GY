import fs from 'fs';
import { processScanRecords, createPresetsFromScanFiles } from '../src/utils/parser';
import { calculateOhpaSummary } from '../src/utils/ohpaCalculator';
import { SCAN_FILE_PRESETS } from '../src/data/default_scan_record';
import { DEFAULT_CONTRACTOR_RECORDS_BY_DATE } from '../src/data/default_contractor_data';
import { DEFAULT_STOCKING_REPORTS } from '../src/data/default_stocking_reports';
import { DEFAULT_PDI_BEAD_REPORT } from '../src/data/default_pdi_bead';
import { DEFAULT_RETREAD_TONNAGE } from '../src/data/default_retread_tonnage';
import defaultEmpMappingRaw from '../src/data/default_emp_mapping.json';
import defaultAdjustmentsRaw from '../src/data/default_adjustments.json';

// Test with Day 18 active date
const p18 = SCAN_FILE_PRESETS.find(p => p.id === 'scan_20260918_1') || SCAN_FILE_PRESETS.find(p => p.name.includes('18/9'));
const gy18 = processScanRecords(p18?.content || '', defaultEmpMappingRaw as any, defaultAdjustmentsRaw as any);
const cont18 = DEFAULT_CONTRACTOR_RECORDS_BY_DATE['18/09/2026']?.records || DEFAULT_CONTRACTOR_RECORDS_BY_DATE['18/9/2026']?.records || [];
const stock18 = DEFAULT_STOCKING_REPORTS['18/09/2026'];

const summary18 = calculateOhpaSummary(
  gy18.records,
  cont18,
  stock18,
  '18/09/2026',
  SCAN_FILE_PRESETS,
  DEFAULT_CONTRACTOR_RECORDS_BY_DATE,
  defaultEmpMappingRaw as any,
  defaultAdjustmentsRaw as any,
  DEFAULT_PDI_BEAD_REPORT,
  DEFAULT_RETREAD_TONNAGE
);

console.log('=== TEST WITH DAY 18 ACTIVE ===');
console.log('Day 18 Overall Plant:');
console.log('  Stocking Kg:', summary18.totalTonnageKg);
console.log('  Stocking Lbs:', summary18.totalTonnageLbs);
console.log('  Opah Working Hours:', summary18.opahWorkingHours);
console.log('  Overall Plant OPAH (lbs/hr):', summary18.overallOpahLbsPerHour);

console.log('\nDay 18 Area Breakdown:');
summary18.areaBreakdown.forEach(a => {
  console.log(`  [${a.areaKey.padEnd(12)}] HC: ${String(a.totalHeadcount).padStart(3)} | Base H: ${String(a.totalHours).padStart(7)} | Net H: ${String(a.finalOpahHours).padStart(7)} | Stock Kg: ${String(a.areaTonnageKg).padStart(6)} | OPAH: ${a.areaOpahLbsPerHour}`);
});

// Now test with Day 21 active (MTD trend up to day 21)
const p21 = SCAN_FILE_PRESETS.find(p => p.id === 'scan_20260921') || SCAN_FILE_PRESETS[0];
const gy21 = processScanRecords(p21?.content || '', defaultEmpMappingRaw as any, defaultAdjustmentsRaw as any);
const cont21 = DEFAULT_CONTRACTOR_RECORDS_BY_DATE['21/09/2026']?.records || DEFAULT_CONTRACTOR_RECORDS_BY_DATE['21/9/2026']?.records || [];
const stock21 = DEFAULT_STOCKING_REPORTS['21/09/2026'];

const summary21 = calculateOhpaSummary(
  gy21.records,
  cont21,
  stock21,
  '21/09/2026',
  SCAN_FILE_PRESETS,
  DEFAULT_CONTRACTOR_RECORDS_BY_DATE,
  defaultEmpMappingRaw as any,
  defaultAdjustmentsRaw as any,
  DEFAULT_PDI_BEAD_REPORT,
  DEFAULT_RETREAD_TONNAGE
);

console.log('\n=== TEST WITH DAY 21 ACTIVE (MTD Daily Trends) ===');
console.log('Day | GY H   | Cont H | Base H | Net H  | Stock Kg | Daily OPAH | Cum OPAH');
console.log('----+--------+--------+--------+--------+----------+------------+---------');
summary21.mtd.dailyItems.forEach(item => {
  console.log(
    `${String(item.day).padStart(3)} | ` +
    `${String(item.gyHours).padStart(6)} | ` +
    `${String(item.contractorHours).padStart(6)} | ` +
    `${String(item.totalHours).padStart(6)} | ` +
    `${String(item.opahWorkingHours).padStart(6)} | ` +
    `${String(item.stockingKg).padStart(8)} | ` +
    `${String(item.dailyOpahLbsPerHour).padStart(10)} | ` +
    `${String(item.cumulativeOpahLbsPerHour).padStart(8)}`
  );
});

console.log('\nRow 18 in MTD:');
const row18 = summary21.mtd.dailyItems.find(i => i.day === 18);
if (row18) {
  console.log('Row 18 Area Breakdown in MTD:');
  row18.areaBreakdown?.forEach(a => {
    console.log(`  [${a.areaKey.padEnd(12)}] HC: ${String(a.totalHeadcount).padStart(3)} | Base H: ${String(a.totalHours).padStart(7)} | Net H: ${String(a.finalOpahHours).padStart(7)} | Stock Kg: ${String(a.areaTonnageKg).padStart(6)} | OPAH: ${a.areaOpahLbsPerHour}`);
  });
}
