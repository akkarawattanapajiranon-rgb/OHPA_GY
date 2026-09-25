import fs from 'fs';

// Read data files
const presetsJson = JSON.parse(fs.readFileSync('src/data/default_emp_mapping.json', 'utf8'));
const adjustJson = JSON.parse(fs.readFileSync('src/data/default_adjustments.json', 'utf8'));

console.log('Testing employee mapping count:', Object.keys(presetsJson).length);
