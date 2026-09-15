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
  Upload
} from 'lucide-react';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  currentPasswordHash: string;
  onUpdatePassword: (newPassword: string) => void;
  onExportBackup?: () => void;
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  currentPasswordHash,
  onUpdatePassword,
  onExportBackup
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
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
              <p className="text-[11px] text-slate-400">จัดการความปลอดภัยและออกจากระบบ Admin</p>
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
        <div className="p-6 space-y-6">

          {/* Section 1: Change Password */}
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

          {/* Section 2: Session and Logout */}
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
