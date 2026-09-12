import React from 'react';
import { Fingerprint, Upload, RefreshCw, Users, FileText, Calendar } from 'lucide-react';
import { SCAN_FILE_PRESETS } from '../data/default_scan_record';

interface NavbarProps {
  fileName: string;
  scanDate: string;
  mappedEmployeesCount: number;
  totalRecords: number;
  onSelectPreset: (presetId: string) => void;
  onOpenUploadModal: () => void;
  onResetToDefault: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  fileName,
  scanDate,
  mappedEmployeesCount,
  totalRecords,
  onSelectPreset,
  onOpenUploadModal,
  onResetToDefault
}) => {
  return (
    <header className="bg-slate-900 text-white shadow-lg border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-md flex items-center justify-center text-white">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide leading-tight flex items-center gap-2">
                ระบบรายงานเวลากะและ OT (สแกนนิ้ว)
                <span className="text-xs bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-400/30">
                  Production
                </span>
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>วันที่สแกน: <strong className="text-emerald-300">{scanDate}</strong></span>
              </p>
            </div>
          </div>

          {/* Quick Info & Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* File Selector Dropdown */}
            <div className="flex items-center space-x-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <select
                value={fileName}
                onChange={e => onSelectPreset(e.target.value)}
                className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer"
              >
                {SCAN_FILE_PRESETS.map(p => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* DB Mapping Status Badge */}
            <div className="hidden lg:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">
                พนักงานในฐานข้อมูล: <strong className="text-emerald-400">{mappedEmployeesCount.toLocaleString()}</strong> คน
              </span>
            </div>

            {/* Total Records Badge */}
            <div className="hidden lg:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300">
                ประมวลผล: <strong className="text-blue-400">{totalRecords.toLocaleString()}</strong> รายการ
              </span>
            </div>

            {/* Upload Button */}
            <button
              onClick={onOpenUploadModal}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition-all hover:shadow-blue-600/30 active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>นำเข้าไฟล์เพิ่ม</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
