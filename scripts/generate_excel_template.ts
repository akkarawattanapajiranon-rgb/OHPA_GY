import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// 1. Sheet 1: Daily Adjustments
const adjustmentsData = [
  {
    'วันที่ (DD/MM/YYYY)': '13/09/2026',
    'รหัสพนักงาน': '11848',
    'ชื่อ - นามสกุล': 'วีระพันธ์ นุตะดี',
    'แผนก/Cost Center': '3200',
    'เครื่องประจำเดิม': '320 BANBURY # 1',
    '1. ย้ายเครื่องกะปกติ': '',
    '2. ย้ายเครื่องทำ OT': '320 BANBURY # 2',
    '3. เวลาเข้าพิเศษ (HH:MM)': '',
    '4. เวลาออกพิเศษ (HH:MM)': '',
    'เหตุผล / หมายเหตุ': 'ทำ OT กะ 3 ช่วย Mixer 2'
  },
  {
    'วันที่ (DD/MM/YYYY)': '13/09/2026',
    'รหัสพนักงาน': '12128',
    'ชื่อ - นามสกุล': 'พายุ บุญมาใส',
    'แผนก/Cost Center': '3200',
    'เครื่องประจำเดิม': '320 BANBURY # 1',
    '1. ย้ายเครื่องกะปกติ': '320 BANBURY # 2',
    '2. ย้ายเครื่องทำ OT': '',
    '3. เวลาเข้าพิเศษ (HH:MM)': '',
    '4. เวลาออกพิเศษ (HH:MM)': '',
    'เหตุผล / หมายเหตุ': 'ย้ายไปประจำ Mixer 2 กะ 1 แทนคนที่ลา'
  },
  {
    'วันที่ (DD/MM/YYYY)': '13/09/2026',
    'รหัสพนักงาน': '12140',
    'ชื่อ - นามสกุล': 'ถวิล ลืมอินทร์',
    'แผนก/Cost Center': '3200',
    'เครื่องประจำเดิม': '320 BANBURY # 1',
    '1. ย้ายเครื่องกะปกติ': '',
    '2. ย้ายเครื่องทำ OT': '',
    '3. เวลาเข้าพิเศษ (HH:MM)': '11:00',
    '4. เวลาออกพิเศษ (HH:MM)': '19:00',
    'เหตุผล / หมายเหตุ': 'หัวหน้างานสั่งให้มาทำงานเวลาพิเศษ 11:00-19:00 (ไม่คิดสาย)'
  },
  {
    'วันที่ (DD/MM/YYYY)': '13/09/2026',
    'รหัสพนักงาน': '12412',
    'ชื่อ - นามสกุล': 'พิษณุ ช้างชน',
    'แผนก/Cost Center': '4300',
    'เครื่องประจำเดิม': '430 Quad',
    '1. ย้ายเครื่องกะปกติ': '',
    '2. ย้ายเครื่องทำ OT': '430 6"x8" Tuber',
    '3. เวลาเข้าพิเศษ (HH:MM)': '',
    '4. เวลาออกพิเศษ (HH:MM)': '',
    'เหตุผล / หมายเหตุ': 'ทำ OT กะ 3 ไปช่วยเครื่อง Tuber 6x8'
  }
];

