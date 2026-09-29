import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const tBase = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record';
const filePath = path.join(tBase, 'Dev and Support Retread (BCA) 2026.xlsx');

const wb = XLSX.readFile(filePath);
console.log('Sheets in Dev and Support Retread (BCA) 2026.xlsx:', wb.SheetNames);

for (const sName of wb.SheetNames) {
  const ws = wb.Sheets[sName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n=== Sheet: ${sName} (Rows: ${data.length}) ===`);
  for (let r = 0; r < Math.min(30, data.length); r++) {
    const row = data[r];
    if (row && row.some(c => c !== undefined && c !== null && c !== '')) {
      console.log(`Row ${r.toString().padStart(2, '0')}: ${JSON.stringify(row.slice(0, 35))}`);
    }
  }
}
