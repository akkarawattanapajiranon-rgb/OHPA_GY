import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const tBase = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record';
const pdiFile = path.join(tBase, 'OPAH hour PDI& B-ead.xlsx');

const wb = XLSX.readFile(pdiFile);
console.log('Sheets in OPAH hour PDI& B-ead.xlsx:', wb.SheetNames);

for (const sName of wb.SheetNames) {
  const ws = wb.Sheets[sName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n=== Sheet: "${sName}" (${data.length} rows) ===`);
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0) continue;
    const title = row.slice(0, 3).filter(Boolean).join(' | ');
    if (title || row.some(c => typeof c === 'number' && c > 0)) {
      console.log(`Row ${r.toString().padStart(2, '0')}: [${title}] -> ${JSON.stringify(row.slice(3, 34))}`);
    }
  }
}
