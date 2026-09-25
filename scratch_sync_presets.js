import fs from 'fs';

const scanFiles = fs.readdirSync('scans')
  .filter(f => f.match(/^202609\d{2}\.txt$/))
  .sort();

console.log('Valid scan files found:', scanFiles);

const presets = [];

for (const sf of scanFiles) {
  const dateStr = sf.replace('.txt', '');
  const y = parseInt(dateStr.slice(0, 4), 10);
  const m = parseInt(dateStr.slice(4, 6), 10);
  const d = parseInt(dateStr.slice(6, 8), 10);

  const content = fs.readFileSync(`scans/${sf}`, 'utf8');
  const dateFormatted = `วันที่ ${d}/${m}/${y}`;
  const dt = new Date(y, m - 1, d);

  presets.push({
    id: `scan_${dateStr}`,
    name: `📅 วันที่ ${d}/${m}/${y}`,
    dateFormatted,
    dateTimestamp: dt.getTime(),
    content
  });
}

// Sort presets descending by date (newest first, e.g. 23/9, 22/9, 21/9, ...)
presets.sort((a, b) => b.dateTimestamp - a.dateTimestamp);

const defaultContent = presets[0]?.content || '';
const defaultFileName = `${presets[0]?.id?.replace('scan_', '') || '20260923'}.txt`;

const tsCode = `export interface ScanPreset {
  id: string;
  name: string;
  content: string;
  dateFormatted?: string;
  dateTimestamp?: number;
}

export const SCAN_FILE_PRESETS: ScanPreset[] = ${JSON.stringify(presets, null, 2)};

export const DEFAULT_SCAN_CONTENT = ${JSON.stringify(defaultContent)};
export const DEFAULT_FILE_NAME = ${JSON.stringify(defaultFileName)};
`;

fs.writeFileSync('src/data/default_scan_record.ts', tsCode, 'utf8');
console.log('Successfully updated src/data/default_scan_record.ts with', presets.length, 'presets and defaults!');
