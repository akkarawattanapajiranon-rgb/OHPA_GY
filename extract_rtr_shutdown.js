const xlsx = require('xlsx');
const fs = require('fs');

const p = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record\\RTR Shutdown Hour.xlsx';
const wb = xlsx.readFile(p);
const data = xlsx.utils.sheet_to_json(wb.Sheets['RTR Shutdown'], { header: 1, defval: '' });

const headerRow = data[0];
const dates = [];
for (let col = 1; col < headerRow.length; col++) {
  const val = headerRow[col];
  if (!val) continue;
  let dateFormatted = '';
  let mmddyyyy = '';
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const yyyy = String(d.getUTCFullYear());
    dateFormatted = `${dd}/${mm}/${yyyy}`;
    mmddyyyy = `${mm}${dd}${yyyy}`;
  } else {
    dateFormatted = String(val);
    mmddyyyy = String(val);
  }
  dates.push({ col, dateFormatted, mmddyyyy, raw: val });
}

const shutdownData = {};

for (let r = 1; r < data.length; r++) {
  const row = data[r];
  const deptName = String(row[0]).trim();
  if (!deptName) continue;
  dates.forEach(d => {
    const val = parseFloat(row[d.col]) || 0;
    if (val > 0) {
      if (!shutdownData[d.dateFormatted]) shutdownData[d.dateFormatted] = {};
      shutdownData[d.dateFormatted][deptName] = val;
    }
  });
}

console.log('Processed dates count:', Object.keys(shutdownData).length);

const lines = [
  '// RTR Shutdown Hour Data extracted from RTR Shutdown Hour.xlsx',
  '',
  'export interface RtrShutdownEntry {',
  '  [areaKey: string]: number;',
  '}',
  '',
  `export const DEFAULT_RTR_SHUTDOWN_DATA: Record<string, RtrShutdownEntry> = ${JSON.stringify(shutdownData, null, 2)};`,
  '',
  'export function getRtrShutdownHoursForDate(dateStr?: string): RtrShutdownEntry {',
  '  if (!dateStr) return {};',
  '  const clean = String(dateStr).replace(/^[📅📄\\s]*วันที่\\s*/, "").trim();',
  '  if (DEFAULT_RTR_SHUTDOWN_DATA[clean]) return DEFAULT_RTR_SHUTDOWN_DATA[clean];',
  '',
  '  // Try DD/MM/YYYY formatting',
  '  const parts = clean.split(/[/.-]/);',
  '  if (parts.length === 3) {',
  '    let d = parts[0].padStart(2, "0");',
  '    let m = parts[1].padStart(2, "0");',
  '    let y = parts[2].length === 4 ? parts[2] : (parseInt(parts[2], 10) > 2400 ? String(parseInt(parts[2], 10) - 543) : "2026");',
  '    const k = `${d}/${m}/${y}`;',
  '    if (DEFAULT_RTR_SHUTDOWN_DATA[k]) return DEFAULT_RTR_SHUTDOWN_DATA[k];',
  '    const kShort = `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;',
  '    if (DEFAULT_RTR_SHUTDOWN_DATA[kShort]) return DEFAULT_RTR_SHUTDOWN_DATA[kShort];',
  '  }',
  '  return {};',
  '}',
  ''
];

fs.writeFileSync('src/data/default_rtr_shutdown.ts', lines.join('\n'), 'utf8');
console.log('Successfully saved src/data/default_rtr_shutdown.ts');
