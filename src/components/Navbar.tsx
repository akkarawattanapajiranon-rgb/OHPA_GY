import { Fingerprint, Upload, RefreshCw, Users, Calendar, FolderOpen, ShieldCheck, Lock, Shield } from 'lucide-react';
import { ScanPreset } from '../data/default_scan_record';

interface NavbarProps {
  fileName: string;
  scanDate: string;
  mappedEmployeesCount: number;
  totalRecords: number;
  presets: ScanPreset[];
  isLoadingFolder?: boolean;
  isAdmin?: boolean;
  onSelectPreset: (presetId: string) => void;
  onFetchFolderScans: () => void;
  onOpenFolderInExplorer: () => void;
  onOpenUploadModal: () => void;
  onResetToDefault: () => void;
  onOpenAdminLogin: () => void;
  onOpenAdminSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  fileName,
  scanDate,
  mappedEmployeesCount,
  totalRecords,
  presets,
  isLoadingFolder = false,
  isAdmin = false,
  onSelectPreset,
  onFetchFolderScans,
  onOpenFolderInExplorer,
  onOpenUploadModal,
  onResetToDefault,
  onOpenAdminLogin,
  onOpenAdminSettings
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
          <div className="flex items-center space-x-2.5">
            {/* File/Date Selector Dropdown */}
            <div className="flex items-center space-x-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <select
                value={fileName}
                onChange={e => onSelectPreset(e.target.value)}
                className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[220px]"
              >
                {presets.map(p => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Button: Pull from scans Folder */}
            <button
              onClick={onFetchFolderScans}
              disabled={isLoadingFolder}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition-all hover:shadow-emerald-600/30 active:scale-95 cursor-pointer"
              title="กดเพื่อดึงและซิงค์ข้อมูลทั้งหมด (สแกนนิ้ว GY, Contractor รายชม.+รายเดือน, PDI/NPI & Bead, ปรับตำแหน่ง)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFolder ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{isLoadingFolder ? 'กำลังดึง...' : 'ดึงข้อมูลจากโฟลเดอร์'}</span>
              <span className="md:hidden">{isLoadingFolder ? 'ดึง...' : 'ดึงโฟลเดอร์'}</span>
            </button>

            {/* Quick Button: Open scans Folder */}
            <button
              onClick={onOpenFolderInExplorer}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-2 rounded-xl border border-slate-700 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
              title="เปิดโฟลเดอร์ scans ใน Windows Explorer"
            >
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline">โฟลเดอร์</span>
            </button>

            {/* DB Mapping Status Badge */}
            <div 
              className="hidden xl:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs cursor-help"
              title="จำนวนรายชื่อพนักงานที่ลงทะเบียนในฐานข้อมูล Master ทั้งหมด (Master Employee Database)"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">
                Master DB: <strong className="text-emerald-400">{mappedEmployeesCount.toLocaleString()}</strong> คน
              </span>
            </div>

            {/* Upload Button (Admin Protected) */}
            <button
              onClick={onOpenUploadModal}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition-all hover:shadow-blue-600/30 active:scale-95 cursor-pointer"
              title={isAdmin ? "นำเข้าไฟล์ด้วยตนเอง หรือเลือกโฟลเดอร์อื่น" : "ต้องใช้สิทธิ์ Admin เพื่อนำเข้าไฟล์"}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">นำเข้าไฟล์</span>
              {!isAdmin && <Lock className="w-3 h-3 text-blue-200" />}
            </button>

            {/* Admin Status / Login Button */}
            {isAdmin ? (
              <button
                onClick={onOpenAdminSettings}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                title="คลิกเพื่อจัดการความปลอดภัย / ออกจากระบบ Admin"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden md:inline">แอดมิน (Admin)</span>
              </button>
            ) : (
              <button
                onClick={onOpenAdminLogin}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                title="เข้าสู่ระบบผู้ดูแลระบบเพื่อเปิดสิทธิ์แก้ไข/นำเข้าข้อมูล"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">เข้าสู่ระบบ Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

