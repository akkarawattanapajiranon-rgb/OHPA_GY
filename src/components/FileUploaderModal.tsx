import React, { useState } from 'react';
import { X, Upload, FileText, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { EmployeeInfo } from '../types/attendance';

interface FileUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadScanContent: (content: string, fileName: string) => void;
  onUpdateEmployeeMapping: (mapping: Record<string, EmployeeInfo>) => void;
}

export const FileUploaderModal: React.FC<FileUploaderModalProps> = ({
  isOpen,
  onClose,
  onUploadScanContent,
  onUpdateEmployeeMapping
}) => {
  const [activeTab, setActiveTab] = useState<'SCAN_TXT' | 'EMP_MAPPING'>('SCAN_TXT');
  const [scanFileSuccess, setScanFileSuccess] = useState<string | null>(null);
  const [mappingFileSuccess, setMappingFileSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Read .txt scan file
  const handleScanFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      setErrorMsg('กรุณาเลือกไฟล์ข้อความสแกนนิ้ว (.txt) เท่านั้น');
      return;
    }

    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      if (content) {
        onUploadScanContent(content, file.name);
        setScanFileSuccess(`นำเข้าไฟล์สแกนนิ้ว ${file.name} สำเร็จ!`);
        setTimeout(() => {
          onClose();
          setScanFileSuccess(null);
        }, 1200);
      }
    };
    reader.readAsText(file);
  };

  // Read Excel / CSV mapping file
  const handleMappingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const newMapping: Record<string, EmployeeInfo> = {};

        workbook.SheetNames.forEach(sheetName => {
          const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1 });
          if (!rows || rows.length < 2) return;

          rows.forEach((row, idx) => {
            if (idx === 0 || !row) return;
            for (let c = 0; c < Math.min(row.length, 10); c++) {
              const val = String(row[c] || '').trim();
              if (/^\d{3,5}$/.test(val)) {
                const empId = val.padStart(5, '0');
                const dept = String(row[1] || row[0] || '').trim();
                const nameTH = String(row[4] || row[3] || '').trim();
                const nameEN = String(row[5] || row[4] || '').trim();
                const pos = String(row[7] || row[6] || '').trim();

                newMapping[empId] = {
                  empId,
                  dept,
                  nameTH,
                  nameEN,
                  position: pos,
                  sheet: sheetName,
                  sourceFile: file.name
                };
              }
            }
          });
        });

        const count = Object.keys(newMapping).length;
        if (count > 0) {
          onUpdateEmployeeMapping(newMapping);
          setMappingFileSuccess(`นำเข้าฐานข้อมูลพนักงานสำเร็จเพิ่ม ${count.toLocaleString()} คน!`);
          setTimeout(() => {
            onClose();
            setMappingFileSuccess(null);
          }, 1500);
        } else {
          setErrorMsg('ไม่พบโครงสร้างรหัสพนักงานในไฟล์ Excel ที่เลือก');
        }
      } catch (err: any) {
        setErrorMsg(`เกิดข้อผิดพลาดในการอ่านไฟล์ Excel: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                นำเข้าไฟล์ข้อมูลสแกนนิ้ว / แผนก
              </h3>
              <p className="text-xs text-slate-500">
                อัปโหลดไฟล์สแกน (.txt) หรือไฟล์จับคู่รายชื่อ-แผนก (.xlsx)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 bg-slate-50/30 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('SCAN_TXT')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'SCAN_TXT'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. ไฟล์สแกนนิ้วประจำวัน (.txt)</span>
          </button>

          <button
            onClick={() => setActiveTab('EMP_MAPPING')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'EMP_MAPPING'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>2. รายชื่อ & แผนกพนักงาน (.xlsx)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {scanFileSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{scanFileSuccess}</span>
            </div>
          )}

          {mappingFileSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{mappingFileSuccess}</span>
            </div>
          )}

          {activeTab === 'SCAN_TXT' ? (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-all group">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 group-hover:scale-110 transition-transform mb-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  คลิกเพื่อเลือกไฟล์สแกนนิ้ว (.txt)
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  หรือลากไฟล์สแกนมาวางที่นี่ (เช่น 20260908.txt)
                </span>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleScanFileChange}
                  className="hidden"
                />
              </label>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                <div className="font-semibold text-slate-800">รูปแบบไฟล์ที่รองรับ:</div>
                <div className="font-mono bg-white p-2 rounded border border-slate-200 text-[11px] text-slate-700">
                  10712 &nbsp;O 09082026 0117 07<br />
                  01454 &nbsp;I 09082026 0458 01
                </div>
                <div className="text-[11px] text-slate-400">
                  รหัสพนักงาน 5 หลัก • I/O (เข้า/ออก) • วันที่ MMDDYYYY • เวลา HHMM SS
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/30 transition-all group">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 group-hover:scale-110 transition-transform mb-3">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  คลิกเพื่อเลือกไฟล์ Excel (.xlsx / .xls)
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  ไฟล์ประกอบด้วยคอลัมน์: รหัสพนักงาน, แผนก, ชื่อ-นามสกุล
                </span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleMappingFileChange}
                  className="hidden"
                />
              </label>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">คำแนะนำการอัปโหลดตารางรายชื่อ:</div>
                <p>
                  ระบบจะสแกนหาคอลัมน์รหัสพนักงาน 5 หลัก แล้วนำชื่อภาษาไทย และรหัสแผนกไปแมปเข้ากับประวัติการสแกนนิ้วอัตโนมัติ
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
