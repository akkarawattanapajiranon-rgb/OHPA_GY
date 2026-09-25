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
  let dd = '', mm = '', yyyy = '';
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    dd = String(d.getUTCDate()).padStart(2, '0');
    yyyy = String(d.getUTCFullYear());
    dateFormatted = `${dd}/${mm}/${yyyy}`;
    mmddyyyy = `${mm}${dd}${yyyy}`;
  } else {
    dateFormatted = String(val);
    mmddyyyy = String(val);
    const parts = dateFormatted.split(/[/.-]/);
    if (parts.length === 3) {
      dd = parts[0].padStart(2, '0');
      mm = parts[1].padStart(2, '0');
      yyyy = parts[2];
    }
  }
  dates.push({ col, dateFormatted, mmddyyyy, dd, mm, yyyy, raw: val });
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

      if (d.dd && d.mm && d.yyyy) {
        const shortK = `${parseInt(d.dd, 10)}/${parseInt(d.mm, 10)}/${d.yyyy}`;
        const isoK = `${d.yyyy}-${d.mm}-${d.dd}`;
        if (!shutdownData[shortK]) shutdownData[shortK] = {};
        shutdownData[shortK][deptName] = val;
        if (!shutdownData[isoK]) shutdownData[isoK] = {};
        shutdownData[isoK][deptName] = val;
      }
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
  '  // Try parsing date components',
  '  const parts = clean.split(/[/.-]/);',
  '  if (parts.length === 3) {',
  '    let d = "01", m = "09", y = "2026";',
  '    if (parts[0].length === 4) {',
  '      // YYYY-MM-DD',
  '      y = parts[0];',
  '      m = parts[1].padStart(2, "0");',
  '      d = parts[2].padStart(2, "0");',
  '    } else {',
  '      // DD/MM/YYYY',
  '      d = parts[0].padStart(2, "0");',
  '      m = parts[1].padStart(2, "0");',
  '      y = parts[2].length === 4 ? parts[2] : (parseInt(parts[2], 10) > 2400 ? String(parseInt(parts[2], 10) - 543) : "2026");',
  '    }',
  '    const k = `${d}/${m}/${y}`;',
  '    if (DEFAULT_RTR_SHUTDOWN_DATA[k]) return DEFAULT_RTR_SHUTDOWN_DATA[k];',
  '    const kShort = `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;',
  '    if (DEFAULT_RTR_SHUTDOWN_DATA[kShort]) return DEFAULT_RTR_SHUTDOWN_DATA[kShort];',
  '    const kIso = `${y}-${m}-${d}`;',
  '    if (DEFAULT_RTR_SHUTDOWN_DATA[kIso]) return DEFAULT_RTR_SHUTDOWN_DATA[kIso];',
  '  }',
  '  return {};',
  '}',
  ''
];

fs.writeFileSync('src/data/default_rtr_shutdown.ts', lines.join('\n'), 'utf8');
console.log('Successfully saved src/data/default_rtr_shutdown.ts');
