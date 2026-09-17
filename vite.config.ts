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

      // API to sync adjustments from T: drive Excel (Daily_Adjustments_Template.xlsx)
      server.middlewares.use('/api/sync-adjustments', (req, res) => {
        try {
          const networkPath = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record\\ทำงานไม่ตรง ตำแหน่ง\\Daily_Adjustments_Template.xlsx';
          const localPath = path.resolve(__dirname, 'Daily_Adjustments_Template.xlsx');
          
          let targetPath = '';
          if (fs.existsSync(networkPath)) {
            targetPath = networkPath;
          } else if (fs.existsSync(localPath)) {
            targetPath = localPath;
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: false,
              message: 'ไม่พบไฟล์ Daily_Adjustments_Template.xlsx ทั้งบนไดรฟ์ T: และเครื่อง'
            }));
            return;
          }

          const stat = fs.statSync(targetPath);
          const buf = fs.readFileSync(targetPath);
          const wb = XLSX.read(buf, { type: 'buffer' });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(ws);

          let empMap: Record<string, any> = {};
          const empMapPath = path.resolve(__dirname, 'src/data/default_emp_mapping.json');
          if (fs.existsSync(empMapPath)) {
            try {
              empMap = JSON.parse(fs.readFileSync(empMapPath, 'utf8'));
            } catch (e) {}
          }

          const parsedAdjustments: any[] = [];

          rawRows.forEach((row: any, idx: number) => {
            const keys = Object.keys(row);
            const findVal = (keywords: string[]) => {
              const matchKey = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase())));
              return matchKey && row[matchKey] !== undefined && row[matchKey] !== null ? String(row[matchKey]).trim() : '';
            };

            const rawEmpId = findVal(['รหัส', 'empid', 'emp id', 'id', 'emp']);
            if (!rawEmpId) return;

            const cleanId = rawEmpId.replace(/\D/g, '').padStart(5, '0');
            const rawDate = findVal(['วัน', 'date']);
            let dateStr = '';

            if (rawDate) {
              const numDate = Number(rawDate);
              if (!isNaN(numDate) && numDate >= 30000 && numDate <= 70000) {
                const utcDays = Math.floor(numDate - 25569);
                const dateInfo = new Date(utcDays * 86400 * 1000);
                const mm = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(dateInfo.getUTCDate()).padStart(2, '0');
                const yyyy = String(dateInfo.getUTCFullYear());
                dateStr = `${dd}/${mm}/${yyyy}`;
              } else {
                dateStr = rawDate;
              }
            }

            const machineTarget = findVal(['เครื่องจักรที่ไปทำ ot', 'ot machine', 'เครื่องจักร', 'โอที', 'ot', 'machine']);
            const regMachine = findVal(['เครื่องจักรที่ทำเวลาปกติ', 'regular machine', 'กะปกติ', 'regular']);
            const timeStr = findVal(['เวลา', 'time']);
            const reason = findVal(['เหตุผล', 'หมายเหตุ', 'reason', 'note']);

            let customStart: string | undefined = undefined;
            let customEnd: string | undefined = undefined;
            let isApproved = false;

            if (timeStr) {
              isApproved = true;
              const normTime = timeStr.replace(/\./g, ':');
              const timeMatches = normTime.match(/\d{1,2}:\d{2}/g);
              if (timeMatches && timeMatches.length >= 1) {
                customStart = timeMatches[0].padStart(5, '0');
                if (timeMatches.length >= 2) {
                  customEnd = timeMatches[1].padStart(5, '0');
                }
              } else if (!isNaN(Number(timeStr))) {
                customStart = `${timeStr.padStart(2, '0')}:00`;
              }
            }

            let finalOtMachine = machineTarget || undefined;
            if (finalOtMachine) {
              if (/3\s*roll/i.test(finalOtMachine)) finalOtMachine = '3-Roll Calender';
              else if (/mixer\s*2/i.test(finalOtMachine)) finalOtMachine = 'Mixer 2';
              else if (/chaffer/i.test(finalOtMachine)) finalOtMachine = 'Chaffer Lay-up';
              else if (/54/i.test(finalOtMachine)) finalOtMachine = '54" Band Building';
              else if (/72/i.test(finalOtMachine)) finalOtMachine = '72" Band Building';
            }

            let finalRegMachine = regMachine || undefined;
            if (finalRegMachine) {
              if (/chaffer/i.test(finalRegMachine)) finalRegMachine = 'Chaffer Lay-up';
            }

            const empInfo = empMap[cleanId];

            if (!finalRegMachine && finalOtMachine && timeStr && !finalOtMachine.includes('แทน WAS') && (
              (timeStr.includes('15') && timeStr.includes('23') && !findVal(['เครื่องจักรที่ไปทำ ot', 'ot machine', 'โอที'])) ||
              (timeStr.includes('07') && timeStr.includes('15') && !findVal(['เครื่องจักรที่ไปทำ ot', 'ot machine', 'โอที']))
            )) {
              finalRegMachine = finalOtMachine;
              finalOtMachine = undefined;
            }

            let defaultReason = reason;
            if (!defaultReason) {
              if (finalOtMachine && timeStr) {
                defaultReason = `OT / ทำงานที่ ${finalOtMachine} (${timeStr})`;
              } else if (timeStr) {
                defaultReason = `เวลาพิเศษ ${timeStr}`;
              } else if (finalOtMachine) {
                defaultReason = `ย้ายทำ ${finalOtMachine}`;
              }
            }

            parsedAdjustments.push({
              id: `adj-${idx}-${cleanId}`,
              dateStr: dateStr || '14/09/2026',
              empId: cleanId,
              empName: empInfo?.nameTH || empInfo?.nameEN || `พนักงาน ${cleanId}`,
              regularMachineOverride: finalRegMachine,
              otMachineOverride: finalOtMachine,
              customStartTime: customStart,
              customEndTime: customEnd,
              isApprovedTiming: isApproved,
              reason: defaultReason
            });
          });

          // Save to default_adjustments.json
          const adjPath = path.resolve(__dirname, 'src/data/default_adjustments.json');
          try {
            fs.writeFileSync(adjPath, JSON.stringify(parsedAdjustments, null, 2), 'utf8');
          } catch (writeErr) {
            console.warn('Could not write default_adjustments.json:', writeErr);
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            targetPath,
            modifiedTime: stat.mtime.toISOString(),
            count: parsedAdjustments.length,
            adjustments: parsedAdjustments
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            message: err.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์ Excel'
          }));
        }
      });

      // API to sync PDI and B-end Bead data from T: drive Excel (OPAH hour PDI& B-ead.xlsx)
      server.middlewares.use('/api/sync-pdi-bead', (req, res) => {
        try {
          const networkPath = 'T:\\10.30 A.M. Production Meeting\\สแกนนิ้ว record\\OPAH hour PDI& B-ead.xlsx';
          const localPath = path.resolve(__dirname, 'OPAH hour PDI& B-ead.xlsx');
          
          let targetPath = '';
          if (fs.existsSync(networkPath)) {
            targetPath = networkPath;
          } else if (fs.existsSync(localPath)) {
            targetPath = localPath;
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: false,
              message: 'ไม่พบไฟล์ OPAH hour PDI& B-ead.xlsx ทั้งบนไดรฟ์ T: และเครื่อง'
            }));
            return;
          }

          const stat = fs.statSync(targetPath);
          const buf = fs.readFileSync(targetPath);
          const wb = XLSX.read(buf, { type: 'buffer' });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

          const pdiPersons: any[] = [];
          const pdiDailyTotals: Record<number, number> = {};
          const beadDailyTotals: Record<number, number> = {};

          for (let d = 1; d <= 31; d++) {
            pdiDailyTotals[d] = 0;
            beadDailyTotals[d] = 0;
          }

          let dayColMap: Record<number, number> = {};
          for (let r = 0; r < Math.min(data.length, 5); r++) {
            const row = data[r] || [];
            let foundDays = 0;
            const tempMap: Record<number, number> = {};
            for (let c = 0; c < row.length; c++) {
              const val = parseInt(String(row[c]).trim(), 10);
              if (!isNaN(val) && val >= 1 && val <= 31) {
                tempMap[c] = val;
                foundDays++;
              }
            }
            if (foundDays >= 10) {
              dayColMap = tempMap;
              break;
            }
          }

          if (Object.keys(dayColMap).length === 0) {
            for (let d = 1; d <= 31; d++) {
              dayColMap[d + 2] = d;
            }
          }

          for (let r = 0; r < data.length; r++) {
            const row = data[r] || [];
            const textAll = row.map(cell => String(cell || '')).join(' ').toLowerCase();

            const col0 = String(row[0] || '').trim();
            const col1 = String(row[1] || '').trim();
            const col2 = String(row[2] || '').trim();

            const isPdiPerson = (
              col0.toLowerCase().includes('somrudee') ||
              col0.toLowerCase().includes('damrongsak') ||
              col0.toLowerCase().includes('kitipan') ||
              col0.toLowerCase().includes('sangpian') ||
              col0.toLowerCase().includes('vattana') ||
              col1.toLowerCase().includes('npi') ||
              col2.toLowerCase().includes('tire dev')
            );

            if (isPdiPerson) {
              const dailyHours: Record<number, number> = {};
              for (let d = 1; d <= 31; d++) dailyHours[d] = 0;

              for (const [cStr, d] of Object.entries(dayColMap)) {
                const c = Number(cStr);
                const val = parseFloat(String(row[c] || '0').trim());
                if (!isNaN(val)) {
                  dailyHours[d] = val;
                }
              }

              pdiPersons.push({
                name: col0 || `Person ${pdiPersons.length + 1}`,
                group: col1 || '',
                desc: col2 || '',
                dailyHours
              });
            }

            const isPdiTotalRow = r === 6 || (
              r > 0 && r < 9 &&
              (col0.toLowerCase().includes('total') || col1.toLowerCase().includes('total') || col2.toLowerCase().includes('total'))
            );

            if (isPdiTotalRow) {
              for (const [cStr, d] of Object.entries(dayColMap)) {
                const c = Number(cStr);
                const val = parseFloat(String(row[c] || '0').trim());
                pdiDailyTotals[d] = (!isNaN(val) && val > 0) ? val : 0;
              }
            }

            const isBeadRow = r === 10 || (
              r > 8 &&
              (col0.toLowerCase().includes('bead') || col1.toLowerCase().includes('bead') || col2.toLowerCase().includes('bead') || textAll.includes('bead total'))
            );

            if (isBeadRow) {
              for (const [cStr, d] of Object.entries(dayColMap)) {
                const c = Number(cStr);
                const val = parseFloat(String(row[c] || '0').trim());
                beadDailyTotals[d] = (!isNaN(val) && val > 0) ? Math.round(val * 100) / 100 : 0;
              }
            }
          }

          if (pdiPersons.length > 0) {
            const hasAnyPdiTotal = Object.values(pdiDailyTotals).some(v => v > 0);
            if (!hasAnyPdiTotal) {
              for (let d = 1; d <= 31; d++) {
                pdiDailyTotals[d] = pdiPersons.reduce((sum, p) => sum + (p.dailyHours[d] || 0), 0);
              }
            }
          }

          const result = {
            monthYear: '09/2026',
            pdiPersons,
            pdiDailyTotals,
            beadDailyTotals,
            updatedAt: new Date().toISOString()
          };

          const codeContent = `export interface PdiPersonRecord {
  name: string;
  group: string;
  desc: string;
  dailyHours: Record<number, number>;
}

export interface PdiBeadReport {
  monthYear: string;
  pdiPersons: PdiPersonRecord[];
  pdiDailyTotals: Record<number, number>;
  beadDailyTotals: Record<number, number>;
  updatedAt?: string;
}

export const DEFAULT_PDI_BEAD_REPORT: PdiBeadReport = ${JSON.stringify(result, null, 2)};
`;
          try {
            fs.writeFileSync(path.resolve(__dirname, 'src/data/default_pdi_bead.ts'), codeContent, 'utf8');
          } catch (wErr) {}

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            targetPath,
            modifiedTime: stat.mtime.toISOString(),
            report: result
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: false,
            message: err.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์ OPAH hour PDI& B-ead.xlsx'
          }));
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

          // Sync Name list WAS and WAS_รายเดือน
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
              const monthlyFile = files.find(f => f.toLowerCase().includes('was_รายเดือน') || f.toLowerCase().includes('was_salary'));
              if (monthlyFile) {
                const src = path.join(networkBaseDir, monthlyFile);
                const dest = path.join(wasScansDir, monthlyFile);
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
          const monthlyListPath = findFile(networkBaseDir, wasScansDir, 'was_รายเดือน') || findFile(networkBaseDir, wasScansDir, 'was_salary');

          // Parse employee mapping
          const contractorMapping: Record<string, any> = {};
          const parseContractorSheet = (filePath: string) => {
            if (!filePath || !fs.existsSync(filePath)) return;
            try {
              const buf = fs.readFileSync(filePath);
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
                  type: String(row[9] || '').trim() || 'Hourly'
                };
              }
            } catch (err) {
              console.warn(`Error parsing contractor sheet ${filePath}:`, err);
            }
          };

          if (nameListPath) parseContractorSheet(nameListPath);
          if (monthlyListPath) parseContractorSheet(monthlyListPath);

          // Find ALL scan files (excluding mapping files)
          const targetWasDir = fs.existsSync(networkWasScanDir) ? networkWasScanDir : wasScansDir;
          const wasFiles = fs.existsSync(targetWasDir)
            ? fs.readdirSync(targetWasDir).filter(f => (f.endsWith('.xls') || f.endsWith('.xlsx')) && !f.toLowerCase().includes('name list') && !f.toLowerCase().includes('รายเดือน'))
            : [];

          if (!nameListPath && !monthlyListPath && wasFiles.length === 0) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: 'ไม่พบไฟล์ Contractor ในโฟลเดอร์ T: หรือ scans_was' }));
            return;
          }

          const formatExcelTime = (val: any) => {
            if (val === undefined || val === null || val === '') return '';
            if (typeof val === 'number') {
              const totalSeconds = Math.round(val * 86400);
              const hours = Math.floor(totalSeconds / 3600) % 24;
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const pad = (n: number) => String(n).padStart(2, '0');
              return `${pad(hours)}:${pad(minutes)}`;
            }
            return String(val).trim();
          };

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
            const str = String(serial || '').trim();
            const dmy = str.replace(/^[^\d]*/, '').trim();
            const parts = dmy.split(/[/.-]/);
            if (parts.length === 3) {
              const d = parseInt(parts[0], 10);
              const m = parseInt(parts[1], 10);
              const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              const pad = (n: number) => String(n).padStart(2, '0');
              return {
                iso: `${y}-${pad(m)}-${pad(d)}`,
                formattedThai: `วันที่ ${d}/${m}/${y}`,
                formattedShort: `${d}/${m}/${y}`
              };
            }
            return {
              iso: str,
              formattedThai: `วันที่ ${str}`,
              formattedShort: str
            };
          };

          // Parse scan records across ALL files and ALL sheets (preserving historical records)
          let recordsByDate: Record<string, any> = {};
          const defaultContractorPath = path.resolve(__dirname, 'src/data/default_contractor_data.ts');
          if (fs.existsSync(defaultContractorPath)) {
            try {
              const defContent = fs.readFileSync(defaultContractorPath, 'utf8');
              const recMatch = defContent.match(/export const DEFAULT_CONTRACTOR_RECORDS_BY_DATE[\s\S]*?=\s*({[\s\S]*});?\s*$/);
              if (recMatch && recMatch[1]) {
                recordsByDate = JSON.parse(recMatch[1].replace(/;\s*$/, ''));
              }
            } catch (pErr) {}
          }

          // Sort files so older files are read first, and newer daily exports take precedence
          wasFiles.sort((a, b) => a.localeCompare(b));

          for (const f of wasFiles) {
            const scanFilePath = path.join(targetWasDir, f);
            if (!fs.existsSync(scanFilePath)) continue;
            try {
              const buf = fs.readFileSync(scanFilePath);
              const wb = XLSX.read(buf, { type: 'buffer' });

              wb.SheetNames.forEach((sheetName: string) => {
                const ws = wb.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                const isMonthlySheet = sheetName.includes('รายเดือน') || sheetName.toLowerCase().includes('salary');

                let headerRow = -1;
                for (let i = 0; i < Math.min(5, data.length); i++) {
                  const row = data[i];
                  if (row && (row.includes('รหัสพนักงาน') || row.includes('ชื่อ') || row.includes('วันที่/เวลา'))) {
                    headerRow = i;
                    break;
                  }
                }
                if (headerRow < 0) headerRow = 0;

                for (let i = headerRow + 1; i < data.length; i++) {
                  const row = data[i];
                  if (!row || !row[0] || row[0] === 'รหัสพนักงาน') continue;

                  const empCode = String(row[0]).trim();
                  const scanNameTh = String(row[1] || '').trim();
                  const serialDate = row[2];
                  const shiftRaw = String(row[3] || '').trim();
                  const scanIn = formatExcelTime(row[4]);
                  const scanOut = formatExcelTime(row[5]);
                  const late = row[6] ? String(row[6]).trim() : '';
                  const earlyOut = row[7] ? String(row[7]).trim() : '';
                  const absent = row[8] ? String(row[8]).trim() : '';
                  const remark = row[9] ? String(row[9]).trim() : '';
                  const deptRaw = row[10] ? String(row[10]).trim() : '';
                  const isWorkDay = row[11] === 1 || row[11] === '1' || row[11] === true;
                  let otCol = (row[12] !== undefined && row[12] !== null && row[12] !== '') ? parseFloat(row[12]) || 0 : 0;

                  const dateInfo = excelDateToDateObj(serialDate);
                  const dateKey = dateInfo.formattedShort;

                  const hasScannedIn = Boolean(scanIn);
                  let shiftNumber = 1;
                  let shiftLabel = 'กะ 1 (07:00 - 15:00)';
                  let normalHours = hasScannedIn ? 8 : 0;
                  let otHours = otCol;

                  if (hasScannedIn) {
                    const inParts = scanIn.split(':');
                    const inHour = parseInt(inParts[0], 10);

                    let outHour = -1;
                    if (scanOut) {
                      const outParts = scanOut.split(':');
                      outHour = parseInt(outParts[0], 10);
                    }

                    // 1. เข้า 7.00 - 19.00 -> กะ 1 พร้อม OT 4 ชม
                    if (inHour >= 5 && inHour < 12) {
                      shiftNumber = 1;
                      if (otCol >= 4 || outHour >= 19) {
                        shiftLabel = 'กะ 1 + OT 4h (07:00 - 19:00)';
                        if (otHours === 0) otHours = 4;
                      } else if (otCol > 0) {
                        shiftLabel = `กะ 1 + OT ${otCol}h`;
                      } else {
                        shiftLabel = 'กะ 1 (07:00 - 15:00)';
                      }
                    }
                    // 2. เข้า 15.00 - 07.00 -> กะ 2 + OT 8 ชม ข้ามไปกะ 3
                    else if (inHour >= 12 && inHour < 17) {
                      shiftNumber = 3;
                      if (outHour >= 6 && outHour <= 9) {
                        shiftLabel = 'กะ 3 + OT ก่อนกะ 8h (15:00 - 07:00)';
                        if (otHours === 0) otHours = 8;
                      } else {
                        shiftNumber = 2;
                        shiftLabel = 'กะ 2 (15:00 - 23:00)';
                      }
                    }
                    // 3. เข้า 18.00 / 19.00 - 07.00 -> กะ 3 พร้อม OT 4-5 ชม ก่อนกะ
                    else if (inHour >= 17 && inHour < 22) {
                      shiftNumber = 3;
                      const otCalculated = Math.max(0, 23 - inHour);
                      if (otHours === 0) otHours = otCalculated;
                      shiftLabel = `กะ 3 + OT ก่อนกะ ${otHours}h (${scanIn} - 07:00)`;
                    }
                    // 4. เข้า 23.00 - 07.00 -> กะ 3
                    else {
                      shiftNumber = 3;
                      shiftLabel = 'กะ 3 (23:00 - 07:00)';
                    }
                  } else {
                    if (shiftRaw.includes('15.00') || shiftRaw.includes('บ่าย')) {
                      shiftNumber = 2;
                      shiftLabel = 'กะ 2 (15:00 - 23:00)';
                    } else if (shiftRaw.includes('23.00') || shiftRaw.includes('ดึก')) {
                      shiftNumber = 3;
                      shiftLabel = 'กะ 3 (23:00 - 07:00)';
                    } else {
                      shiftNumber = 1;
                      shiftLabel = 'กะ 1 (07:00 - 15:00)';
                    }
                    normalHours = 0;
                    otHours = 0;
                  }

                  const totalHours = normalHours + otHours;

                  const empInfo = contractorMapping[empCode] || {
                    empCode,
                    nameEn: '',
                    nameTh: scanNameTh,
                    position: isMonthlySheet ? 'WAS Monthly' : 'Contractor',
                    location: deptRaw,
                    closing: '',
                    department: 'MFG',
                    type: isMonthlySheet ? 'Salary' : 'Hourly'
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

                  const existingIdx = recordsByDate[dateKey].records.findIndex((r: any) => r.empCode === empCode);
                  if (existingIdx >= 0) {
                    const existing = recordsByDate[dateKey].records[existingIdx];
                    // Keep the most complete record (prefer non-empty scanOut and higher OT)
                    if (record.scanOut || !existing.scanOut || record.otHours > existing.otHours || (!existing.hasScannedIn && record.hasScannedIn)) {
                      recordsByDate[dateKey].records[existingIdx] = {
                        ...existing,
                        ...record,
                        scanOut: record.scanOut || existing.scanOut,
                        otHours: Math.max(record.otHours, existing.otHours),
                        totalHours: Math.max(record.totalHours, existing.totalHours),
                        status: (record.otHours > 0 || existing.otHours > 0) ? `ปกติ (+OT ${Math.max(record.otHours, existing.otHours)} ชม.)` : (record.status || existing.status)
                      };
                    }
                  } else {
                    recordsByDate[dateKey].records.push(record);
                  }
                }
              });
            } catch (scanErr) {
              console.warn(`Error reading scan file ${scanFilePath}:`, scanErr);
            }
          }

          // Auto persist to default_contractor_data.ts
          try {
            const contractorTs = `import { ContractorScanRecord, ContractorEmployeeInfo } from '../types/contractor';

export const DEFAULT_CONTRACTOR_MAPPING: Record<string, ContractorEmployeeInfo> = ${JSON.stringify(contractorMapping, null, 2)};

export const DEFAULT_CONTRACTOR_RECORDS_BY_DATE: Record<string, {
  dateFormatted: string;
  dateShort: string;
  isoDate: string;
  records: ContractorScanRecord[];
}> = ${JSON.stringify(recordsByDate, null, 2)};
`;
            fs.writeFileSync(path.resolve(__dirname, 'src/data/default_contractor_data.ts'), contractorTs, 'utf8');
          } catch (wErr) {}

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
      ignored: [
        '**/scans/**',
        '**/scans_was/**',
        '**/*.txt',
        '**/*.dat',
        '**/*.csv',
        '**/*.log',
        '**/*.bat',
        '**/*.xlsx',
        '**/*.xls',
        '**/node_modules/**'
      ]
    }
  }
});

