import fs from 'fs';

const content = fs.readFileSync('src/data/default_contractor_data.ts', 'utf8');
const dateMatches = content.match(/"(2026-\d{2}-\d{2})"/g);
console.log('Contractor Dates:', [...new Set(dateMatches)]);

const dateStrMatches = content.match(/dateFormatted:\s*"([^"]+)"/g);
console.log('dateFormatted matches:', dateStrMatches);
