import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// Load our extracted data from recheck script
// Let's create a script to inspect records for 25, 26, 27, 28 Sep
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Let's print out what files contribute to 25, 26, 27, 28
const files = fs.readdirSync('scans_was');
const targetDates = [46290, 46291, 46292, 46293, '25/09/2026', '26/09/2026', '27/09/2026', '28/09/2026', '25/9/2026', '26/9/2026', '27/9/2026', '28/9/2026'];

console.log('=== Checking files for 25, 26, 27, 28 Sep ===');
for (const f of files) {
  if (!f.endsWith('.xls') && !f.endsWith('.xlsx')) continue;
  const full = path.join('scans_was', f);
  let wb;
  try {
    wb = XLSX.readFile(full);
  } catch (e) {
    continue;
  }
  for (const sName of wb.SheetNames) {
    const ws = wb.Sheets[sName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length <= 1) continue;
    const header = rows[0];
    const dateIdx = header.findIndex(h => String(h).includes('วันที่'));
    if (dateIdx === -1) continue;

    const dateSet = new Set();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][dateIdx] !== undefined) {
        dateSet.add(rows[i][dateIdx]);
      }
    }
    const datesArr = Array.from(dateSet);
    const hasTarget = datesArr.some(d => targetDates.includes(d));
    if (hasTarget) {
      console.log(`File: "${f}" | Sheet: "${sName}" | Dates found: ${datesArr.join(', ')} | Rows: ${rows.length - 1}`);
    }
  }
}
