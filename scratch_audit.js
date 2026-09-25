const fs = require('fs');
const path = require('path');

// Load employee mapping
const empMapping = JSON.parse(fs.readFileSync('src/data/default_emp_mapping.json', 'utf8'));
const adjustments = JSON.parse(fs.readFileSync('src/data/default_adjustments.json', 'utf8'));

// Standard parse function
function parseRawScanContent(content) {
  const lines = content.split(/\r?\n/);
  const rawScans = [];
  const lineRegex = /^\s*(\d+)\s+([IO])\s+(\d{8})\s+(\d{4})\s+(\d+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const match = line.match(lineRegex);
    if (!match) continue;

    const empId = match[1];
    const type = match[2];
    const datePart = match[3];
    const timePart = match[4];
    const deviceId = match[5];

    const month = parseInt(datePart.slice(0, 2), 10);
    const day = parseInt(datePart.slice(2, 4), 10);
    const year = parseInt(datePart.slice(4, 8), 10);
    const hours = parseInt(timePart.slice(0, 2), 10);
    const minutes = parseInt(timePart.slice(2, 4), 10);

    const timestamp = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;

    rawScans.push({
      id: `scan-${i}`,
      empId,
      type,
      timestamp,
      dateStr,
      deviceId
    });
  }
  return rawScans;
}

function determineShift(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const mins = h * 60 + m;
  if (mins >= 5 * 60 + 30 && mins < 13 * 60 + 30) return 1;
  if (mins >= 13 * 60 + 30 && mins < 21 * 60 + 30) return 2;
  return 3;
}

function determineShiftFromOut(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const mins = h * 60 + m;
  if (mins >= 13 * 60 + 30 && mins < 21 * 60 + 30) return 1;
  if (mins >= 21 * 60 + 30 || mins < 5 * 60 + 30) return 2;
  return 3;
}

// Audit days 1 to 21
const summaryResults = [];

for (let d = 1; d <= 21; d++) {
  const dPad = String(d).padStart(2, '0');
  const filename = `scans/202609${dPad}.txt`;
  if (!fs.existsSync(filename)) continue;

  const content = fs.readFileSync(filename, 'utf8');
  const scans = parseRawScanContent(content);

  // Group by empId
  const empScans = {};
  scans.forEach(s => {
    if (!empScans[s.empId]) empScans[s.empId] = [];
    empScans[s.empId].push(s);
  });

  let totalHC = 0;
  let totalNormalHours = 0;
  let totalOtHours = 0;
  let missingInCount = 0;
  let missingOutCount = 0;

  const dateStr = `${dPad}/09/2026`;
  const dayAdjustments = adjustments.filter(a => a.dateStr === dateStr);

  Object.entries(empScans).forEach(([empId, sList]) => {
    totalHC++;
    const inScans = sList.filter(s => s.type === 'I').sort((a, b) => a.timestamp - b.timestamp);
    const outScans = sList.filter(s => s.type === 'O').sort((a, b) => a.timestamp - b.timestamp);

    const inScan = inScans[0];
    const outScan = outScans[outScans.length - 1];

    if (!inScan) missingInCount++;
    if (!outScan) missingOutCount++;

    let shiftNum = 1;
    if (inScan) shiftNum = determineShift(inScan.timestamp);
    else if (outScan) shiftNum = determineShiftFromOut(outScan.timestamp);

    const empAdj = dayAdjustments.find(a => a.empId === empId);
    let normalWork = 8;
    let ot = 0;

    if (!inScan || !outScan) {
      normalWork = 8;
      ot = 0;
    } else {
      const inHh = inScan.timestamp.getHours();
      const inMm = inScan.timestamp.getMinutes();
      const inMins = inHh * 60 + inMm;

      const outHh = outScan.timestamp.getHours();
      const outMm = outScan.timestamp.getMinutes();
      const outMins = outHh * 60 + outMm;

      let dur = 0;
      if (outScan.timestamp.getTime() > inScan.timestamp.getTime()) {
        dur = (outScan.timestamp.getTime() - inScan.timestamp.getTime()) / (1000 * 3600);
      } else {
        dur = ((outHh + 24) * 60 + outMm - inMins) / 60;
      }

      // Check OT
      const customStartStr = empAdj?.customStartTime;
      const customEndStr = empAdj?.customEndTime;
      let isOtWindow = false;
      let isStandardShiftAdjustment = false;
      let customSpanHours = 8;

      if (customStartStr) {
        const [csH, csM] = customStartStr.split(':').map(Number);
        const csMins = (csH || 0) * 60 + (csM || 0);
        if (customEndStr) {
          const [ceH, ceM] = customEndStr.split(':').map(Number);
          let ceMins = (ceH || 0) * 60 + (ceM || 0);
          if (ceMins <= csMins) ceMins += 24 * 60;
          customSpanHours = (ceMins - csMins) / 60;
        }
        if (customSpanHours === 8 && (csH === 7 || csH === 15 || csH === 23)) {
          isStandardShiftAdjustment = true;
        }
        if (isStandardShiftAdjustment || (shiftNum === 1 && csH === 15) || (shiftNum === 2 && csH === 23) || (shiftNum === 3 && csH === 7)) {
          isOtWindow = true;
        }
      }

      if (empAdj?.isApprovedTiming && !isOtWindow) {
        if (customSpanHours > 8) {
          ot = Math.round(customSpanHours - 8);
          normalWork = 8;
        } else {
          normalWork = Math.min(8, Math.round(dur * 10) / 10);
        }
      } else if (empId === '01454' && shiftNum === 1) {
        let pre = 0, post = 0;
        if (inMins < 7 * 60) pre = Math.floor((7 * 60 - inMins + 15) / 60);
        if (outMins - 15 * 60 >= 45) post = Math.floor((outMins - 15 * 60 + 15) / 60);
        ot = pre + post;
        normalWork = Math.min(8, Math.max(0, dur - ot));
      } else {
        let post = 0;
        if (shiftNum === 1) {
          const totalOut = (dur > 14 && outHh <= 12) ? (outHh + 24) * 60 + outMm : outMins;
          if (totalOut - 15 * 60 >= 45) post = Math.floor((totalOut - 15 * 60 + 15) / 60);
        } else if (shiftNum === 2) {
          const totalOut = outHh < 12 ? (outHh + 24) * 60 + outMm : outMins;
          if (totalOut - 23 * 60 >= 45) post = Math.floor((totalOut - 23 * 60 + 15) / 60);
        } else if (shiftNum === 3) {
          if (outMins >= 7 * 60 + 45 && outMins <= 11 * 60 + 30) {
            post = Math.floor((outMins - 7 * 60 + 15) / 60);
          }
        }
        ot = post;
        normalWork = Math.min(8, Math.max(0, dur - ot));
      }
    }

    totalNormalHours += normalWork;
    totalOtHours += ot;
  });

  summaryResults.push({
    'วันที่': dateStr,
    'จำนวนพนักงาน (คน)': totalHC,
    'ชั่วโมงปกติ (ชม.)': totalNormalHours.toFixed(1),
    'OT (ชม.)': totalOtHours.toFixed(1),
    'รวมชั่วโมงทำงาน (ชม.)': (totalNormalHours + totalOtHours).toFixed(1),
    'ไม่พบสแกนเข้า': missingInCount,
    'ไม่พบสแกนออก': missingOutCount
  });
}

console.table(summaryResults);
