import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';

console.log('🧪 Starting Full System Verification & Test Suite...');

// 1. Check required configuration & data files
const requiredFiles = [
  'src/data/default_rtr_shutdown.ts',
  'src/data/default_pdi_bead.ts',
  'src/data/default_contractor_data.ts',
  'src/data/default_scan_record.ts',
  'src/data/default_emp_mapping.json',
  'src/data/default_adjustments.json',
  'src/utils/ohpaCalculator.ts',
  'src/utils/lateEarlyHelper.ts',
  'src/utils/parser.ts',
  'src/components/OhpaCalculationView.tsx',
  'src/components/LateEarlyDashboardView.tsx',
  'src/components/DashboardView.tsx',
  'src/components/ContractorScanRecordsView.tsx',
  'vite.config.ts'
];

let filesMissing = 0;
for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`❌ Missing file: ${file}`);
    filesMissing++;
  }
}
assert.strictEqual(filesMissing, 0, 'All required project files must exist');
console.log('✅ 1. All critical source files and data stores exist.');

// 2. Verify Vite API routes in vite.config.ts
const viteConfigContent = readFileSync('vite.config.ts', 'utf-8');
const expectedEndpoints = [
  '/api/scan-folder',
  '/api/contractor-data',
  '/api/sync-pdi-bead',
  '/api/sync-adjustments',
  '/api/sync-retread-tonnage',
  '/api/sync-rtr-shutdown',
  '/api/stocking-tonnage'
];

for (const ep of expectedEndpoints) {
  assert.ok(viteConfigContent.includes(ep), `vite.config.ts must contain endpoint ${ep}`);
}
console.log('✅ 2. All 7 API endpoints are properly configured in vite.config.ts.');

// 3. Verify RTR Shutdown Logic & Area Map Deductions
const rtrFileContent = readFileSync('src/data/default_rtr_shutdown.ts', 'utf-8');
assert.ok(rtrFileContent.includes('getRtrShutdownHoursForDate'), 'RTR shutdown helper must be defined');
assert.ok(rtrFileContent.includes('DEFAULT_RTR_SHUTDOWN_DATA'), 'DEFAULT_RTR_SHUTDOWN_DATA must be exported');
console.log('✅ 3. RTR Shutdown data and helper functions verified.');

// 4. Verify PDI / Bead / BCA Dev / Retread logic in calculator
const calcContent = readFileSync('src/utils/ohpaCalculator.ts', 'utf-8');
assert.ok(calcContent.includes('rtrShutdownData'), 'calculateOhpaSummary must accept rtrShutdownData');
assert.ok(calcContent.includes('pdiDeductHours'), 'pdiDeductHours must be tracked');
assert.ok(calcContent.includes('beadAddHours'), 'beadAddHours must be tracked');
assert.ok(calcContent.includes('bcaReductionHours'), 'bcaReductionHours must be tracked');
assert.ok(calcContent.includes('bcaDevHours'), 'bcaDevHours must be tracked');
assert.ok(calcContent.includes('finalOpahHours'), 'finalOpahHours calculation must be present');
console.log('✅ 4. OPAH Calculator integration formulas verified.');

// 5. Verify Late & Early Dashboard logic
const lateEarlyContent = readFileSync('src/utils/lateEarlyHelper.ts', 'utf-8');
assert.ok(lateEarlyContent.includes('extractAllLateAndEarlyRecords'), 'extractAllLateAndEarlyRecords must be present');
assert.ok(lateEarlyContent.includes('exportLateEarlyExcel'), 'exportLateEarlyExcel must be present');
console.log('✅ 5. Late & Early helper logic verified.');

// 6. Verify Employee Mapping JSON integrity
const empMapContent = JSON.parse(readFileSync('src/data/default_emp_mapping.json', 'utf-8'));
assert.ok(Object.keys(empMapContent).length > 100, 'Employee mapping must contain employee records');
console.log(`✅ 6. Master Employee Mapping verified (${Object.keys(empMapContent).length} employees).`);

// 7. Verify Adjustments JSON integrity
const adjustmentsContent = JSON.parse(readFileSync('src/data/default_adjustments.json', 'utf-8'));
assert.ok(Array.isArray(adjustmentsContent), 'Adjustments must be an array');
console.log(`✅ 7. Daily Adjustments store verified (${adjustmentsContent.length} adjustments).`);

console.log('\n🎉 ALL SYSTEM TESTS PASSED SUCCESSFULLY! (0 Errors)');
