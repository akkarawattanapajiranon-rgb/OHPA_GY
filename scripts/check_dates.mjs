import fs from 'fs';

const stockingContent = fs.readFileSync('src/data/default_stocking_reports.ts', 'utf8');
const stockingKeys = [...stockingContent.matchAll(/"(2026-\d{2}-\d{2})":/g)].map(m => m[1]);
console.log('Stocking dates:', stockingKeys);

const pdiContent = fs.readFileSync('src/data/default_pdi_bead.ts', 'utf8');
const pdiDailyMatch = pdiContent.match(/pdiDailyTotals:\s*\{([^}]+)\}/s);
if (pdiDailyMatch) {
  console.log('pdiDailyTotals:', pdiDailyMatch[1].trim().split('\n').map(l => l.trim()));
}

const beadDailyMatch = pdiContent.match(/beadDailyTotals:\s*\{([^}]+)\}/s);
if (beadDailyMatch) {
  console.log('beadDailyTotals:', beadDailyMatch[1].trim().split('\n').map(l => l.trim()));
}

const retreadContent = fs.readFileSync('src/data/default_retread_tonnage.ts', 'utf8');
const retreadKeys = [...retreadContent.matchAll(/"(\d{2}\/\d{2}\/\d{4})":/g)].map(m => m[1]);
console.log('Retread dates:', retreadKeys);
