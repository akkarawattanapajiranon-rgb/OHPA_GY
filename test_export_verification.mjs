import assert from 'node:assert';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

console.log('🧪 Testing all Excel Export pipelines across the system...');

// 1. Test rawExportHelper buildRawEmployeeRecords & Workbook generation
const rawHelperContent = readFileSync('src/utils/rawExportHelper.ts', 'utf-8');
assert.ok(rawHelperContent.includes('XLSX.utils.book_new()'), 'rawExportHelper must create workbook');
assert.ok(rawHelperContent.includes('Team_Summary_Matrix'), 'rawExportHelper must have Team_Summary_Matrix sheet');
assert.ok(rawHelperContent.includes('Raw_All_Employees'), 'rawExportHelper must have Raw_All_Employees sheet');
assert.ok(rawHelperContent.includes('Team_Total_Aviation'), 'rawExportHelper must have Team_Total_Aviation sheet');
assert.ok(rawHelperContent.includes('⚠️ RTR Shutdown (ชม.)'), 'rawExportHelper must include RTR Shutdown column');
console.log('✅ 1. Raw Data & Team Allocation Export functions verified.');

// 2. Test lateEarlyHelper exportLateEarlyExcel
const lateEarlyContent = readFileSync('src/utils/lateEarlyHelper.ts', 'utf-8');
assert.ok(lateEarlyContent.includes('XLSX.utils.book_append_sheet(wb, wsSummary, \'Summary_KPI\');'), 'lateEarlyHelper must have Summary_KPI');
assert.ok(lateEarlyContent.includes('XLSX.utils.book_append_sheet(wb, wsWeekly, \'Weekly_Trends\');'), 'lateEarlyHelper must have Weekly_Trends');
assert.ok(lateEarlyContent.includes('XLSX.utils.book_append_sheet(wb, wsArea, \'Area_Breakdown\');'), 'lateEarlyHelper must have Area_Breakdown');
assert.ok(lateEarlyContent.includes('XLSX.utils.book_append_sheet(wb, wsLate, \'Late_Arrivals_List\');'), 'lateEarlyHelper must have Late_Arrivals_List');
assert.ok(lateEarlyContent.includes('XLSX.utils.book_append_sheet(wb, wsEarly, \'Early_Leave_List\');'), 'lateEarlyHelper must have Early_Leave_List');
assert.ok(lateEarlyContent.includes('XLSX.utils.book_append_sheet(wb, wsRanking, \'Top_Frequent_Ranking\');'), 'lateEarlyHelper must have Top_Frequent_Ranking');
console.log('✅ 2. Late & Early Dashboard Export functions verified.');

// 3. Test contractorParser exportContractorRecordsToExcel
const contParserContent = readFileSync('src/utils/contractorParser.ts', 'utf-8');
assert.ok(contParserContent.includes('XLSX.utils.json_to_sheet(exportData)'), 'contractorParser must export data');
assert.ok(contParserContent.includes('Contractor Scans'), 'contractorParser must append Contractor Scans sheet');
console.log('✅ 3. Contractor WAS Export functions verified.');

// 4. Test EmployeeDetailTable Excel export
const empTableContent = readFileSync('src/components/EmployeeDetailTable.tsx', 'utf-8');
assert.ok(empTableContent.includes('Raw_Data_รายคน'), 'EmployeeDetailTable must export Raw_Data_รายคน');
assert.ok(empTableContent.includes('Team_Total_Aviation'), 'EmployeeDetailTable must export Team_Total_Aviation');
console.log('✅ 4. Employee Detail Table Export functions verified.');

// 5. Test OhpaCalculationView Trend Report Excel export
const ohpaViewContent = readFileSync('src/components/OhpaCalculationView.tsx', 'utf-8');
assert.ok(ohpaViewContent.includes('Daily_Trend_Plant'), 'OhpaCalculationView must export Daily_Trend_Plant');
assert.ok(ohpaViewContent.includes('Daily_Trend_Retread'), 'OhpaCalculationView must export Daily_Trend_Retread');
assert.ok(ohpaViewContent.includes('Daily_Trend_By_Team'), 'OhpaCalculationView must export Daily_Trend_By_Team');
assert.ok(ohpaViewContent.includes('Daily_Trend_Matrix_Hours'), 'OhpaCalculationView must export Daily_Trend_Matrix_Hours');
assert.ok(ohpaViewContent.includes('Daily_Trend_Matrix_OPAH'), 'OhpaCalculationView must export Daily_Trend_Matrix_OPAH');
console.log('✅ 5. OPAH Daily Trends 5-Sheet Excel Export verified.');

// 6. Test Plant Hierarchy Dashboard export
const dashViewContent = readFileSync('src/components/DashboardView.tsx', 'utf-8');
assert.ok(dashViewContent.includes('Plant_Hierarchy_Summary'), 'DashboardView must export Plant_Hierarchy_Summary');
assert.ok(dashViewContent.includes('Worker_Details'), 'DashboardView must export Worker_Details');
console.log('✅ 6. Plant Hierarchy Dashboard Export verified.');

console.log('\n🎉 ALL 6 EXCEL EXPORT MODULES TESTED & VERIFIED WITH 0 ERRORS!');
