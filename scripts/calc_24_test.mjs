import fs from 'fs';
import { calculateOhpaSummary } from '../src/utils/ohpaCalculator.js';
import { SCAN_FILE_PRESETS } from '../src/data/default_scan_record.js';
import { DEFAULT_CONTRACTOR_RECORDS_BY_DATE } from '../src/data/default_contractor_data.js';
import { DEFAULT_STOCKING_REPORTS } from '../src/data/default_stocking_reports.js';
import { DEFAULT_PDI_BEAD_REPORT } from '../src/data/default_pdi_bead.js';
import defaultEmpMappingRaw from '../src/data/default_emp_mapping.json' with { type: 'json' };
import defaultAdjustmentsRaw from '../src/data/default_adjustments.json' with { type: 'json' };
import { DEFAULT_RETREAD_TONNAGE } from '../src/data/default_retread_tonnage.js';
import { processScanRecords } from '../src/utils/parser.js';

const scan24 = SCAN_FILE_PRESETS.find(p => p.id === 'scan_20260924');
const parsed24 = processScanRecords(scan24.content, defaultEmpMappingRaw, defaultAdjustmentsRaw);
const cont24 = DEFAULT_CONTRACTOR_RECORDS_BY_DATE['24/9/2026']?.records || [];
const stock24 = DEFAULT_STOCKING_REPORTS['2026-09-24'] || null;

const summary = calculateOhpaSummary(
  parsed24.records,
  cont24,
  stock24,
  'วันที่ 24/9/2026',
  SCAN_FILE_PRESETS,
  DEFAULT_CONTRACTOR_RECORDS_BY_DATE,
  defaultEmpMappingRaw,
  defaultAdjustmentsRaw,
  DEFAULT_PDI_BEAD_REPORT,
  DEFAULT_RETREAD_TONNAGE
);

console.log('--- Summary for 24/09/2026 ---');
console.log('Production Day:', summary.productionDay);
console.log('Base Working Hours:', summary.totalWorkingHours);
console.log('PDI Deduct:', summary.pdiDeductHours);
console.log('Bead Add:', summary.beadAddHours);
console.log('BCA โอน:', summary.bcaReductionHours);
console.log('BCA DEV:', summary.bcaDevHours);
console.log('RTR Shutdown:', summary.rtrShutdownHours);
console.log('Net OPAH Hours:', summary.opahWorkingHours);
console.log('Stocking Tonnage kg:', summary.totalTonnageKg);
console.log('Daily Plant OPAH:', summary.overallOpahLbsPerHour, 'lbs/hr');
