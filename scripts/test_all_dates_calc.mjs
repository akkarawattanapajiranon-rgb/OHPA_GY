import fs from 'fs';
import { calculateOhpaSummary } from '../src/utils/ohpaCalculator.ts';
import { SCAN_FILE_PRESETS } from '../src/data/default_scan_record.ts';
import { DEFAULT_CONTRACTOR_RECORDS_BY_DATE } from '../src/data/default_contractor_data.ts';
import { DEFAULT_STOCKING_REPORTS } from '../src/data/default_stocking_reports.ts';
import { DEFAULT_PDI_BEAD_REPORT } from '../src/data/default_pdi_bead.ts';
import { DEFAULT_RETREAD_TONNAGE } from '../src/data/default_retread_tonnage.ts';
import { processScanRecords } from '../src/utils/parser.ts';

console.log('=== Checking OHPA Summary across all dates in September 2026 ===\n');

for (let d = 1; d <= 29; d++) {
  const dPad = String(d).padStart(2, '0');
  const dateStr = `${dPad}/09/2026`;
  const dateShort = `${d}/9/2026`;
  const dateFormatted = `วันที่ ${d}/9/2026`;

  // Find scan preset
  const preset = SCAN_FILE_PRESETS.find(p => p.id === `scan_202609${dPad}` || p.name.includes(`${d}/9/2026`));
  const gyRecords = preset?.content ? processScanRecords(preset.content).records : [];
  const contEntry = DEFAULT_CONTRACTOR_RECORDS_BY_DATE[dateStr] || DEFAULT_CONTRACTOR_RECORDS_BY_DATE[dateShort];
  const contRecords = contEntry?.records || [];
  const stocking = DEFAULT_STOCKING_REPORTS[dateStr] || DEFAULT_STOCKING_REPORTS[dateShort] || null;

  const summary = calculateOhpaSummary(
    gyRecords,
    contRecords,
    stocking,
    dateFormatted,
    SCAN_FILE_PRESETS,
    DEFAULT_CONTRACTOR_RECORDS_BY_DATE,
    {},
    [],
    DEFAULT_PDI_BEAD_REPORT,
    DEFAULT_RETREAD_TONNAGE
  );

  const baseGross = summary.totalWorkingHours;
  const pdi = summary.pdiDeductHours;
  const bead = summary.beadAddHours;
  const bcaRed = summary.bcaReductionHours;
  const bcaDev = summary.bcaDevHours;
  const rtr = summary.rtrShutdownHours;
  const net = summary.opahWorkingHours;
  const expectedNet = Math.round((baseGross - pdi + bead - bcaRed - bcaDev - rtr) * 10) / 10;
  const diff = Math.round((net - expectedNet) * 10) / 10;

  console.log(`📅 Day ${dPad}/09/2026: Base=${baseGross}h | PDI=-${pdi}h | Bead=+${bead}h | โอน=-${bcaRed}h | DEV=-${bcaDev}h | RTR=-${rtr}h | Net=${net}h (Expected=${expectedNet}h, Diff=${diff})`);
  if (rtr > 0 || bcaDev > 0 || bcaRed > 0) {
    const areas = summary.areaBreakdown?.filter(a => !a.isExcluded6320) || [];
    const areaDetails = areas.map(a => `${a.areaKey}: Gross=${a.totalHours}h, RTR=-${a.rtrShutdownHours || 0}h, Dev=-${a.bcaDevHours || 0}h, Final=${a.finalOpahHours}h`).join(' | ');
    console.log(`   -> Areas: ${areaDetails}`);
  }
}
