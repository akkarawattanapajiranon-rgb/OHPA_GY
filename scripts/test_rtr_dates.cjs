const fs = require('fs');

const tsCode = fs.readFileSync('src/data/default_rtr_shutdown.ts', 'utf8');
const jsCode = tsCode
  .replace(/export interface[\s\S]*?\}/g, '')
  .replace(/export const/g, 'const')
  .replace(/export function/g, 'function')
  .replace(/:\s*Record<string,\s*RtrShutdownEntry>/g, '')
  .replace(/:\s*RtrShutdownEntry/g, '')
  .replace(/\?:?\s*string/g, '')
  .replace(/:\s*string/g, '');

const fn = new Function(jsCode + '; return { DEFAULT_RTR_SHUTDOWN_DATA, getRtrShutdownHoursForDate };')();

console.log('24/09/2026:', fn.getRtrShutdownHoursForDate('24/09/2026'));
console.log('วันที่ 24/9/2026:', fn.getRtrShutdownHoursForDate('วันที่ 24/9/2026'));
console.log('2026-09-24:', fn.getRtrShutdownHoursForDate('2026-09-24'));
console.log('23/09/2026:', fn.getRtrShutdownHoursForDate('23/09/2026'));
console.log('วันที่ 23/9/2026:', fn.getRtrShutdownHoursForDate('วันที่ 23/9/2026'));
console.log('2026-09-23:', fn.getRtrShutdownHoursForDate('2026-09-23'));
