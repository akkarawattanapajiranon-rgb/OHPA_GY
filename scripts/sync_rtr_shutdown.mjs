import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const tBase = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record';
const filePath = path.join(tBase, 'RTR Shutdown Hour.xlsx');

let wb;
if (fs.existsSync(filePath)) {
  wb = XLSX.readFile(filePath);
} else if (fs.existsSync('scans/RTR Shutdown Hour.xlsx')) {
  wb = XLSX.readFile('scans/RTR Shutdown Hour.xlsx');
} else {
  console.error('Cannot find RTR Shutdown Hour.xlsx');
  process.exit(1);
}

const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
const headerRow = data[0];

const shutdownData = {};

for (let c = 1; c < headerRow.length; c++) {
  const serial = headerRow[c];
  if (!serial) continue;

  let d = 0, m = 0, y = 0;
  if (typeof serial === 'number') {
    const dt = new Date(Math.floor(serial - 25569) * 86400 * 1000);
    d = dt.getUTCDate();
    m = dt.getUTCMonth() + 1;
    y = dt.getUTCFullYear();
  } else {
    const s = String(serial).trim();
    const parts = s.split(/[/.-]/);
    if (parts.length === 3) {
      d = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      y = parseInt(parts[2], 10);
    }
  }

  if (!d || !m || !y) continue;

  const areaEntries = {};
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !row[0]) continue;
    const rawArea = String(row[0]).trim();
    let areaKey = rawArea;
    if (rawArea.includes('BCA')) areaKey = 'BCA';
    else if (rawArea.includes('Consumer')) areaKey = 'Consumer';
    else if (rawArea.includes('Bias')) areaKey = 'Bias Aero';
    else if (rawArea.includes('Radial')) areaKey = 'Radial Aero';
    else if (rawArea.includes('Retread')) areaKey = 'Retread';

    const hrs = parseFloat(row[c]);
    if (hrs > 0) {
      areaEntries[areaKey] = hrs;
    }
  }

  if (Object.keys(areaEntries).length > 0) {
    const dPad = String(d).padStart(2, '0');
    const mPad = String(m).padStart(2, '0');
    const kShort = `${d}/${m}/${y}`;
    const kPad = `${dPad}/${mPad}/${y}`;
    const kIso = `${y}-${mPad}-${dPad}`;

    shutdownData[kPad] = areaEntries;
    shutdownData[kShort] = areaEntries;
    shutdownData[kIso] = areaEntries;
  }
}

const fileContent = `// RTR Shutdown Hour Data extracted from RTR Shutdown Hour.xlsx

export interface RtrShutdownEntry {
  [areaKey: string]: number;
}

export const DEFAULT_RTR_SHUTDOWN_DATA: Record<string, RtrShutdownEntry> = ${JSON.stringify(shutdownData, null, 2)};

export function getRtrShutdownHoursForDate(dateStr?: string): RtrShutdownEntry {
  if (!dateStr) return {};
  const clean = String(dateStr).replace(/^[📅📄\\s]*วันที่\\s*/, "").trim();
  if (DEFAULT_RTR_SHUTDOWN_DATA[clean]) return DEFAULT_RTR_SHUTDOWN_DATA[clean];

  // Try parsing date components
  const parts = clean.split(/[/.-]/);
  if (parts.length === 3) {
    let d = "01", m = "09", y = "2026";
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      y = parts[0];
      m = parts[1].padStart(2, "0");
      d = parts[2].padStart(2, "0");
    } else {
      // DD/MM/YYYY
      d = parts[0].padStart(2, "0");
      m = parts[1].padStart(2, "0");
      y = parts[2].length === 4 ? parts[2] : (parseInt(parts[2], 10) > 2400 ? String(parseInt(parts[2], 10) - 543) : "2026");
    }
    const k = \`\${d}/\${m}/\${y}\`;
    if (DEFAULT_RTR_SHUTDOWN_DATA[k]) return DEFAULT_RTR_SHUTDOWN_DATA[k];
    const kShort = \`\${parseInt(d, 10)}/\${parseInt(m, 10)}/\${y}\`;
    if (DEFAULT_RTR_SHUTDOWN_DATA[kShort]) return DEFAULT_RTR_SHUTDOWN_DATA[kShort];
    const kIso = \`\${y}-\${m}-\${d}\`;
    if (DEFAULT_RTR_SHUTDOWN_DATA[kIso]) return DEFAULT_RTR_SHUTDOWN_DATA[kIso];
  }
  return {};
}
`;

fs.writeFileSync('src/data/default_rtr_shutdown.ts', fileContent, 'utf8');
console.log(`Updated src/data/default_rtr_shutdown.ts with ${Object.keys(shutdownData).length / 3} active dates.`);
