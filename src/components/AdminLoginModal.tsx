import React, { useState } from 'react';
import { ShieldCheck, Lock, X, AlertCircle, KeyRound } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  adminPasswordHash: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  adminPasswordHash
}) => {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const enteredTrimmed = password.trim();
    if (!enteredTrimmed) {
      setErrorMsg('กรุณากรอกรหัสผ่าน Admin');
      return;
    }

    // Default password is '1234' or saved custom password
    const validPassword = adminPasswordHash || '1234';

    if (enteredTrimmed === validPassword) {
      setPassword('');
      setErrorMsg(null);
      onLoginSuccess();
      onClose();
    } else {
      setErrorMsg('รหัสผ่าน Admin ไม่ถูกต้อง (รหัสเริ่มต้นคือ: 1234)');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-xl text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">เข้าสู่ระบบผู้ดูแลระบบ (Admin)</h2>
              <p className="text-[11px] text-slate-300">ยืนยันสิทธิ์เพื่อแก้ไขหรือนำเข้าข้อมูล</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center pb-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 border border-indigo-100 shadow-2xs">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">กรุณาใส่รหัสผ่านผู้ดูแลระบบ</h3>
            <p className="text-xs text-slate-500 mt-1">
              เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถอัปเดตไฟล์หรือแก้ไขการย้ายเครื่อง/OT ได้
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              รหัสผ่าน Admin (PIN / Password)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่าน (เริ่มต้น: 1234)"
              autoFocus
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-center tracking-widest font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1 text-center">
              รหัสผ่านเริ่มต้นคือ: <strong className="text-slate-600">1234</strong>
            </p>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              ยืนยันรหัสผ่าน
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
