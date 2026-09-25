import fs from 'fs';
import { SCAN_FILE_PRESETS } from '../src/data/default_scan_record.js';
import { DEFAULT_CONTRACTOR_RECORDS_BY_DATE } from '../src/data/default_contractor_data.js';
import defaultEmpMappingRaw from '../src/data/default_emp_mapping.json' with { type: 'json' };
import defaultAdjustmentsRaw from '../src/data/default_adjustments.json' with { type: 'json' };
import { processScanRecords } from '../src/utils/parser.js';

console.log('Testing Late and Early leave parsing across all presets:');

let totalGyLate = 0;
let totalGyEarly = 0;
let totalContLate = 0;
let totalContEarly = 0;

SCAN_FILE_PRESETS.forEach(preset => {
  const parsed = processScanRecords(preset.content, defaultEmpMappingRaw, defaultAdjustmentsRaw);
  const lateRecs = parsed.records.filter(r => r.isLate);
  const earlyRecs = parsed.records.filter(r => r.isEarlyLeave);
  totalGyLate += lateRecs.length;
  totalGyEarly += earlyRecs.length;

  const dateShort = (preset.dateFormatted || '').replace(/^[📅📄\s]*วันที่\s*/, '').trim();
  const contEntry = DEFAULT_CONTRACTOR_RECORDS_BY_DATE[dateShort] || DEFAULT_CONTRACTOR_RECORDS_BY_DATE[`${dateShort}`];
  const contLate = contEntry?.records?.filter(r => r.late && r.late !== '0' && r.late.trim() !== '') || [];
  const contEarly = contEntry?.records?.filter(r => r.earlyOut && r.earlyOut !== '0' && r.earlyOut.trim() !== '') || [];
  totalContLate += contLate.length;
  totalContEarly += contEarly.length;

  console.log(`${preset.name}: GY Late=${lateRecs.length}, GY Early=${earlyRecs.length} | Cont Late=${contLate.length}, Cont Early=${contEarly.length}`);
});

console.log(`\nTOTAL MTD: GY Late=${totalGyLate}, GY Early=${totalGyEarly} | Cont Late=${totalContLate}, Cont Early=${totalContEarly}`);
