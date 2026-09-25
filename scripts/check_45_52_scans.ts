import { SCAN_FILE_PRESETS } from '../src/data/default_scan_record';
import { processScanRecords } from '../src/utils/parser';
import defaultEmpMapping from '../src/data/default_emp_mapping.json';
import defaultAdjustments from '../src/data/default_adjustments.json';

async function main() {
  console.log('=== Checking all 22 days for 45-52 min checkout range ===');
  
  let totalAffected = 0;
  for (const preset of SCAN_FILE_PRESETS) {
    const res = processScanRecords(preset.content, defaultEmpMapping as any, defaultAdjustments as any);
    for (const r of res.records) {
      if (r.outScan?.timestamp) {
        const outDate = r.outScan.timestamp;
        const outH = outDate.getHours();
        const outM = outDate.getMinutes();
        const totalOutMins = outH * 60 + outM;

        let isTargetRange = false;
        let diffMins = 0;

        if (r.shift === 1) {
          diffMins = totalOutMins - 15 * 60;
          if (diffMins >= 45 && diffMins <= 52) isTargetRange = true;
        } else if (r.shift === 2) {
          const adjOutMins = outH < 12 ? (outH + 24) * 60 + outM : totalOutMins;
          diffMins = adjOutMins - 23 * 60;
          if (diffMins >= 45 && diffMins <= 52) isTargetRange = true;
        }

        if (isTargetRange) {
          totalAffected++;
          console.log(`[${preset.dateStr}] กะ ${r.shift} | ${r.employeeId} - ${r.name} (${r.dept}): In ${r.inTime || '-'}, Out ${r.outTime || '-'} (เกินกะ ${diffMins} นาที) -> OT เดิม: 1h -> OT ใหม่: 0h`);
        }
      }
    }
  }

  console.log(`\nรวมพนักงานทั้งหมดที่สแกนออกช่วง 45-52 นาทีใน 22 วัน: ${totalAffected} รายการ`);
}

main().catch(console.error);
