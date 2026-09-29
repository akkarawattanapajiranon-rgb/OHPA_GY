import fs from 'fs';
import { DEFAULT_PDI_BEAD_REPORT } from '../src/data/default_pdi_bead.ts';

// Let's check which day in PdiBeadReport has pdi = 92 and bead = 179 and bcaReduction = 16.7
console.log('--- Checking PDI / Bead daily totals ---');
for (let d = 1; d <= 31; d++) {
  const pdi = DEFAULT_PDI_BEAD_REPORT.pdiDailyTotals?.[d] || 0;
  const bead = Math.round(DEFAULT_PDI_BEAD_REPORT.beadDailyTotals?.[d] || 0);
  const redMins = DEFAULT_PDI_BEAD_REPORT.bcaReductionDailyMinutes?.[d] || 0;
  const redHrs = Math.round((redMins / 60) * 10) / 10;
  if (pdi > 0 || bead > 0 || redHrs > 0) {
    console.log(`Day ${d}: PDI=${pdi}, Bead=${bead}, BCA Reduction=${redHrs}h (${redMins}m)`);
  }
}
