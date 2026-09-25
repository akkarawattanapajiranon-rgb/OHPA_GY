import * as XLSX from 'xlsx';
import fs from 'fs';

const p = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record\\RTR Shutdown Hour.xlsx';
const wb = XLSX.readFile(p);
console.log('Sheet names:', wb.SheetNames);

const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('\n--- First 10 rows of RTR Shutdown Excel ---');
rows.slice(0, 10).forEach((r, idx) => {
  console.log(`Row ${idx}:`, JSON.stringify(r));
});
