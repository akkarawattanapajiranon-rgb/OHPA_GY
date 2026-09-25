import https from 'https';
import fs from 'fs';
import path from 'path';

function fetchUrl(queryPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '10.124.129.34',
      port: 443,
      path: queryPath,
      method: 'GET',
      rejectUnauthorized: false,
      timeout: 8000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

function parseStockingHtml(body, targetPdVal = '') {
  const optionsMatch = body.match(/<OPTION value="(\d+)"\s*(SELECTED)?\s*>([^<]+)<\/OPTION>/gi) || [];
  let activeDayLabel = '';
  const availableDates = optionsMatch.map((opt) => {
    const val = (opt.match(/value="(\d+)"/i) || [])[1];
    const label = (opt.match(/>([^<]+)<\/OPTION>/i) || [])[1]?.trim() || '';
    const selected = /SELECTED/i.test(opt);
    if (selected) activeDayLabel = label;
    return { value: val, label, selected };
  });

  const rowMatches = body.match(/<tr class=tabledata[12] >([\s\S]*?)<\/tr>/g) || [];
  const rows = [];
  let totalRow = null;

  rowMatches.forEach((r) => {
    const cells = (r.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map((td) => td.replace(/<[^>]+>/g, '').trim());
    if (cells.length < 10) return;

    const isTotal = cells[0].toUpperCase().includes('TOTAL') || cells[1]?.toUpperCase().includes('TOTAL');
    let code = cells[0];
    let name = cells[1];
    let numStartIdx = 2;

    if (isTotal) {
      code = 'TOTAL';
      name = 'TOTAL';
      numStartIdx = 1;
    }

    const parseNum = (str) => {
      if (!str) return 0;
      const clean = str.replace(/,/g, '').trim();
      const n = parseFloat(clean);
      return isNaN(n) ? 0 : n;
    };

    const rowData = {
      code,
      categoryName: name,
      mtdTonnage: parseNum(cells[numStartIdx]),
      mtdPallets: parseNum(cells[numStartIdx + 1]),
      shift1Tonnage: parseNum(cells[numStartIdx + 2]),
      shift1Pallets: parseNum(cells[numStartIdx + 3]),
      shift2Tonnage: parseNum(cells[numStartIdx + 4]),
      shift2Pallets: parseNum(cells[numStartIdx + 5]),
      shift3Tonnage: parseNum(cells[numStartIdx + 6]),
      shift3Pallets: parseNum(cells[numStartIdx + 7]),
      dailyTotalTonnage: parseNum(cells[numStartIdx + 8]),
      dailyTotalPallets: parseNum(cells[numStartIdx + 9]),
    };

    if (isTotal) {
      totalRow = rowData;
    } else {
      rows.push(rowData);
    }
  });

  return {
    productionDay: activeDayLabel,
    productionDayValue: targetPdVal,
    availableDates,
    rows,
    total: totalRow
  };
}

async function syncStocking() {
  console.log('--- 1. Syncing Stocking Reports from 10.124.129.34 ---');
  const mainPage = await fetchUrl('/l2web/datahost/all_areas/dpics.php?server=db_server&action=r06&mt=TBM&smt=TBM');
  const optionsMatch = mainPage.match(/<OPTION value="(\d+)"\s*(SELECTED)?\s*>([^<]+)<\/OPTION>/gi) || [];

  const stockingByDate = {};

  for (const opt of optionsMatch) {
    const val = (opt.match(/value="(\d+)"/i) || [])[1];
    const label = (opt.match(/>([^<]+)<\/OPTION>/i) || [])[1]?.trim() || '';
    if (!val || !label) continue;

    // Filter September 2026 or relevant days
    const parts = label.split('/');
    if (parts.length === 3 && parts[1] === '09' && parts[2] === '2026') {
      const dd = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      const yyyy = parts[2];
      const isoKey = `${yyyy}-${mm}-${dd}`;
      const dNum = parseInt(dd, 10);

      console.log(`Fetching stocking for ${label} (pd=${val})...`);
      const pageHtml = await fetchUrl(`/l2web/datahost/all_areas/dpics.php?server=db_server&action=r06&mt=TBM&smt=TBM&pd=${val}`);
      const parsed = parseStockingHtml(pageHtml, val);
      parsed.productionDay = label;

      stockingByDate[isoKey] = parsed;
      stockingByDate[label] = parsed;
      stockingByDate[`${dNum}/${parseInt(mm,10)}/${yyyy}`] = parsed;
    }
  }

  // Write to scripts/live_september_stocking.json
  fs.writeFileSync('scripts/live_september_stocking.json', JSON.stringify(stockingByDate, null, 2), 'utf8');
  console.log(`Saved ${Object.keys(stockingByDate).length} stocking entries to scripts/live_september_stocking.json`);

  // Write to src/data/default_stocking_reports.ts
  const tsStocking = `import { StockingTonnageReport } from "../types/ohpa";

export const DEFAULT_STOCKING_REPORTS: Record<string, StockingTonnageReport> = ${JSON.stringify(stockingByDate, null, 2)};
`;
  fs.writeFileSync('src/data/default_stocking_reports.ts', tsStocking, 'utf8');
  console.log('Saved src/data/default_stocking_reports.ts');
}

async function syncScanPresets() {
  console.log('\n--- 2. Syncing Scan Presets from scans/ ---');
  const allFiles = fs.readdirSync('scans');

  // Map each date (20260901..20260925) to its best/largest scan file
  const dateToFileMap = {};

  for (const f of allFiles) {
    if (!f.endsWith('.txt')) continue;
    const match = f.match(/^(\d{8})/);
    if (!match) continue;
    const dateStr = match[1];
    const fullPath = path.join('scans', f);
    const stat = fs.statSync(fullPath);

    if (!dateToFileMap[dateStr] || stat.size > dateToFileMap[dateStr].size) {
      dateToFileMap[dateStr] = { filename: f, size: stat.size, path: fullPath };
    }
  }

  const presets = [];
  for (const [dateStr, info] of Object.entries(dateToFileMap)) {
    const y = parseInt(dateStr.slice(0, 4), 10);
    const m = parseInt(dateStr.slice(4, 6), 10);
    const d = parseInt(dateStr.slice(6, 8), 10);

    const content = fs.readFileSync(info.path, 'utf8');
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

  // Sort descending by date
  presets.sort((a, b) => b.dateTimestamp - a.dateTimestamp);

  const defaultContent = presets[0]?.content || '';
  const defaultFileName = `${presets[0]?.id?.replace('scan_', '') || '20260924'}.txt`;

  const tsPresets = `export interface ScanPreset {
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

  fs.writeFileSync('src/data/default_scan_record.ts', tsPresets, 'utf8');
  console.log(`Saved src/data/default_scan_record.ts with ${presets.length} presets! Newest preset is ${presets[0]?.name}`);
}

async function main() {
  await syncStocking();
  await syncScanPresets();
  console.log('\nAll data successfully synced!');
}

main().catch(err => console.error(err));
