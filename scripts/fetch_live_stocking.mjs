import https from 'https';
import fs from 'fs';

function fetchUrl(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '10.124.129.34',
      port: 443,
      path: path,
      method: 'GET',
      rejectUnauthorized: false,
      timeout: 6000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

async function main() {
  try {
    console.log('Connecting to 10.124.129.34...');
    const mainPage = await fetchUrl('/l2web/datahost/all_areas/dpics.php?server=db_server&action=r06');
    console.log('Received main page length:', mainPage.length);
    const optionsMatch = mainPage.match(/<OPTION value="(\d+)"\s*(SELECTED)?\s*>([^<]+)<\/OPTION>/gi) || [];
    console.log('Available dates on server:', optionsMatch.map(o => o.replace(/<[^>]+>/g, '').trim()));
  } catch (err) {
    console.error('Failed to fetch from 10.124.129.34:', err.message);
  }
}

main();
