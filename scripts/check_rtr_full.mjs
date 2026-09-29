import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const tBase = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record';
const filePath = path.join(tBase, 'RTR Shutdown Hour.xlsx');

const wb = XLSX.readFile(filePath);
for (const sName of wb.SheetNames) {
  const ws = wb.Sheets[sName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n=== Sheet: ${sName} ===`);
  const header = data[0] || [];
  for (let c = 0; c < header.length; c++) {
    const colVal = header[c];
    let colDate = colVal;
    if (typeof colVal === 'number' && colVal > 40000) {
      const d = new Date(Math.floor(colVal - 25569) * 86400 * 1000);
      colDate = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()} (Serial ${colVal})`;
    }
    const nonEmpties = [];
    for (let r = 1; r < data.length; r++) {
      if (data[r][c] !== undefined && data[r][c] !== null && data[r][c] !== '') {
        nonEmpties.push(`${data[r][0]}: ${data[r][c]}`);
      }
    }
    if (nonEmpties.length > 0 || c <= 32) {
      console.log(`Col ${c.toString().padStart(2, '0')} [${colDate}] -> ${nonEmpties.join(', ') || '(empty)'}`);
    }
  }
}
