import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const tBase = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record';
const filePath = path.join(tBase, 'RTR Shutdown Hour.xlsx');

const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('Sheet dimensions:', data.length, 'rows');
const headerRow = data[0]; // serial dates or dates
console.log('Header row:', JSON.stringify(headerRow));

const rtrByDate = {};

for (let r = 1; r < data.length; r++) {
  const row = data[r];
  if (!row || !row[0]) continue;
  const areaName = String(row[0]).trim();
  console.log(`\nArea: ${areaName}`);
  for (let c = 1; c < row.length; c++) {
    const val = parseFloat(row[c]);
    if (val > 0) {
      const dateSerial = headerRow[c];
      let dmy = '';
      let iso = '';
      if (typeof dateSerial === 'number') {
        const utc_days = Math.floor(dateSerial - 25569);
        const d = new Date(utc_days * 86400 * 1000);
        const day = d.getUTCDate();
        const month = d.getUTCMonth() + 1;
        const year = d.getUTCFullYear();
        dmy = `${day}/${month}/${year}`;
        iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else {
        dmy = String(dateSerial);
        iso = String(dateSerial);
      }
      if (!rtrByDate[dmy]) rtrByDate[dmy] = {};
      rtrByDate[dmy][areaName] = val;
      console.log(`  Col ${c} (Date: ${dmy} / ${dateSerial}): ${val} hrs`);
    }
  }
}

console.log('\n=== All Extracted RTR Shutdown by Date ===');
console.log(JSON.stringify(rtrByDate, null, 2));
