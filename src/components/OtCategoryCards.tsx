import React from 'react';
import { OtCategorySummary } from '../types/attendance';
import { Flame, AlertTriangle, Users, CalendarCheck } from 'lucide-react';

interface OtCategoryCardsProps {
  summary: OtCategorySummary;
}

export const OtCategoryCards: React.FC<OtCategoryCardsProps> = ({ summary }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            จำแนกประเภท OT ตามการจัดคน (OT Category Breakdown)
          </h2>
          <p className="text-xs text-slate-500">
            วิเคราะห์สาเหตุการเกิด OT: OT จากคนเกิน, OT ทำแทนคนขาด/ลา และ OT งานปกติ
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Overstaff OT */}
        <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                1. OT จากคนเกิน (Overstaff OT)
              </h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-200">
              คนเกินเป้า
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 font-medium">ชั่วโมง OT รวม:</span>
              <span className="text-2xl font-bold text-rose-600">
                {summary.overstaffOtHours.toLocaleString()} <span className="text-xs font-medium text-slate-500">ชม.</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-rose-50 text-slate-600">
              <span>จำนวนคนทำ OT กลุ่มนี้:</span>
              <strong className="text-rose-700">{summary.overstaffOtWorkers} คน</strong>
            </div>

            <p className="text-[11px] text-slate-400">
              เกิดจากจัดคนมาทำงานเกินเป้าหมาย Standard HC ประจำกะ
            </p>
          </div>
        </div>

        {/* 2. Replacement OT */}
        <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                2. OT ทำแทนคนขาด/ลา (Replacement OT)
              </h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-200">
              ทดแทนคนขาด
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 font-medium">ชั่วโมง OT รวม:</span>
              <span className="text-2xl font-bold text-amber-600">
                {summary.replacementOtHours.toLocaleString()} <span className="text-xs font-medium text-slate-500">ชม.</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-amber-50 text-slate-600">
              <span>จำนวนคนทำ OT กลุ่มนี้:</span>
              <strong className="text-amber-700">{summary.replacementOtWorkers} คน</strong>
            </div>

            <p className="text-[11px] text-slate-400">
              เกิดจากการทำ OT เพื่อครอบคลุมตำแหน่งที่มีพนักงานลาหรือขาดงาน
            </p>
          </div>
        </div>

        {/* 3. Scheduled OT */}
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                3. OT ตามแผนงานปกติ (Scheduled OT)
              </h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              ตามแผนงาน
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500 font-medium">ชั่วโมง OT รวม:</span>
              <span className="text-2xl font-bold text-emerald-600">
                {summary.scheduledOtHours.toLocaleString()} <span className="text-xs font-medium text-slate-500">ชม.</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-emerald-50 text-slate-600">
              <span>จำนวนคนทำ OT กลุ่มนี้:</span>
              <strong className="text-emerald-700">{summary.scheduledOtWorkers} คน</strong>
            </div>

            <p className="text-[11px] text-slate-400">
              OT งานปกติประจำตำแหน่งงานที่ได้รับอนุมัติตามแผนการผลิต
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
