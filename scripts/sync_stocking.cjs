const https = require('https');
const fs = require('fs');
const path = require('path');

async function fetchDay(d) {
  const dPad = String(d).padStart(2, '0');
  const pd = '202609' + dPad + '000000';
  const url = 'https://10.124.129.34/l2web/datahost/all_areas/dpics.php?server=db_server&action=r06&mt=TBM&smt=TBM&pd=' + pd;
  return new Promise((resolve) => {
    const req = https.request(url, { rejectUnauthorized: false, timeout: 7000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const rowMatches = body.match(/<tr class=tabledata[12] >([\s\S]*?)<\/tr>/g) || [];
        const rows = [];
        let totalRow = null;

        rowMatches.forEach(r => {
          const cells = (r.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(td => td.replace(/<[^>]+>/g, '').trim());
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
          const parseNum = (v) => {
            const clean = (v || '').replace(/,/g, '').trim();
            const n = parseFloat(clean);
            return isNaN(n) ? 0 : n;
          };
          const rowObj = {
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
            dailyTotalPallets: parseNum(cells[numStartIdx + 9])
          };
          if (isTotal) totalRow = rowObj;
          else rows.push(rowObj);
        });

        const report = {
          productionDay: dPad + '/09/2026',
          productionDayValue: pd,
          availableDates: [],
          rows,
          total: totalRow,
          fetchedAt: new Date().toISOString()
        };
        resolve({ d, dPad, pd, report });
      });
    });
    req.on('error', (err) => {
      console.error('Error day ' + d + ':', err.message);
      resolve(null);
    });
    req.end();
  });
}

async function run() {
  const results = {};
  for (let d = 1; d <= 23; d++) {
    const res = await fetchDay(d);
    if (res && res.report && res.report.total && res.report.total.dailyTotalTonnage > 0) {
      results['2026-09-' + res.dPad] = res.report;
      results[res.dPad + '/09/2026'] = res.report;
      results[res.d + '/9/2026'] = res.report;
      console.log('Day ' + d + ' fetched: total kg = ' + res.report.total.dailyTotalTonnage);
    } else if (res && res.report) {
      results['2026-09-' + res.dPad] = res.report;
      results[res.dPad + '/09/2026'] = res.report;
      results[res.d + '/9/2026'] = res.report;
      console.log('Day ' + d + ' fetched (0 or partial): total kg = ' + (res.report.total?.dailyTotalTonnage || 0));
    }
  }

  // Load existing cache and merge
  const jsonPath = path.resolve(__dirname, 'live_september_stocking.json');
  let oldJson = {};
  if (fs.existsSync(jsonPath)) {
    try { oldJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch(e){}
  }
  const merged = { ...oldJson, ...results };
  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log('Saved to scripts/live_september_stocking.json');

  const tsPath = path.resolve(__dirname, '../src/data/default_stocking_reports.ts');
  const tsContent = 'import { StockingTonnageReport } from "../types/ohpa";\n\nexport const DEFAULT_STOCKING_REPORTS: Record<string, StockingTonnageReport> = ' + JSON.stringify(merged, null, 2) + ';\n';
  fs.writeFileSync(tsPath, tsContent, 'utf8');
  console.log('Saved to src/data/default_stocking_reports.ts');
}

run();
