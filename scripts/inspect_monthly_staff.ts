import defaultEmpMapping from '../src/data/default_emp_mapping.json';

const allEmps = Object.values(defaultEmpMapping as Record<string, any>);
console.log('Total employees in defaultEmpMapping:', allEmps.length);

const sourceSheets = new Set(allEmps.map(e => e.sourceSheet));
console.log('Unique sourceSheet values:', Array.from(sourceSheets));

const mors = new Set(allEmps.map(e => e.mor));
console.log('Unique mor values:', Array.from(mors));

const categories = new Set(allEmps.map(e => e.category));
console.log('Unique category values:', Array.from(categories));

// Let's filter to find salaried / monthly / non-hourly
const nonHourly = allEmps.filter(e => e.mor !== 'MFG Hourly' && e.mor !== 'Hourly');
console.log('Non-hourly employees count:', nonHourly.length);
nonHourly.forEach((e, idx) => {
  console.log(`${idx + 1}. [${e.empId}] ${e.nameTH} (${e.nameEN}) | Dept: ${e.dept} | MOR: ${e.mor} | Sheet: ${e.sourceSheet} | MU: ${e.mu} | Function: ${e.function}`);
});
