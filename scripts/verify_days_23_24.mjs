import fs from 'fs';
import { DEFAULT_STOCKING_REPORTS } from '../src/data/default_stocking_reports.js';
import { SCAN_FILE_PRESETS } from '../src/data/default_scan_record.js';
import { DEFAULT_CONTRACTOR_RECORDS_BY_DATE } from '../src/data/default_contractor_data.js';

console.log('Total Scan Presets:', SCAN_FILE_PRESETS.length);
console.log('Presets names:', SCAN_FILE_PRESETS.map(p => p.name));

console.log('\nChecking Day 23:');
console.log('Scan 23 length:', SCAN_FILE_PRESETS.find(p => p.id === 'scan_20260923')?.content?.length);
console.log('Stocking 23:', DEFAULT_STOCKING_REPORTS['2026-09-23']?.total?.dailyTotalTonnage, 'kg');

console.log('\nChecking Day 24:');
console.log('Scan 24 length:', SCAN_FILE_PRESETS.find(p => p.id === 'scan_20260924')?.content?.length);
console.log('Stocking 24:', DEFAULT_STOCKING_REPORTS['2026-09-24']?.total?.dailyTotalTonnage, 'kg');

console.log('\nChecking Day 25:');
console.log('Scan 25 length:', SCAN_FILE_PRESETS.find(p => p.id === 'scan_20260925')?.content?.length);
console.log('Stocking 25:', DEFAULT_STOCKING_REPORTS['2026-09-25']?.total?.dailyTotalTonnage, 'kg');
