import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const tBase = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record';

function inspectExcel(filename) {
  const full = path.join(tBase, filename);
  if (!fs.existsSync(full)) {
    console.log(`File not found: ${full}`);
    return;
  }
  const stat = fs.statSync(full);
  console.log(`\n======================================================`);
  console.log(`FILE: ${filename} (Modified: ${stat.mtime.toLocaleString()})`);
  const wb = XLSX.readFile(full);
  for (const sName of wb.SheetNames) {
    const ws = wb.Sheets[sName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log(`--- Sheet: "${sName}" (Rows: ${data.length}) ---`);
    for (let i = 0; i < Math.min(25, data.length); i++) {
      if (data[i] && data[i].some(cell => cell !== undefined && cell !== null && cell !== '')) {
        console.log(`Row ${i}: ${JSON.stringify(data[i])}`);
      }
    }
  }
}

inspectExcel('RTR Shutdown Hour.xlsx');
inspectExcel('OPAH hour PDI& B-ead.xlsx');
inspectExcel('Dev and Support Retread (BCA) 2026.xlsx');
