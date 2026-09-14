import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { DailyAdjustmentRecord, EmployeeInfo } from '../types/attendance';
import { TEAM_A_STANDARD_HC } from '../data/teamA_standard_hc';
import {
  X,
  Upload,
  Download,
  Plus,
  Trash2,
  FileSpreadsheet,
  Shuffle
} from 'lucide-react';

interface DailyAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDateFormatted: string; // e.g. "13/09/2026"
  adjustments: DailyAdjustmentRecord[];
  onSaveAdjustments: (newAdjustments: DailyAdjustmentRecord[]) => void;
  employeeMap: Record<string, EmployeeInfo>;
}

export const DailyAdjustmentModal: React.FC<DailyAdjustmentModalProps> = ({
  isOpen,
  onClose,
  currentDateFormatted,
  adjustments,
  onSaveAdjustments,
  employeeMap
}) => {
  const [localAdjustments, setLocalAdjustments] = useState<DailyAdjustmentRecord[]>(adjustments);
  const [newEmpId, setNewEmpId] = useState('');
  const [newRegMachine, setNewRegMachine] = useState('');
  const [newOtMachine, setNewOtMachine] = useState('');
  const [newCustomStart, setNewCustomStart] = useState('');
  const [newCustomEnd, setNewCustomEnd] = useState('');
  const [newIsApproved] = useState(true);
  const [newReason, setNewReason] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if adjustments prop changes
  React.useEffect(() => {
    setLocalAdjustments(adjustments);
  }, [adjustments]);

  if (!isOpen) return null;

  const machineOptions = TEAM_A_STANDARD_HC.map(s => s.positionName);

  const handleAddRow = () => {
    if (!newEmpId.trim()) return;
    const cleanId = newEmpId.trim().replace(/\D/g, '').padStart(5, '0');
    const empInfo = employeeMap[cleanId];
    const newRecord: DailyAdjustmentRecord = {
      id: `adj-${Date.now()}-${cleanId}`,
      dateStr: currentDateFormatted,
      empId: cleanId,
      empName: empInfo?.nameTH || empInfo?.nameEN || `พนักงาน ${cleanId}`,
      regularMachineOverride: newRegMachine || undefined,
      otMachineOverride: newOtMachine || undefined,
      customStartTime: newCustomStart || undefined,
      customEndTime: newCustomEnd || undefined,
      isApprovedTiming: newIsApproved,
      reason: newReason.trim() || undefined
    };

    const updated = [...localAdjustments.filter(a => a.empId !== cleanId), newRecord];
    setLocalAdjustments(updated);
    onSaveAdjustments(updated);

    // Reset inputs
    setNewEmpId('');
    setNewRegMachine('');
    setNewOtMachine('');
    setNewCustomStart('');
    setNewCustomEnd('');
    setNewReason('');
  };

  const handleDeleteRow = (id: string) => {
    const updated = localAdjustments.filter(a => a.id !== id);
    setLocalAdjustments(updated);
    onSaveAdjustments(updated);
  };

  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'วันที่ (DD/MM/YYYY)': currentDateFormatted || '13/09/2026',
        'รหัสพนักงาน (Emp ID)': '11848',
        'ชื่อพนักงาน': 'วีระพันธ์ นุตะดี',
        'ย้ายเครื่องกะปกติ (Normal Machine)': '',
        'ย้ายเครื่อง OT (OT Machine)': '320 BANBURY # 2',
        'เวลาเข้าพิเศษ (HH:MM)': '',
        'เวลาออกพิเศษ (HH:MM)': '',
        'เหตุผล / หมายเหตุ': 'ไปช่วยทำ OT กะ 3 ที่ Mixer 2'
      },
      {
        'วันที่ (DD/MM/YYYY)': currentDateFormatted || '13/09/2026',
        'รหัสพนักงาน (Emp ID)': '12128',
        'ชื่อพนักงาน': 'พายุ บุญมาใส',
        'ย้ายเครื่องกะปกติ (Normal Machine)': '320 BANBURY # 2',
        'ย้ายเครื่อง OT (OT Machine)': '',
        'เวลาเข้าพิเศษ (HH:MM)': '',
        'เวลาออกพิเศษ (HH:MM)': '',
        'เหตุผล / หมายเหตุ': 'ย้ายไปประจำ Mixer 2 กะ 1'
      },
      {
        'วันที่ (DD/MM/YYYY)': currentDateFormatted || '13/09/2026',
        'รหัสพนักงาน (Emp ID)': '12140',
        'ชื่อพนักงาน': 'ถวิล ลืมอินทร์',
        'ย้ายเครื่องกะปกติ (Normal Machine)': '',
        'ย้ายเครื่อง OT (OT Machine)': '',
        'เวลาเข้าพิเศษ (HH:MM)': '11:00',
        'เวลาออกพิเศษ (HH:MM)': '19:00',
        'เหตุผล / หมายเหตุ': 'หัวหน้างานสั่งให้มาทำงาน 11:00-19:00'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily_Adjustments');
    XLSX.writeFile(wb, `Daily_Adjustments_Template_${(currentDateFormatted || 'Sample').replace(/\//g, '')}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawRows.length === 0) {
          setUploadStatus('ไฟล์ไม่มีข้อมูล');
          return;
        }

        const parsedAdjustments: DailyAdjustmentRecord[] = [];

        rawRows.forEach((row, idx) => {
          const keys = Object.keys(row);
          const findVal = (keywords: string[]) => {
            const matchKey = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase())));
            return matchKey ? String(row[matchKey]).trim() : '';
          };

          const rawEmpId = findVal(['รหัส', 'empid', 'emp id', 'id', 'emp']);
          if (!rawEmpId) return;

          const cleanId = rawEmpId.replace(/\D/g, '').padStart(5, '0');
          const dateStr = findVal(['วัน', 'date']) || currentDateFormatted;
          const regMachine = findVal(['กะปกติ', 'ย้ายเครื่อง', 'regular', 'normal']);
          const otMachine = findVal(['โอที', 'ot machine', 'เครื่อง ot', 'ot']);
          const customStart = findVal(['เวลาเข้า', 'start', 'เข้าพิเศษ']);
          const customEnd = findVal(['เวลาออก', 'end', 'ออกพิเศษ']);
          const reason = findVal(['เหตุผล', 'หมายเหตุ', 'reason', 'note']);

          const empInfo = employeeMap[cleanId];

          parsedAdjustments.push({
            id: `import-${Date.now()}-${idx}-${cleanId}`,
            dateStr,
            empId: cleanId,
            empName: empInfo?.nameTH || empInfo?.nameEN || `พนักงาน ${cleanId}`,
            regularMachineOverride: regMachine || undefined,
            otMachineOverride: otMachine || undefined,
            customStartTime: customStart || undefined,
            customEndTime: customEnd || undefined,
            isApprovedTiming: true,
            reason: reason || undefined
          });
        });

        if (parsedAdjustments.length > 0) {
          const updated = [
            ...localAdjustments.filter(a => !parsedAdjustments.some(p => p.empId === a.empId)),
            ...parsedAdjustments
          ];
          setLocalAdjustments(updated);
          onSaveAdjustments(updated);
          setUploadStatus(`นำเข้าสำเร็จ ${parsedAdjustments.length} รายการ`);
        } else {
          setUploadStatus('ไม่พบข้อมูลรหัสพนักงานในไฟล์');
        }
      } catch (err: any) {
        setUploadStatus(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                บันทึกการย้ายเครื่อง / OT ข้ามเครื่อง / เวลาพิเศษ ประจำวัน ({currentDateFormatted})
              </h2>
              <p className="text-xs text-slate-500">
                จัดการย้ายเครื่องกะปกติ, ย้ายเครื่องทำ OT หรือบันทึกเวลาที่หัวหน้างานมอบหมายเป็นกรณีพิเศษ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* Action Bar: Template Download & File Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <div>
              <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                ดาวน์โหลดแม่แบบ Excel / CSV
              </h4>
              <p className="text-[11px] text-blue-700/80 mb-2">
                ดาวน์โหลดไฟล์ตัวอย่างเพื่อกรอกข้อมูลรายชื่อพนักงานที่ย้ายเครื่องหรือทำ OT ข้ามเครื่อง
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 hover:bg-blue-50 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลด Template (.xlsx)
              </button>
            </div>

            <div>
              <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-1">
                <Upload className="w-4 h-4 text-blue-600" />
                นำเข้าไฟล์บันทึกรายวัน (Excel / CSV)
              </h4>
              <p className="text-[11px] text-blue-700/80 mb-2">
                เลือกไฟล์ Excel หรือ CSV เพื่ออัปเดตการย้ายเครื่องและ OT ของวันนี้อัตโนมัติ
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  id="adjustment-upload"
                />
                <label
                  htmlFor="adjustment-upload"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 shadow-xs cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  เลือกไฟล์อัปโหลด
                </label>
                {uploadStatus && (
                  <span className="text-xs text-blue-800 font-medium">
                    {uploadStatus}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Add Form */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              เพิ่มรายการปรับเปลี่ยนรายบุคคล
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  รหัสพนักงาน (5 หลัก)
                </label>
                <input
                  type="text"
                  placeholder="เช่น 11848"
                  value={newEmpId}
                  onChange={e => setNewEmpId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  1. ย้ายเครื่องกะปกติ (Regular Shift)
                </label>
                <select
                  value={newRegMachine}
                  onChange={e => setNewRegMachine(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                >
                  <option value="">- ใช้เครื่องประจำเดิม -</option>
                  {machineOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  2. ย้ายเครื่องทำ OT (OT Shift)
                </label>
                <select
                  value={newOtMachine}
                  onChange={e => setNewOtMachine(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                >
                  <option value="">- ใช้เครื่องประจำเดิม -</option>
                  {machineOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  3. เวลาเข้าพิเศษ (HH:MM)
                </label>
                <input
                  type="text"
                  placeholder="เช่น 11:00"
                  value={newCustomStart}
                  onChange={e => setNewCustomStart(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="เหตุผล / หมายเหตุ เช่น หัวหน้าสั่งให้ไปช่วย Mixer 2 กะ 3"
                  value={newReason}
                  onChange={e => setNewReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
              <button
                onClick={handleAddRow}
                disabled={!newEmpId.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                เพิ่มรายการ
              </button>
            </div>
          </div>

          {/* Adjustment List Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">
                รายการปรับเปลี่ยนของวันที่ {currentDateFormatted} ({localAdjustments.length} รายการ)
              </h4>
              {localAdjustments.length > 0 && (
                <button
                  onClick={() => {
                    setLocalAdjustments([]);
                    onSaveAdjustments([]);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                >
                  ล้างทั้งหมด
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center">#</th>
                    <th className="py-2.5 px-3">รหัสพนักงาน</th>
                    <th className="py-2.5 px-4">ชื่อ-นามสกุล</th>
                    <th className="py-2.5 px-3">ย้ายเครื่องกะปกติ</th>
                    <th className="py-2.5 px-3">ย้ายเครื่องทำ OT</th>
                    <th className="py-2.5 px-3">เวลาพิเศษ</th>
                    <th className="py-2.5 px-4">หมายเหตุ</th>
                    <th className="py-2.5 px-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {localAdjustments.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-blue-600">
                        {row.empId}
                      </td>
                      <td className="py-2 px-4 font-medium">
                        {row.empName || employeeMap[row.empId]?.nameTH || '-'}
                      </td>
                      <td className="py-2 px-3">
                        {row.regularMachineOverride ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
                            🔄 {row.regularMachineOverride}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {row.otMachineOverride ? (
                          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-purple-200">
                            ⭐ OT: {row.otMachineOverride}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        {row.customStartTime ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                            ⏰ {row.customStartTime} {row.customEndTime ? `- ${row.customEndTime}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-slate-600 text-[11px]">
                        {row.reason || '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {localAdjustments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                        ยังไม่มีรายการปรับเปลี่ยนของวันนี้ (ท่านสามารถเพิ่มรายคนด้านบน หรือนำเข้าไฟล์ Excel ได้)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="text-xs text-slate-500">
            ระบบจะอัปเดตยอด Standard HC และตารางสแกนนิ้วทันทีเมื่อมีการเปลี่ยนแปลง
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
          >
            เสร็จสิ้น
          </button>
        </div>

      </div>
    </div>
  );
};
