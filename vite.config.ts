import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

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

          let files = fs.readdirSync(scansDir);
          let scanFiles = files.filter(f => !f.startsWith('.') && /\.(txt|dat|csv|log)$/i.test(f));

          // Fallback: If scans/ is empty, check Downloads folder for scan files
          if (scanFiles.length === 0) {
            const userHome = process.env.USERPROFILE || 'C:\\Users\\aa11909';
            const downloadsDir = path.join(userHome, 'Downloads');
            if (fs.existsSync(downloadsDir)) {
              const dlFiles = fs.readdirSync(downloadsDir);
              const matchingDl = dlFiles.filter(f => /^(2026\d{4}|\d{8})\.txt$/i.test(f) || (f.endsWith('.txt') && f.includes('2026')));
              for (const dlFile of matchingDl) {
                try {
                  const src = path.join(downloadsDir, dlFile);
                  const dest = path.join(scansDir, dlFile);
                  fs.copyFileSync(src, dest);
                } catch (e) {
                  // ignore copy error
                }
              }
              // Re-read scans dir after copying
              files = fs.readdirSync(scansDir);
              scanFiles = files.filter(f => !f.startsWith('.') && /\.(txt|dat|csv|log)$/i.test(f));
            }
          }

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
          const scansDir = path.resolve(__dirname, 'scans');
          if (!fs.existsSync(scansDir)) {
            fs.mkdirSync(scansDir, { recursive: true });
          }
          exec(`explorer "${scansDir}"`);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, folderPath: scansDir }));
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

