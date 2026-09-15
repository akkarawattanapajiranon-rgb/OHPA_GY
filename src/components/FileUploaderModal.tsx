import React, { useState } from 'react';
import { X, Upload, FileText, FileSpreadsheet, Check, AlertCircle, FolderOpen, RefreshCw, FolderSearch } from 'lucide-react';
import * as XLSX from 'xlsx';
import { EmployeeInfo } from '../types/attendance';

interface FileUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadScanContent: (content: string, fileName: string) => void;
  onUpdateEmployeeMapping: (mapping: Record<string, EmployeeInfo>) => void;
  onFetchFolderScans: () => Promise<{ success: boolean; message: string; fileCount?: number }>;
  onOpenFolderInExplorer: () => void;
  onBatchUploadFiles?: (files: { fileName: string; content: string }[]) => void;
}

export const FileUploaderModal: React.FC<FileUploaderModalProps> = ({
  isOpen,
  onClose,
  onUploadScanContent,
  onUpdateEmployeeMapping,
  onFetchFolderScans,
  onOpenFolderInExplorer,
  onBatchUploadFiles
}) => {
  const [activeTab, setActiveTab] = useState<'SCAN_FOLDER' | 'SCAN_TXT' | 'EMP_MAPPING'>('SCAN_FOLDER');
  const [scanFileSuccess, setScanFileSuccess] = useState<string | null>(null);
  const [mappingFileSuccess, setMappingFileSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false);

  if (!isOpen) return null;

  // Handle pull from scans folder
  const handlePullFromScansFolder = async () => {
    setErrorMsg(null);
    setIsLoadingFolder(true);
    try {
      const res = await onFetchFolderScans();
      if (res.success) {
        setScanFileSuccess(res.message);
        setTimeout(() => {
          onClose();
          setScanFileSuccess(null);
        }, 1500);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถเชื่อมต่อกับโฟลเดอร์ได้');
    } finally {
      setIsLoadingFolder(false);
    }
  };

  // Handle picking a folder from local computer (HTML5 webkitdirectory)
  const handleFolderPickerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const loadedFiles: { fileName: string; content: string }[] = [];
    const validExts = ['.txt', '.dat', '.csv', '.log'];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const lower = f.name.toLowerCase();
      if (validExts.some(ext => lower.endsWith(ext))) {
        const text = await f.text();
        if (text.trim()) {
          loadedFiles.push({ fileName: f.name, content: text });
        }
      }
    }

    if (loadedFiles.length === 0) {
      setErrorMsg('ไม่พบไฟล์สแกน (.txt, .dat, .csv) ในโฟลเดอร์ที่เลือก');
      return;
    }

    if (onBatchUploadFiles) {
      onBatchUploadFiles(loadedFiles);
    } else {
      onUploadScanContent(loadedFiles[0].content, loadedFiles[0].fileName);
    }

    setScanFileSuccess(`นำเข้าไฟล์จากโฟลเดอร์สำเร็จ ${loadedFiles.length} ไฟล์!`);
    setTimeout(() => {
      onClose();
      setScanFileSuccess(null);
    }, 1500);
  };

  // Read single .txt scan file
  const handleScanFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt') && !file.name.endsWith('.dat') && !file.name.endsWith('.csv')) {
      setErrorMsg('กรุณาเลือกไฟล์ข้อความสแกนนิ้ว (.txt, .dat, .csv) เท่านั้น');
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
            const col0 = String(row[0] || '').trim();
            if (/^\d{3,6}$/.test(col0)) {
              // GY HC report standard header: [0: Emp No, 1: TH Name, 2: EN Name, 3: Position Title, 4: Categories, 5: MOR, 6: Cost Center, 7: Manager, 8: Machine]
              const empId = col0.padStart(5, '0');
              const nameTH = String(row[1] || '').trim();
              const nameEN = String(row[2] || '').trim();
              const position = String(row[3] || '').trim();
              const category = String(row[4] || '').trim();
              const costCenter = String(row[6] || '').trim();
              const machine = String(row[8] || '').trim();
              const func = String(row[10] || row[9] || '').trim();
              const dept = costCenter ? `${costCenter} - ${func || 'Production'}` : (func || 'Production');

              newMapping[empId] = {
                empId,
                nameTH,
                nameEN,
                position,
                category,
                machine,
                dept,
                sheet: sheetName,
                sourceFile: file.name
              };
            } else {
              // Generic scan across row for ID
              for (let c = 0; c < Math.min(row.length, 5); c++) {
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
                  break;
                }
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
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                นำเข้าข้อมูลและดึงไฟล์สแกนนิ้ว
              </h3>
              <p className="text-xs text-slate-500">
                ดึงจากโฟลเดอร์ scans อัตโนมัติ หรือเลือกไฟล์จากเครื่อง
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 bg-slate-50/30 px-6 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('SCAN_FOLDER')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'SCAN_FOLDER'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FolderOpen className="w-4 h-4 text-emerald-600" />
            <span>1. ดึงจากโฟลเดอร์ scans</span>
          </button>

          <button
            onClick={() => setActiveTab('SCAN_TXT')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'SCAN_TXT'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>2. เลือกไฟล์เดี่ยว (.txt)</span>
          </button>

          <button
            onClick={() => setActiveTab('EMP_MAPPING')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors shrink-0 cursor-pointer ${
              activeTab === 'EMP_MAPPING'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-purple-600" />
            <span>3. ฐานข้อมูลพนักงาน (.xlsx)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {scanFileSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{scanFileSuccess}</span>
            </div>
          )}

          {mappingFileSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{mappingFileSuccess}</span>
            </div>
          )}

          {/* TAB 1: FOLDER AUTO-PULL */}
          {activeTab === 'SCAN_FOLDER' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">โฟลเดอร์จัดเก็บไฟล์สแกนหลัก (scans)</h4>
                      <p className="text-[11px] text-slate-500">
                        วางไฟล์สแกน เช่น <code className="bg-emerald-100/70 px-1 py-0.5 rounded text-emerald-900 font-mono">12092026.txt</code> ในโฟลเดอร์นี้
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-emerald-200/80 font-mono text-[11px] text-slate-700 flex items-center justify-between break-all">
                  <span>T:\...\สแกนนิ้ว record\SCAN นิ้ว GY</span>
                  <button
                    onClick={onOpenFolderInExplorer}
                    className="ml-2 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-sans font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    title="เปิดโฟลเดอร์ใน Windows Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                    <span>เปิดโฟลเดอร์</span>
                  </button>
                </div>

                <button
                  onClick={handlePullFromScansFolder}
                  disabled={isLoadingFolder}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-emerald-600/30 active:scale-98 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingFolder ? 'animate-spin' : ''}`} />
                  <span>{isLoadingFolder ? 'กำลังดึงข้อมูลจากโฟลเดอร์...' : 'ดึงข้อมูลจากโฟลเดอร์ scans ทันที'}</span>
                </button>
              </div>

              {/* Alternative: Pick any other folder */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FolderSearch className="w-4 h-4 text-blue-600" />
                      หรือเลือกโฟลเดอร์อื่นจากเครื่องของคุณ
                    </h5>
                    <p className="text-[11px] text-slate-500">
                      เลือกโฟลเดอร์ใดก็ได้ที่มีไฟล์สแกน .txt
                    </p>
                  </div>
                  <label className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs">
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>เลือกโฟลเดอร์</span>
                    <input
                      type="file"
                      // @ts-ignore
                      webkitdirectory=""
                      directory=""
                      multiple
                      onChange={handleFolderPickerChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SINGLE TXT FILE */}
          {activeTab === 'SCAN_TXT' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-all group">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 group-hover:scale-110 transition-transform mb-3">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  คลิกเพื่อเลือกไฟล์สแกนนิ้ว (.txt, .dat, .csv)
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  หรือลากไฟล์สแกนมาวางที่นี่
                </span>
                <input
                  type="file"
                  accept=".txt,.dat,.csv"
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
              </div>
            </div>
          )}

          {/* TAB 3: EXCEL MAPPING */}
          {activeTab === 'EMP_MAPPING' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 hover:bg-purple-50/30 transition-all group">
                <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 group-hover:scale-110 transition-transform mb-3">
                  <FileSpreadsheet className="w-8 h-8 text-purple-600" />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  คลิกเพื่อเลือกไฟล์ Excel (.xlsx / .xls)
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  ไฟล์ประกอบด้วย: รหัสพนักงาน, แผนก, ชื่อ-นามสกุล
                </span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleMappingFileChange}
                  className="hidden"
                />
              </label>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">คำแนะนำ:</div>
                <p>
                  ระบบจะสแกนหาคอลัมน์รหัสพนักงาน แล้วนำชื่อและแผนกไปแมปเข้ากับประวัติการสแกนนิ้วอัตโนมัติ
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <div className="text-[11px] text-slate-400">
            ระบบรองรับทั้งไฟล์ประจำวัน และไฟล์สแกนต่อเนื่องหลายวัน
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};

