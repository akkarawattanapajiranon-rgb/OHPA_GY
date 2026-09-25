import fs from 'fs';

const content = fs.readFileSync('src/data/default_scan_record.ts', 'utf8');
const idMatches = content.match(/"id":\s*"([^"]+)"/g);
console.log('All preset IDs:', idMatches);

const nameMatches = content.match(/"name":\s*"([^"]+)"/g);
console.log('All preset Names:', nameMatches);
