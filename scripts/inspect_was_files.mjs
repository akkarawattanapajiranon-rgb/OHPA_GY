import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const files = fs.readdirSync('scans_was');
for (const f of files) {
  if (f.endsWith('.xls') || f.endsWith('.xlsx')) {
    const full = path.join('scans_was', f);
    try {
      const wb = XLSX.readFile(full);
      console.log(`\n========================================`);
      console.log(`FILE: ${f} (${fs.statSync(full).size} bytes)`);
      console.log(`Sheets: ${wb.SheetNames.join(', ')}`);
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        console.log(`  Sheet: "${sheetName}", Rows: ${data.length}`);
        if (data.length > 0) {
          console.log(`    Row 0: ${JSON.stringify(data[0])}`);
        }
        if (data.length > 1) {
          console.log(`    Row 1: ${JSON.stringify(data[1])}`);
        }
        if (data.length > 2) {
          console.log(`    Row 2: ${JSON.stringify(data[2])}`);
        }
      }
    } catch (e) {
      console.log(`FILE: ${f} -> ERROR: ${e.message}`);
    }
  }
}
