const fs = require('fs');

const data = JSON.parse(fs.readFileSync('src/data/default_emp_mapping.json', 'utf8'));
const employees = Object.values(data);
const gyMonthly = employees.filter(e => e.sourceSheet === 'Salaries' || (e.mor === 'Salaried' && e.sourceSheet === 'GY'));

gyMonthly.sort((a, b) => {
  const deptA = a.dept || a.costCenter || '';
  const deptB = b.dept || b.costCenter || '';
  if (deptA !== deptB) return deptA.localeCompare(deptB);
  return a.empId.localeCompare(b.empId);
});

console.log(`Total Goodyear Salaried Staff: ${gyMonthly.length}\n`);

console.log('| ลำดับ | รหัสพนักงาน | ชื่อ - นามสกุล (TH) | Name - Surname (EN) | แผนก / Cost Center | ตำแหน่ง (Position) | MU / สังกัด |');
console.log('| :---: | :---: | :--- | :--- | :--- | :--- | :--- |');

gyMonthly.forEach((e, idx) => {
  console.log(`| ${idx + 1} | \`${e.empId}\` | ${e.nameTH || '-'} | ${e.nameEN || '-'} | ${e.dept || e.costCenter || '-'} | ${e.position || '-'} | ${e.mu || '-'} |`);
});

// Dept counts
const deptSummary = {};
gyMonthly.forEach(e => {
  const d = e.dept || e.costCenter || 'Other';
  deptSummary[d] = (deptSummary[d] || 0) + 1;
});

console.log('\n### สรุปตามแผนก / Cost Center:');
Object.entries(deptSummary).forEach(([dept, cnt]) => {
  console.log(`- **${dept}**: ${cnt} คน`);
});
