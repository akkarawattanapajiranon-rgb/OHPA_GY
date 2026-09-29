import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const tBase = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record';
const filePath = path.join(tBase, 'RTR Shutdown Hour.xlsx');

const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const header = data[0];
console.log('Columns:');
for (let c = 1; c < header.length; c++) {
  const serial = header[c];
  if (!serial) continue;
  let dmy = serial;
  if (typeof serial === 'number') {
    const d = new Date(Math.floor(serial - 25569) * 86400 * 1000);
    dmy = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
  }
  const vals = [];
  for (let r = 1; r < data.length; r++) {
    const area = data[r][0];
    const val = data[r][c];
    if (val !== undefined && val !== null && val !== '') {
      vals.push(`${area}: ${val}h`);
    }
  }
  if (vals.length > 0) {
    console.log(`Col ${c} -> ${dmy} (serial ${serial}): ${vals.join(', ')}`);
  } else {
    console.log(`Col ${c} -> ${dmy} (serial ${serial}): (no values)`);
  }
}
