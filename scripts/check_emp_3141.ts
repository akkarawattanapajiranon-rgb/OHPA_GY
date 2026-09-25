import { SCAN_FILE_PRESETS } from '../src/data/default_scan_record';
import { processScanRecords } from '../src/utils/parser';
import defaultEmpMapping from '../src/data/default_emp_mapping.json';
import defaultAdjustments from '../src/data/default_adjustments.json';

async function main() {
  console.log('=== Checking Scan Records for Employee 03141 (บุญเรือ อุ่มพิมาย) ===\n');

  const emp = (defaultEmpMapping as any)['03141'];
  console.log('ข้อมูลพนักงาน:');
  console.log(`- รหัส: ${emp?.empId || '03141'}`);
  console.log(`- ชื่อ: ${emp?.nameTH} (${emp?.nameEN})`);
  console.log(`- ตำแหน่ง: ${emp?.position}`);
  console.log(`- สังกัด/แผนก: ${emp?.dept} (Category: ${emp?.category})`);
  console.log(`- Machine/หน้าที่: ${emp?.machine}`);
  console.log('--------------------------------------------------------------------------------');

  console.log('\nประวัติการสแกนและผลการคำนวณแต่ละวัน (จากล่าสุดไปย้อนหลัง):');
  console.log('วันที่       | กะ | เวลาเข้า | เวลาออก | สถานะ   | ชม.ปกติ | ชม. OT | หมายเหตุ / ข้อความ');
  console.log('-----------------------------------------------------------------------------------------');

  for (const preset of SCAN_FILE_PRESETS) {
    const dLabel = (preset.dateFormatted || preset.name || preset.id || '').replace(/^[📅📄\s]*วันที่\s*/, '').trim();
    const res = processScanRecords(preset.content, defaultEmpMapping as any, defaultAdjustments as any);
    const rec = res.records.find(r => r.employeeId?.includes('3141') || r.name?.includes('บุญเรือ'));
    if (rec) {
      const inTime = rec.inTime || (rec.inScan ? `${String(rec.inScan.timestamp.getHours()).padStart(2, '0')}:${String(rec.inScan.timestamp.getMinutes()).padStart(2, '0')}` : '-');
      const outTime = rec.outTime || (rec.outScan ? `${String(rec.outScan.timestamp.getHours()).padStart(2, '0')}:${String(rec.outScan.timestamp.getMinutes()).padStart(2, '0')}` : '-');
      const shift = rec.shift ? `กะ ${rec.shift}` : '-';
      const status = rec.status || '-';
      const norm = rec.normalWorkHours !== undefined ? `${rec.normalWorkHours}h` : '-';
      const ot = rec.otHours !== undefined ? `${rec.otHours}h` : '-';
      const note = rec.otNote || rec.remark || '-';

      console.log(
        `${dLabel.padEnd(10, ' ')} | ` +
        `${shift.padEnd(4, ' ')} | ` +
        `${inTime.padEnd(8, ' ')} | ` +
        `${outTime.padEnd(7, ' ')} | ` +
        `${status.padEnd(7, ' ')} | ` +
        `${norm.padEnd(7, ' ')} | ` +
        `${ot.padEnd(6, ' ')} | ` +
        `${note}`
      );
    } else {
      console.log(`${dLabel.padEnd(10, ' ')} | ไม่พบการสแกนในไฟล์นี้ (ขาดงาน / วันหยุด)`);
    }
  }

  // Also check raw scan lines in all presets
  console.log('\n--- Raw Scan Lines for 03141 in scan files ---');
  for (const preset of SCAN_FILE_PRESETS) {
    const dLabel = (preset.dateFormatted || preset.name || preset.id || '').replace(/^[📅📄\s]*วันที่\s*/, '').trim();
    const lines = preset.content.split(/\r?\n/).filter(l => l.includes('03141') || l.includes(' 3141 '));
    if (lines.length > 0) {
      console.log(`[${dLabel}] Raw scans:`);
      lines.forEach(l => console.log('  ', l.trim()));
    }
  }
}

main().catch(console.error);
