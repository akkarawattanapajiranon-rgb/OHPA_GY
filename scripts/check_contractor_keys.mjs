import fs from 'fs';

const content = fs.readFileSync('src/data/default_contractor_data.ts', 'utf8');
const idx = content.indexOf('DEFAULT_CONTRACTOR_RECORDS_BY_DATE');
const snippet = content.slice(idx);
const matches = [...snippet.matchAll(/"(\d{1,2}\/\d{1,2}\/\d{4})":/g)].map(m => m[1]);
console.log('Contractor keys in DEFAULT_CONTRACTOR_RECORDS_BY_DATE:', matches);
