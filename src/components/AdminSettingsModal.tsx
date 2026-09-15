import React, { useState } from 'react';
import {
  Shield,
  Key,
  Lock,
  LogOut,
  X,
  CheckCircle2,
  AlertCircle,
  Database,
  Download,
  Upload,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Sparkles
} from 'lucide-react';
import { PdiBeadReport } from '../data/default_pdi_bead';
import { parsePdiBeadArrayBuffer } from '../utils/pdiBeadParser';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  currentPasswordHash: string;
  onUpdatePassword: (newPassword: string) => void;
  onExportBackup?: () => void;
  pdiBeadReport?: PdiBeadReport;
  onUpdatePdiBeadReport?: (newReport: PdiBeadReport) => void;
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  currentPasswordHash,
  onUpdatePassword,
  onExportBackup,
  pdiBeadReport,
  onUpdatePdiBeadReport
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isSyncingPdi, setIsSyncingPdi] = useState(false);
  const [pdiStatusMsg, setPdiStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const validPass = currentPasswordHash || '1234';
    if (oldPassword.trim() !== validPass) {
      setStatusMsg({ type: 'error', text: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      return;
    }

    if (newPassword.trim().length < 4) {
      setStatusMsg({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร' });
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setStatusMsg({ type: 'error', text: 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน' });
      return;
    }

    onUpdatePassword(newPassword.trim());
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setStatusMsg({ type: 'success', text: 'เปลี่ยนรหัสผ่านผู้ดูแลระบบสำเร็จแล้ว!' });
  };

  // Sync PDI & Bead from network drive
  const handleSyncPdiFromNetwork = async () => {
    setIsSyncingPdi(true);
    setPdiStatusMsg(null);
    try {
      const res = await fetch('/api/sync-pdi-bead');
      const data = await res.json();
      if (data.success && data.report) {
        if (onUpdatePdiBeadReport) {
          onUpdatePdiBeadReport(data.report);
        }
        setPdiStatusMsg({
          type: 'success',
          text: `ดึงข้อมูลสำเร็จจาก ${data.targetPath || 'ไดรฟ์ T:'}`
        });
      } else {
        setPdiStatusMsg({
          type: 'error',
          text: data.message || 'ไม่สามารถอ่านไฟล์ OPAH hour PDI& B-ead.xlsx ได้'
        });
      }
    } catch (err: any) {
      setPdiStatusMsg({
        type: 'error',
        text: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อซิงค์ไฟล์ได้ (หากใช้งานบนเว็บให้ใช้ปุ่มอัปโหลด)'
      });
    } finally {
      setIsSyncingPdi(false);
    }
  };

  // Upload Excel file directly from browser
  const handleUploadPdiExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdiStatusMsg(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        if (!buffer) throw new Error('ไม่สามารถอ่านไฟล์ได้');

        const parsed = parsePdiBeadArrayBuffer(buffer);
        if (onUpdatePdiBeadReport) {
          onUpdatePdiBeadReport(parsed);
        }
        setPdiStatusMsg({
          type: 'success',
          text: `นำเข้าไฟล์ "${file.name}" สำเร็จ (${parsed.pdiPersons.length} คน PDI, รวม Bead)`
        });
      } catch (err: any) {
        setPdiStatusMsg({
          type: 'error',
          text: `เกิดข้อผิดพลาดในการนำเข้า: ${err.message || 'รูปแบบไฟล์ไม่ถูกต้อง'}`
        });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Calculate quick stats from pdiBeadReport
  const totalPdiMonth = pdiBeadReport?.pdiDailyTotals
    ? Object.values(pdiBeadReport.pdiDailyTotals).reduce((a, b) => a + b, 0)
    : 0;
  const totalBeadMonth = pdiBeadReport?.beadDailyTotals
    ? Object.values(pdiBeadReport.beadDailyTotals).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <span>การตั้งค่าผู้ดูแลระบบ (Admin Control Panel)</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-bold border border-emerald-500/30">
                  กำลังใช้งาน
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">จัดการข้อมูล OPAH, ความปลอดภัย และระบบ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* Section 1: PDI Deduct & B-end Bead Data Management */}
          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>จัดการข้อมูลชั่วโมง PDI & B-end (Bead)</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                {pdiBeadReport?.monthYear || '09/2026'}
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              สูตรคิด OPAH: นำ ชม.รวมทั้งโรงงาน <strong className="text-rose-600">- PDI Deduct</strong> และ <strong className="text-emerald-600">+ B-end Bead Add</strong> ในแต่ละวัน
            </p>

            {/* Quick Status Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-600">🔻 รวม PDI ทั้งเดือน (Deduct):</span>
                <strong className="text-rose-700 font-mono font-bold">-{totalPdiMonth.toFixed(1)} ชม.</strong>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-blue-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-600">🟢 รวม B-end ทั้งเดือน (Add):</span>
                <strong className="text-emerald-700 font-mono font-bold">+{totalBeadMonth.toFixed(1)} ชม.</strong>
              </div>
            </div>

            {pdiStatusMsg && (
              <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs ${
                pdiStatusMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                {pdiStatusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{pdiStatusMsg.text}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleSyncPdiFromNetwork}
                disabled={isSyncingPdi}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPdi ? 'animate-spin' : ''}`} />
                <span>{isSyncingPdi ? 'กำลังซิงค์...' : '🔄 ซิงค์จากไดรฟ์ T:'}</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>📤 อัปโหลดไฟล์ Excel (.xlsx)</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleUploadPdiExcel}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Section 2: Change Password */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-600" />
              เปลี่ยนรหัสผ่าน Admin
            </h3>

            {statusMsg && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                {statusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  รหัสผ่านเดิม
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="กรอกรหัสเดิม"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    รหัสผ่านใหม่
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="อย่างน้อย 4 ตัวอักษร"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    ยืนยันรหัสผ่านใหม่
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="กรอกยืนยันอีกครั้ง"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  บันทึกรหัสผ่านใหม่
                </button>
              </div>
            </form>
          </div>

          {/* Section 3: Session and Logout */}
          <div className="flex items-center justify-between p-4 bg-rose-50/50 rounded-xl border border-rose-100">
            <div>
              <h4 className="text-xs font-bold text-rose-950 flex items-center gap-1.5 mb-0.5">
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                ออกจากระบบผู้ดูแลระบบ (Lock / Logout)
              </h4>
              <p className="text-[11px] text-rose-700/80">
                กลับสู่โหมดอ่านอย่างเดียว (Viewer Mode) เพื่อความปลอดภัย
              </p>
            </div>
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ล็อกเอาต์</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

