import fs from 'fs';

const content = fs.readFileSync('src/data/default_contractor_data.ts', 'utf8');

const keys = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];
keys.forEach(k => {
  const idx = content.indexOf(`"${k}":`);
  if (idx !== -1) {
    const nextIdx = content.indexOf('records": [', idx);
    const endIdx = content.indexOf(']', nextIdx);
    const recordsSnippet = content.slice(nextIdx, endIdx + 1);
    const count = (recordsSnippet.match(/\{/g) || []).length;
    console.log(`Date ${k}: found ${count} contractor records`);
  } else {
    console.log(`Date ${k}: NOT found`);
  }
});
