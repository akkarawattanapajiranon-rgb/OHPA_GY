import fs from 'fs';

console.log('--- 1. SCAN PRESETS in default_scan_record.ts ---');
const scanContent = fs.readFileSync('src/data/default_scan_record.ts', 'utf8');
const scanIds = [...scanContent.matchAll(/id:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
console.log('Scan IDs:', scanIds);

console.log('\n--- 2. CONTRACTOR DATES in default_contractor_data.ts ---');
const contContent = fs.readFileSync('src/data/default_contractor_data.ts', 'utf8');
const contDates = [...contContent.matchAll(/"(2026-\d{2}-\d{2})":/g)].map(m => m[1]);
console.log('Contractor Dates:', [...new Set(contDates)]);

console.log('\n--- 3. STOCKING DATES in default_stocking_reports.ts ---');
const stockContent = fs.readFileSync('src/data/default_stocking_reports.ts', 'utf8');
const stockDates = [...stockContent.matchAll(/"(2026-\d{2}-\d{2})":/g)].map(m => m[1]);
console.log('Stocking Dates:', [...new Set(stockDates)]);

console.log('\n--- 4. PDI / BEAD DATES in default_pdi_bead.ts ---');
const pdiContent = fs.readFileSync('src/data/default_pdi_bead.ts', 'utf8');
console.log('PDI content sample:', pdiContent.slice(0, 500));
