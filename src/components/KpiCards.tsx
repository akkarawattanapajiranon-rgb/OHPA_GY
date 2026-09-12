import React from 'react';
import { OverallKPIs } from '../types/attendance';
import { Users, Clock, Flame, AlertTriangle, AlertCircle, Building2 } from 'lucide-react';

interface KpiCardsProps {
  kpis: OverallKPIs;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* 1. Total Workers Present */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-l-2xl"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            จำนวนคนที่มาทำงาน
          </span>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">{kpis.totalWorkers.toLocaleString()}</span>
          <span className="text-xs text-slate-500 font-medium">คน</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">นับจำนวนสแกนเข้ากะประจำวัน</p>
      </div>

      {/* 2. Total Normal Work Hours */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 rounded-l-2xl"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            ชั่วโมงงานปกติรวม
          </span>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">{kpis.totalNormalWorkHours.toLocaleString()}</span>
          <span className="text-xs text-slate-500 font-medium">ชม.</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">สูงสุด 8 ชม./กะ/คน</p>
      </div>

      {/* 3. Total OT Workers */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 rounded-l-2xl"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            จำนวนคนทำ OT
          </span>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
            <Flame className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-amber-600">{kpis.totalOtWorkers.toLocaleString()}</span>
          <span className="text-xs text-slate-500 font-medium">คน</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          คิดเป็น {kpis.totalWorkers > 0 ? ((kpis.totalOtWorkers / kpis.totalWorkers) * 100).toFixed(1) : 0}% ของทั้งหมด
        </p>
      </div>

      {/* 4. Total OT Hours */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500 rounded-l-2xl"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            ชั่วโมง OT รวม
          </span>
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600 group-hover:scale-110 transition-transform">
            <Flame className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-orange-600">{kpis.totalOtHours.toLocaleString()}</span>
          <span className="text-xs text-slate-500 font-medium">ชม.</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          เฉลี่ย {kpis.totalOtWorkers > 0 ? (kpis.totalOtHours / kpis.totalOtWorkers).toFixed(1) : 0} ชม./คนทำ OT
        </p>
      </div>

      {/* 5. Late Arrivals (> 7 mins) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500 rounded-l-2xl"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            จำนวนคนมาสาย
          </span>
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-rose-600">{kpis.totalLateWorkers.toLocaleString()}</span>
          <span className="text-xs text-slate-500 font-medium">คน</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">สายเกิน 7 นาทีจากเวลากะ</p>
      </div>

      {/* 6. Departments / Missing Punch */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500 rounded-l-2xl"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            แผนก / ลืมสแกน
          </span>
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">{kpis.uniqueDepartmentsCount}</span>
          <span className="text-xs text-slate-500 font-medium">แผนก</span>
        </div>
        <p className="text-[11px] text-purple-600 font-medium mt-1.5 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          ลืมสแกนเข้า/ออก: {kpis.totalMissingPunches} รายการ
        </p>
      </div>
    </div>
  );
};
