import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// 1. Sheet 1: Daily Adjustments (4 Columns)
const adjustmentsData = [
  {
    'วันที่': '13/09/2026',
    'รหัสพนักงาน': '11848',
    'เครื่องจักรที่ไปทำ OT (OT Machine)': '320 BANBURY # 2',
    'เวลา': ''
  },
  {
    'วันที่': '13/09/2026',
    'รหัสพนักงาน': '03027',
    'เครื่องจักรที่ไปทำ OT (OT Machine)': '320 BANBURY # 2',
    'เวลา': ''
  },
  {
    'วันที่': '13/09/2026',
    'รหัสพนักงาน': '12140',
    'เครื่องจักรที่ไปทำ OT (OT Machine)': '',
    'เวลา': '11:00 - 19:00'
  },
  {
    'วันที่': '13/09/2026',
    'รหัสพนักงาน': '12128',
    'เครื่องจักรที่ไปทำ OT (OT Machine)': '320 BANBURY # 2',
    'เวลา': ''
  }
];

// 2. Sheet 2: Standard Machine Reference List
const standardMachines = [
  { 'รหัส Cost Center': '3200', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '320 BANBURY # 1', 'คำอธิบาย': 'Mixer 1' },
  { 'รหัส Cost Center': '3200', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '320 BANBURY # 2', 'คำอธิบาย': 'Mixer 2' },
  { 'รหัส Cost Center': '3300/3700', 'ชื่อตำแหน่ง / เครื่องจักรในระบบ (Standard Position)': '3roll + Cement (3300/3700)', 'คำอธิบาย': '3-Roll Calender + Cement House' },
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
  { 'คอลัมน์ (4 ช่อง)': '1. วันที่', 'คำอธิบาย': 'วันที่ที่ต้องการปรับเปลี่ยน เช่น 13/09/2026' },
  { 'คอลัมน์ (4 ช่อง)': '2. รหัสพนักงาน', 'คำอธิบาย': 'รหัสพนักงาน 5 หลัก เช่น 11848' },
  { 'คอลัมน์ (4 ช่อง)': '3. เครื่องจักรที่ไปทำ OT (OT Machine)', 'คำอธิบาย': 'ใส่ชื่อเครื่องจักรที่พนักงานไปทำ OT เช่น 320 BANBURY # 2 หรือ Mixer 2 (หากเป็นการย้ายกะปกติก็สามารถใส่เครื่องจักรที่ไปทำได้)' },
  { 'คอลัมน์ (4 ช่อง)': '4. เวลา', 'คำอธิบาย': 'กรณีหัวหน้าสั่งให้มาทำงานเวลาพิเศษ เช่น 11:00 หรือ 11:00 - 19:00 (ระบบจะไม่คิดสาย)' }
];

const wb = XLSX.utils.book_new();

// Sheet 1
const ws1 = XLSX.utils.json_to_sheet(adjustmentsData);
ws1['!cols'] = [
  { wch: 18 }, // วันที่
  { wch: 16 }, // รหัสพนักงาน
  { wch: 38 }, // เครื่องจักรที่ไปทำ OT (OT Machine)
  { wch: 24 }  // เวลา
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
