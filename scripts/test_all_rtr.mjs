import { DEFAULT_RTR_SHUTDOWN_DATA, getRtrShutdownHoursForDate } from '../src/data/default_rtr_shutdown.js';

console.log('Testing getRtrShutdownHoursForDate for all days in September 2026:');
for (let d = 1; d <= 25; d++) {
  const dPad = String(d).padStart(2, '0');
  const d1 = getRtrShutdownHoursForDate(`${dPad}/09/2026`);
  const d2 = getRtrShutdownHoursForDate(`วันที่ ${d}/9/2026`);
  const d3 = getRtrShutdownHoursForDate(`2026-09-${dPad}`);
  const tot = Object.values(d1).reduce((s, h) => s + (h || 0), 0);
  console.log(`Day ${dPad}: total=${tot}h | d1=${JSON.stringify(d1)} | ISO=${JSON.stringify(d3)}`);
}
