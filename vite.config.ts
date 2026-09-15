import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import * as XLSX from 'xlsx';

function scanFolderApiPlugin(): Plugin {
  return {
    name: 'scan-folder-api',
    configureServer(server) {
      // API to read all scan files from the scans/ folder
      server.middlewares.use('/api/scan-folder', (req, res) => {
        try {
          const scansDir = path.resolve(__dirname, 'scans');
          if (!fs.existsSync(scansDir)) {
            fs.mkdirSync(scansDir, { recursive: true });
          }

          // Auto-sync 1: Check primary network folder T:\10.30 A.M. Production Meeting\สแกนนิ้ว record\SCAN นิ้ว GY
          const networkScanDir = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record\\SCAN นิ้ว GY';
          const networkBaseDir = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record';

          const syncFromFolder = (sourceDir: string) => {
            if (fs.existsSync(sourceDir)) {
              try {
                const dirFiles = fs.readdirSync(sourceDir);
                const matchingFiles = dirFiles.filter(f => /^(2026\d{4}|\d{8})\.txt$/i.test(f) || (f.endsWith('.txt') && f.includes('2026')));
                for (const netFile of matchingFiles) {
                  try {
                    const src = path.join(sourceDir, netFile);
                    const dest = path.join(scansDir, netFile);
                    const srcStat = fs.statSync(src);
                    if (!fs.existsSync(dest) || srcStat.mtimeMs > fs.statSync(dest).mtimeMs) {
                      fs.copyFileSync(src, dest);
                    }
                  } catch (e) {}
                }
              } catch (e) {}
            }
          };

          syncFromFolder(networkScanDir);
          syncFromFolder(networkBaseDir);

          // Auto-sync 2: Check Downloads folder for new scan files (e.g. 2026xxxx.txt) and copy to scans/
          const userHome = process.env.USERPROFILE || 'C:\\Users\\aa11909';
          const downloadsDir = path.join(userHome, 'Downloads');
          if (fs.existsSync(downloadsDir)) {
            try {
              const dlFiles = fs.readdirSync(downloadsDir);
              const matchingDl = dlFiles.filter(f => /^(2026\d{4}|\d{8})\.txt$/i.test(f) || (f.endsWith('.txt') && f.includes('2026')));
              for (const dlFile of matchingDl) {
                try {
                  const src = path.join(downloadsDir, dlFile);
                  const dest = path.join(scansDir, dlFile);
                  const srcStat = fs.statSync(src);
                  // Copy if not exists or if source in Downloads was modified more recently
                  if (!fs.existsSync(dest) || srcStat.mtimeMs > fs.statSync(dest).mtimeMs) {
                    fs.copyFileSync(src, dest);
                  }
                } catch (e) {
                  // ignore copy error
                }
              }
            } catch (e) {
              // ignore dir read error
            }
          }

          let files = fs.readdirSync(scansDir);
          let scanFiles = files.filter(f => !f.startsWith('.') && /\.(txt|dat|csv|log)$/i.test(f));

          if (scanFiles.length === 0) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: false,
              message: `ยังไม่พบไฟล์สแกน (.txt, .dat, .csv) ในโฟลเดอร์ scans (C:\\Users\\aa11909\\OneDrive - Goodyear\\Documents\\AI\\OHPA\\scans)`,
              folderPath: scansDir,
              files: []
            }));
            return;
          }

          const fileContents = [];
          for (const filename of scanFiles) {
            try {
              const filePath = path.join(scansDir, filename);
              const content = fs.readFileSync(filePath, 'utf-8');
              const stats = fs.statSync(filePath);
              fileContents.push({
                fileName: filename,
                content,
                modifiedTime: stats.mtime.toISOString(),
                sizeBytes: stats.size
              });
            } catch (readErr) {
              console.warn(`Cannot read file ${filename}:`, readErr);
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            folderPath: scansDir,
            fileCount: fileContents.length,
            files: fileContents
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            message: err.message || 'เกิดข้อผิดพลาดในการอ่านโฟลเดอร์ scans'
          }));
        }
      });

      // API to open folder in Windows Explorer
      server.middlewares.use('/api/open-folder', (req, res) => {
        try {
          const networkScanDir = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record\\SCAN นิ้ว GY';
          const scansDir = path.resolve(__dirname, 'scans');
          const targetDir = fs.existsSync(networkScanDir) ? networkScanDir : scansDir;
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          exec(`explorer "${targetDir}"`);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, folderPath: targetDir }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message: err.message }));
        }
      });

      // API to fetch Stocking Tonnage Report 55012 from 10.124.129.34
      server.middlewares.use('/api/stocking-tonnage', (req, res) => {
        const urlObj = new URL(req.url || '', 'http://localhost');
        let pdParam = urlObj.searchParams.get('pd') || '';
        const dateParam = urlObj.searchParams.get('date') || '';

        // If dateParam given in DD/MM/YYYY or YYYY-MM-DD format, convert to YYYYMMDD000000
        if (!pdParam && dateParam) {
          const clean = dateParam.trim();
          const parts = clean.split(/[/.-]/);
          if (parts.length === 3) {
            if (parts[2].length === 4) {
              // DD/MM/YYYY -> YYYYMMDD000000
              const dd = parts[0].padStart(2, '0');
              const mm = parts[1].padStart(2, '0');
              const yyyy = parts[2];
              pdParam = `${yyyy}${mm}${dd}000000`;
            } else if (parts[0].length === 4) {
              // YYYY-MM-DD -> YYYYMMDD000000
              const yyyy = parts[0];
              const mm = parts[1].padStart(2, '0');
              const dd = parts[2].padStart(2, '0');
              pdParam = `${yyyy}${mm}${dd}000000`;
            }
          }
        }

        const https = require('https');
        const queryPath = pdParam
          ? `/l2web/datahost/all_areas/dpics.php?server=db_server&action=r06&mt=TBM&smt=TBM&pd=${pdParam}`
          : '/l2web/datahost/all_areas/dpics.php?server=db_server&action=r06';

        const reqOptions = {
          hostname: '10.124.129.34',
          port: 443,
          path: queryPath,
          method: 'GET',
          rejectUnauthorized: false,
          timeout: 7000
        };

        const clientReq = https.request(reqOptions, (clientRes: any) => {
          let body = '';
          clientRes.on('data', (chunk: any) => body += chunk);
          clientRes.on('end', () => {
            try {
              // Extract date options
              const optionsMatch = body.match(/<OPTION value="(\d+)"\s*(SELECTED)?\s*>([^<]+)<\/OPTION>/gi) || [];
              let activeDayLabel = '';
              const availableDates = optionsMatch.map((opt: string) => {
                const val = (opt.match(/value="(\d+)"/i) || [])[1];
                const label = (opt.match(/>([^<]+)<\/OPTION>/i) || [])[1]?.trim() || '';
                const selected = /SELECTED/i.test(opt);
                if (selected) activeDayLabel = label;
                return { value: val, label, selected };
              });

              // Extract table rows
              const rowMatches = body.match(/<tr class=tabledata[12] >([\s\S]*?)<\/tr>/g) || [];
              const rows: any[] = [];
              let totalRow: any = null;

              rowMatches.forEach((r: string) => {
                const cells = (r.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map((td: string) => td.replace(/<[^>]+>/g, '').trim());
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

                const parseNum = (str: string) => {
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
                  dailyTotalPallets: parseNum(cells[numStartIdx + 9])
                };

                if (isTotal) {
                  totalRow = rowData;
                } else {
                  rows.push(rowData);
                }
              });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                productionDay: activeDayLabel || (pdParam ? `${pdParam.slice(6,8)}/${pdParam.slice(4,6)}/${pdParam.slice(0,4)}` : '-'),
                productionDayValue: pdParam || availableDates[0]?.value || '',
                availableDates,
                rows,
                total: totalRow,
                fetchedAt: new Date().toISOString()
              }));
            } catch (parseErr: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, message: `Parse error: ${parseErr.message}` }));
            }
          });
        });

        clientReq.on('error', (err: any) => {
          // Fallback if offline
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            message: `ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์รายงาน 55012 (10.124.129.34): ${err.message}`,
            isMock: true,
            productionDay: '14/09/2026',
            productionDayValue: '20260914000000',
            availableDates: [
              { value: '20260915000000', label: '15/09/2026', selected: false },
              { value: '20260914000000', label: '14/09/2026', selected: true },
              { value: '20260913000000', label: '13/09/2026', selected: false },
              { value: '20260912000000', label: '12/09/2026', selected: false }
            ],
            rows: [
              { code: '6', categoryName: 'Aero Radial', mtdTonnage: 145348, mtdPallets: 2498, shift1Tonnage: 5091, shift1Pallets: 70, shift2Tonnage: 4992, shift2Pallets: 70, shift3Tonnage: 2188, shift3Pallets: 66, dailyTotalTonnage: 12271, dailyTotalPallets: 206 },
              { code: 'A', categoryName: 'Aircraft', mtdTonnage: 7041, mtdPallets: 1601, shift1Tonnage: 33, shift1Pallets: 7, shift2Tonnage: 202, shift2Pallets: 43, shift3Tonnage: 157, shift3Pallets: 33, dailyTotalTonnage: 392, dailyTotalPallets: 83 },
              { code: 'B', categoryName: 'Aircraft High Performance', mtdTonnage: 207241, mtdPallets: 4198, shift1Tonnage: 4524, shift1Pallets: 84, shift2Tonnage: 4767, shift2Pallets: 107, shift3Tonnage: 5254, shift3Pallets: 119, dailyTotalTonnage: 14545, dailyTotalPallets: 310 },
              { code: 'D', categoryName: 'Passenger Radial', mtdTonnage: 0, mtdPallets: 0, shift1Tonnage: 0, shift1Pallets: 0, shift2Tonnage: 0, shift2Pallets: 0, shift3Tonnage: 0, shift3Pallets: 0, dailyTotalTonnage: 0, dailyTotalPallets: 0 },
              { code: 'P', categoryName: 'Pass Conv Spare', mtdTonnage: 0, mtdPallets: 0, shift1Tonnage: 0, shift1Pallets: 0, shift2Tonnage: 0, shift2Pallets: 0, shift3Tonnage: 0, shift3Pallets: 0, dailyTotalTonnage: 0, dailyTotalPallets: 0 },
              { code: 'Q', categoryName: 'Passenger Radial', mtdTonnage: 123786, mtdPallets: 11278, shift1Tonnage: -516, shift1Pallets: -41, shift2Tonnage: 4123, shift2Pallets: 380, shift3Tonnage: 2532, shift3Pallets: 240, dailyTotalTonnage: 6139, dailyTotalPallets: 579 },
              { code: 'T', categoryName: 'Bias Truck', mtdTonnage: 0, mtdPallets: 0, shift1Tonnage: 0, shift1Pallets: 0, shift2Tonnage: 0, shift2Pallets: 0, shift3Tonnage: 0, shift3Pallets: 0, dailyTotalTonnage: 0, dailyTotalPallets: 0 },
              { code: 'W', categoryName: 'ULT', mtdTonnage: 848420, mtdPallets: 60028, shift1Tonnage: 9284, shift1Pallets: 652, shift2Tonnage: 22660, shift2Pallets: 1621, shift3Tonnage: 18551, shift3Pallets: 1279, dailyTotalTonnage: 50495, dailyTotalPallets: 3552 }
            ],
            total: { code: 'TOTAL', categoryName: 'TOTAL', mtdTonnage: 1331836, mtdPallets: 79603, shift1Tonnage: 18416, shift1Pallets: 772, shift2Tonnage: 36744, shift2Pallets: 2221, shift3Tonnage: 28682, shift3Pallets: 1737, dailyTotalTonnage: 83842, dailyTotalPallets: 4730 }
          }));
        });

        clientReq.on('timeout', () => {
          clientReq.destroy();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            message: 'Timeout connecting to 10.124.129.34',
            isMock: true
          }));
        });

        clientReq.end();
      });

      // API to fetch Contractor (WAS) records
      server.middlewares.use('/api/contractor-data', (req, res) => {
        try {
          const wasScansDir = path.resolve(__dirname, 'scans_was');
          if (!fs.existsSync(wasScansDir)) {
            fs.mkdirSync(wasScansDir, { recursive: true });
          }

          const networkBaseDir = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record';
          const networkWasScanDir = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record\\SCAN นิ้ว WAS';

          // Sync Name list WAS
          if (fs.existsSync(networkBaseDir)) {
            try {
              const files = fs.readdirSync(networkBaseDir);
              const nameListFile = files.find(f => f.toLowerCase().includes('name list was'));
              if (nameListFile) {
                const src = path.join(networkBaseDir, nameListFile);
                const dest = path.join(wasScansDir, nameListFile);
                if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
                  fs.copyFileSync(src, dest);
                }
              }
            } catch (e) {}
          }

          // Sync scan records
          if (fs.existsSync(networkWasScanDir)) {
            try {
              const files = fs.readdirSync(networkWasScanDir);
              for (const f of files) {
                if (f.endsWith('.xls') || f.endsWith('.xlsx') || f.endsWith('.csv') || f.endsWith('.txt')) {
                  const src = path.join(networkWasScanDir, f);
                  const dest = path.join(wasScansDir, f);
                  if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
                    fs.copyFileSync(src, dest);
                  }
                }
              }
            } catch (e) {}
          }

          const findFile = (dir1: string, dir2: string, pattern: string) => {
            if (fs.existsSync(dir1)) {
              const f = fs.readdirSync(dir1).find(x => x.toLowerCase().includes(pattern.toLowerCase()));
              if (f) return path.join(dir1, f);
            }
            if (fs.existsSync(dir2)) {
              const f = fs.readdirSync(dir2).find(x => x.toLowerCase().includes(pattern.toLowerCase()));
              if (f) return path.join(dir2, f);
            }
            return null;
          };

          const nameListPath = findFile(networkBaseDir, wasScansDir, 'name list was');
          const scanFilePath = findFile(networkWasScanDir, wasScansDir, 'รายงานการทำงาน');

          if (!nameListPath && !scanFilePath) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: 'ไม่พบไฟล์ Contractor ในโฟลเดอร์ T: หรือ scans_was' }));
            return;
          }

          // Parse employee mapping
          const contractorMapping: Record<string, any> = {};
          if (nameListPath && fs.existsSync(nameListPath)) {
            const buf = fs.readFileSync(nameListPath);
            const wb = XLSX.read(buf, { type: 'buffer' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            for (let i = 3; i < data.length; i++) {
              const row = data[i];
              if (!row || !row[1]) continue;
              const empCode = String(row[1]).trim();
              contractorMapping[empCode] = {
                empCode,
                nameEn: String(row[2] || '').trim(),
                nameTh: String(row[3] || '').trim(),
                position: String(row[4] || '').trim(),
                location: String(row[5] || '').trim(),
                closing: String(row[6] || '').trim(),
                department: String(row[7] || '').trim(),
                type: String(row[9] || '').trim()
              };
            }
          }

          // Parse scan records
          const recordsByDate: Record<string, any> = {};
          if (scanFilePath && fs.existsSync(scanFilePath)) {
            const buf = fs.readFileSync(scanFilePath);
            const wb = XLSX.read(buf, { type: 'buffer' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            const excelDateToDateObj = (serial: any) => {
              if (typeof serial === 'number') {
                const utc_days = Math.floor(serial - 25569);
                const utc_value = utc_days * 86400;
                const d = new Date(utc_value * 1000);
                const day = d.getUTCDate();
                const month = d.getUTCMonth() + 1;
                const year = d.getUTCFullYear();
                const pad = (n: number) => String(n).padStart(2, '0');
                return {
                  iso: `${year}-${pad(month)}-${pad(day)}`,
                  formattedThai: `วันที่ ${day}/${month}/${year}`,
                  formattedShort: `${day}/${month}/${year}`
                };
              }
              return {
                iso: String(serial),
                formattedThai: `วันที่ ${serial}`,
                formattedShort: String(serial)
              };
            };

            for (let i = 1; i < data.length; i++) {
              const row = data[i];
              if (!row || !row[0]) continue;

              const empCode = String(row[0]).trim();
              const scanNameTh = String(row[1] || '').trim();
              const serialDate = row[2];
              const shiftRaw = String(row[3] || '').trim();
              const scanIn = row[4] ? String(row[4]).trim() : '';
              const scanOut = row[5] ? String(row[5]).trim() : '';
              const late = row[6] ? String(row[6]).trim() : '';
              const earlyOut = row[7] ? String(row[7]).trim() : '';
              const absent = row[8] ? String(row[8]).trim() : '';
              const remark = row[9] ? String(row[9]).trim() : '';
              const deptRaw = row[10] ? String(row[10]).trim() : '';
              const isWorkDay = row[11] === 1 || row[11] === '1';
              const otHours = (row[12] !== undefined && row[12] !== null && row[12] !== '') ? parseFloat(row[12]) || 0 : 0;

              const dateInfo = excelDateToDateObj(serialDate);
              const dateKey = dateInfo.formattedShort;

              let shiftNumber = 1;
              let shiftLabel = 'กะ 1 (07:00 - 15:00)';
              if (shiftRaw.includes('15.00') || shiftRaw.includes('บ่าย')) {
                shiftNumber = 2;
                shiftLabel = 'กะ 2 (15:00 - 23:00)';
              } else if (shiftRaw.includes('23.00') || shiftRaw.includes('ดึก')) {
                shiftNumber = 3;
                shiftLabel = 'กะ 3 (23:00 - 07:00)';
              }

              const hasScannedIn = Boolean(scanIn);
              const normalHours = (hasScannedIn && isWorkDay) ? 8 : (hasScannedIn ? 0 : 0);
              const totalHours = normalHours + otHours;

              const empInfo = contractorMapping[empCode] || {
                empCode,
                nameEn: '',
                nameTh: scanNameTh,
                position: 'Contractor',
                location: deptRaw,
                closing: '',
                department: 'MFG',
                type: 'Hourly'
              };

              let status = 'ปกติ';
              if (!hasScannedIn) {
                status = remark || (absent ? 'ขาดงาน' : 'วันหยุด');
              } else if (late) {
                status = `มาสาย (${late})`;
              } else if (otHours > 0) {
                status = `ปกติ (+OT ${otHours} ชม.)`;
              }

              const record = {
                empCode,
                nameTh: empInfo.nameTh || scanNameTh,
                nameEn: empInfo.nameEn,
                position: empInfo.position,
                location: empInfo.location || deptRaw,
                closing: empInfo.closing,
                department: empInfo.department,
                type: empInfo.type,
                shiftRaw,
                shiftNumber,
                shiftLabel,
                scanIn,
                scanOut,
                late,
                earlyOut,
                absent,
                remark,
                deptRaw,
                isWorkDay,
                hasScannedIn,
                normalHours,
                otHours,
                totalHours,
                status,
                date: dateInfo.iso,
                dateFormatted: dateInfo.formattedThai,
                dateShort: dateInfo.formattedShort
              };

              if (!recordsByDate[dateKey]) {
                recordsByDate[dateKey] = {
                  dateFormatted: dateInfo.formattedThai,
                  dateShort: dateKey,
                  isoDate: dateInfo.iso,
                  records: []
                };
              }
              recordsByDate[dateKey].records.push(record);
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            employeeCount: Object.keys(contractorMapping).length,
            datesCount: Object.keys(recordsByDate).length,
            contractorMapping,
            recordsByDate
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message: err.message }));
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), scanFolderApiPlugin()],
  server: {
    port: 3000,
    host: true,
    watch: {
      ignored: ['**/scans/**', '**/*.txt', '**/*.dat', '**/*.csv', '**/*.log', '**/node_modules/**']
    }
  }
});

