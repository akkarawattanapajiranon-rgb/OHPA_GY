import { SCAN_FILE_PRESETS } from '../src/data/default_scan_record';
import { DEFAULT_CONTRACTOR_RECORDS_BY_DATE } from '../src/data/default_contractor_data';
import { DEFAULT_PDI_BEAD_REPORT } from '../src/data/default_pdi_bead';
import { DEFAULT_STOCKING_REPORTS } from '../src/data/default_stocking_reports';
import { DEFAULT_RETREAD_TONNAGE } from '../src/data/default_retread_tonnage';
import { calculateOhpaSummary } from '../src/utils/ohpaCalculator';
import { processScanRecords } from '../src/utils/parser';
import defaultEmpMapping from '../src/data/default_emp_mapping.json';
import defaultAdjustments from '../src/data/default_adjustments.json';

async function main() {
  console.log('=== Checking OT & OHPA Metrics for September 2026 (Days 1 - 22) ===');

  const targetDate = '22/09/2026';
  const currentPreset = SCAN_FILE_PRESETS.find(p => p.dateStr === targetDate) || SCAN_FILE_PRESETS[SCAN_FILE_PRESETS.length - 1];
  const parsed = processScanRecords(currentPreset.content, defaultEmpMapping as any, defaultAdjustments as any);
  
  const currentCont = DEFAULT_CONTRACTOR_RECORDS_BY_DATE[targetDate] || { records: [] };
  const dayTonnage = DEFAULT_STOCKING_REPORTS[targetDate] || null;
  const retreadTonnage = DEFAULT_RETREAD_TONNAGE;

  const summary = calculateOhpaSummary(
    parsed.records,
    currentCont.records,
    dayTonnage,
    targetDate,
    SCAN_FILE_PRESETS,
    DEFAULT_CONTRACTOR_RECORDS_BY_DATE,
    defaultEmpMapping as any,
    defaultAdjustments as any,
    DEFAULT_PDI_BEAD_REPORT,
    retreadTonnage
  );

  console.log(`\n📅 วันที่ตรวจสอบล่าสุด: ${targetDate}`);
  console.log(`- Daily Plant OPAH: ${summary.overallOpahLbsPerHour} lbs/hr`);
  console.log(`- Daily Net Hours: ${summary.opahWorkingHours} ชม.`);
  console.log(`- Daily Base Hours: ${summary.totalWorkingHours} ชม. (GY: ${summary.gyTotalHours}h, Cont: ${summary.contractorTotalHours}h)`);
  console.log(`- Daily Stocking: ${summary.totalTonnageKg} kg (${summary.totalTonnageLbs} lbs)`);

  if (summary.mtd) {
    console.log(`\n📊 สรุปภาพรวม MTD สะสม ${summary.mtd.daysCount} วัน (1 - ${summary.mtd.daysCount}/09/2026):`);
    console.log(`- MTD Overall Plant OPAH: ${summary.mtd.mtdOpahLbsPerHour} lbs/hr`);
    console.log(`- MTD Net Working Hours: ${summary.mtd.mtdOpahWorkingHours} ชม.`);
    console.log(`- MTD Base Working Hours: ${summary.mtd.mtdTotalHours} ชม.`);
    console.log(`- MTD Stocking: ${summary.mtd.mtdStockingKg.toLocaleString()} kg (${summary.mtd.mtdStockingLbs.toLocaleString()} lbs)`);

    console.log('\n📋 ตาราง MTD Daily Breakdown:');
    console.log('Day | Date       | GY (h) | Cont (h) | Base Tot | Net OPAH | Stocking kg | Stocking lbs | Daily OPAH (lbs/h) | MTD Cumul OPAH');
    console.log('-----------------------------------------------------------------------------------------------------------------------------');
    for (const item of summary.mtd.dailyItems) {
      console.log(
        `${String(item.day).padStart(3, ' ')} | ` +
        `${item.dateStr} | ` +
        `${String(item.gyHours).padStart(6, ' ')} | ` +
        `${String(item.contractorHours).padStart(8, ' ')} | ` +
        `${String(item.totalHours).padStart(8, ' ')} | ` +
        `${String(item.opahWorkingHours).padStart(8, ' ')} | ` +
        `${String(item.stockingKg).padStart(11, ' ')} | ` +
        `${String(item.stockingLbs).padStart(12, ' ')} | ` +
        `${String(item.dailyOpahLbsPerHour).padStart(18, ' ')} | ` +
        `${String(item.cumulativeOpahLbsPerHour).padStart(14, ' ')}`
      );
    }
  }

  // Find all employees across all presets who scanned out between 15:45 and 15:52 in Shift 1
  console.log('\n🔍 รายชื่อพนักงานที่สแกนออก 15:45 - 15:52 (ที่เดิมเคยถูกคิด OT ผิด แล้วปรับแก้เป็น 0 ชม. OT):');
  let countFix = 0;
  for (const preset of SCAN_FILE_PRESETS) {
    const res = processScanRecords(preset.content, defaultEmpMapping as any, defaultAdjustments as any);
    for (const r of res.records) {
      if (r.shift === 1 && r.outScan?.timestamp) {
        const outDate = r.outScan.timestamp;
        const h = outDate.getHours();
        const m = outDate.getMinutes();
        if (h === 15 && m >= 45 && m <= 52) {
          countFix++;
          const inTimeStr = r.inScan ? `${String(r.inScan.timestamp.getHours()).padStart(2, '0')}:${String(r.inScan.timestamp.getMinutes()).padStart(2, '0')}` : '-';
          const outTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          console.log(`- วันที่ ${preset.dateStr}: [${r.employeeId}] ${r.name} (${r.dept}) สแกนเข้า ${inTimeStr} สแกนออก ${outTimeStr} -> ชม.ปกติ: ${r.normalWorkHours}h | OT: ${r.otHours}h`);
        }
      }
    }
  }
  console.log(`\nรวมพบพนักงานที่เข้าข่ายเคสนี้ทั้งหมด: ${countFix} รายการ`);
}

main().catch(console.error);