// 2. Sheet 2: Standard Machine Reference List
const standardMachines = [
  { 'รหัส Cost Center': '3200', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '320 BANBURY # 1', 'คำอธิบาย': 'Mixer 1' },
  { 'รหัส Cost Center': '3200', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '320 BANBURY # 2', 'คำอธิบาย': 'Mixer 2' },
  { 'รหัส Cost Center': '3200', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '320 Pigment', 'คำอธิบาย': 'Auto Pigment' },
  { 'รหัส Cost Center': '3300', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '330 3ROII', 'คำอธิบาย': '3-Roll Calender' },
  { 'รหัส Cost Center': '3700', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': 'Cement (3roll)', 'คำอธิบาย': 'Cement House' },
  { 'รหัส Cost Center': '4110', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '411 4Roll#1', 'คำอธิบาย': '4-Roll Calender 1' },
  { 'รหัส Cost Center': '4110', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '411 4Roll#2', 'คำอธิบาย': '4-Roll Calender 2' },
  { 'รหัส Cost Center': '4110', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '411 Chafer lay up', 'คำอธิบาย': 'Chaffer Lay-up' },
  { 'รหัส Cost Center': '4110', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '411 Lux/slitter', 'คำอธิบาย': 'Gum Slitter / Lux' },
  { 'รหัส Cost Center': '4110', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '411 Shear Fiscer', 'คำอธิบาย': 'Fischer Cutter' },
  { 'รหัส Cost Center': '4120', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '412 Band54"', 'คำอธิบาย': '54" Band Building' },
  { 'รหัส Cost Center': '4130', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '413 Band72"', 'คำอธิบาย': '72" Band Building' },
  { 'รหัส Cost Center': '4200', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '420 Bead Flap', 'คำอธิบาย': 'Bead Flapper' },
  { 'รหัส Cost Center': '4200', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '420 Bead insulation', 'คำอธิบาย': 'Bead Insulate' },
  { 'รหัส Cost Center': '4200', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '420 Bead Wrap', 'คำอธิบาย': 'Bead Wrapper' },
  { 'รหัส Cost Center': '4200', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '420 Hex Bead', 'คำอธิบาย': 'Hex Bead' },
  { 'รหัส Cost Center': '4200', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '420 Hot apexer', 'คำอธิบาย': 'Hot Apexer' },
  { 'รหัส Cost Center': '4300', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '430 6"x8" Tuber', 'คำอธิบาย': 'Duplex 6" X 8" Extruder' },
  { 'รหัส Cost Center': '4300', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '430 Quad', 'คำอธิบาย': 'Quad Extruder' },
  { 'รหัส Cost Center': '3200/4300/4110', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': 'Leader', 'คำอธิบาย': 'Production Team Leader (หัวหน้ากะ)' }
];

// 3. Sheet 3: Instructions
const instructions = [
  { 'หัวข้อ': 'รูปแบบที่ 1: กะตัวเอง ย้ายไปทำเครื่องอื่น (Normal Shift Transfer)', 'คำอธิบาย': 'กรอกชื่อเครื่องจักรเป้าหมายในช่อง "1. ย้ายเครื่องกะปกติ" -> ระบบจะโอนยอดคนปกติ 1 คนไปนับที่เครื่องใหม่ทันที' },
  { 'หัวข้อ': 'รูปแบบที่ 2: กะตัวเองทำเครื่องเดิม และทำ OT เครื่องอื่น (OT Transfer)', 'คำอธิบาย': 'กรอกชื่อเครื่องจักรเป้าหมายในช่อง "2. ย้ายเครื่องทำ OT" -> กำลังพลกะปกติจะอยู่เครื่องเดิม แต่ชั่วโมงและยอดกำลังพล OT จะโอนไปเติมให้เครื่องที่ไปช่วยทำ OT' },
  { 'หัวข้อ': 'รูปแบบที่ 3: เวลาเข้า-ออกพิเศษตามที่หัวหน้างานสั่ง (Custom Shift Timing)', 'คำอธิบาย': 'กรอกเวลาในช่อง "3. เวลาเข้าพิเศษ (HH:MM)" เช่น 11:00 -> ระบบจะไม่คิดว่าสาย (isLate = false) และนับชั่วโมงทำงานปกติครบ 8 ชม.' },
  { 'หัวข้อ': 'คำแนะนำการระบุชื่อเครื่องจักร', 'คำอธิบาย': 'สามารถก๊อปปี้ชื่อเครื่องจักรจากแผ่นงาน "Standard_Machine_List" มาใส่ได้เลย หรือพิมพ์ชื่อย่อ เช่น Mixer 2, Quad, Tuber ระบบจะค้นหาให้อัตโนมัติ' }
];

const wb = XLSX.utils.book_new();

// Sheet 1
const ws1 = XLSX.utils.json_to_sheet(adjustmentsData);
ws1['!cols'] = [
  { wch: 18 }, // วันที่
  { wch: 14 }, // รหัส
  { wch: 24 }, // ชื่อ
  { wch: 16 }, // CC
  { wch: 22 }, // เครื่องเดิม
  { wch: 24 }, // ย้ายปกติ
  { wch: 24 }, // ย้าย OT
  { wch: 22 }, // เวลาเข้า
  { wch: 22 }, // เวลาออก
  { wch: 45 }  // หมายเหตุ
];
XLSX.utils.book_append_sheet(wb, ws1, 'Daily_Adjustments');

// Sheet 2
const ws2 = XLSX.utils.json_to_sheet(standardMachines);
ws2['!cols'] = [
  { wch: 18 },
  { wch: 35 },
  { wch: 30 }
];
XLSX.utils.book_append_sheet(wb, ws2, 'Standard_Machine_List');

// Sheet 3
const ws3 = XLSX.utils.json_to_sheet(instructions);
ws3['!cols'] = [
  { wch: 40 },
  { wch: 70 }
];
XLSX.utils.book_append_sheet(wb, ws3, 'Instructions_คำแนะนำ');

const outputPath1 = path.join(process.cwd(), 'Daily_Adjustments_Template.xlsx');
const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
const outputPath2 = path.join(publicDir, 'Daily_Adjustments_Template.xlsx');

XLSX.writeFile(wb, outputPath1);
XLSX.writeFile(wb, outputPath2);

console.log('Successfully generated Excel templates at:');
console.log('1.', outputPath1);
console.log('2.', outputPath2);
