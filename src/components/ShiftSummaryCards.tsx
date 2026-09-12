import React from 'react';
import { ShiftSummary } from '../types/attendance';
import { Sun, Moon, Sunset, Users, Clock, Flame, AlertTriangle } from 'lucide-react';

interface ShiftSummaryCardsProps {
  shiftSummaries: ShiftSummary[];
  selectedShiftFilter: number | 'ALL';
  onSelectShift: (shift: number | 'ALL') => void;
}

export const ShiftSummaryCards: React.FC<ShiftSummaryCardsProps> = ({
  shiftSummaries,
  selectedShiftFilter,
  onSelectShift
}) => {
  const getShiftIcon = (shift: number) => {
    switch (shift) {
      case 1:
        return <Sun className="w-6 h-6 text-amber-500" />;
      case 2:
        return <Sunset className="w-6 h-6 text-orange-500" />;
      case 3:
        return <Moon className="w-6 h-6 text-indigo-500" />;
      default:
        return <Sun className="w-6 h-6 text-blue-500" />;
    }
  };

  const getBadgeColor = (shift: number) => {
    switch (shift) {
      case 1:
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 2:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 3:
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            สรุปการเข้างานตามกะ (Shift Overview)
          </h2>
          <p className="text-xs text-slate-500">
            จำแนกพนักงาน, ชั่วโมงงานปกติ, OT และการเข้าสายในแต่ละกะ
          </p>
        </div>

        {/* Filter Reset */}
        {selectedShiftFilter !== 'ALL' && (
          <button
            onClick={() => onSelectShift('ALL')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
          >
            แสดงทุกกะ (Reset Filter)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {shiftSummaries.map(s => {
          const isSelected = selectedShiftFilter === s.shift;
          return (
            <div
              key={s.shift}
              onClick={() => onSelectShift(isSelected ? 'ALL' : s.shift)}
              className={`bg-white rounded-2xl border transition-all cursor-pointer p-6 relative overflow-hidden ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {/* Shift Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 shadow-inner">
                    {getShiftIcon(s.shift)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                      {s.shiftName}
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      เวลา {s.timeRange}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold border ${getBadgeColor(
                    s.shift
                  )}`}
                >
                  กะ {s.shift}
                </span>
              </div>

              {/* Grid Metrics */}
              <div className="grid grid-cols-2 gap-4">
                {/* Workers Present */}
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    <span>จำนวนคน</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {s.totalWorkers.toLocaleString()}{' '}
                    <span className="text-xs text-slate-500 font-normal">คน</span>
                  </div>
                </div>

                {/* Normal Work Hours */}
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>งานปกติ</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {s.totalNormalHours.toLocaleString()}{' '}
                    <span className="text-xs text-slate-500 font-normal">ชม.</span>
                  </div>
                </div>

                {/* OT Workers & Hours */}
                <div className="bg-orange-50/60 p-3 rounded-xl border border-orange-100">
                  <div className="flex items-center gap-1.5 text-xs text-orange-700 mb-1 font-medium">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span>จำนวน OT</span>
                  </div>
                  <div className="text-xl font-bold text-orange-700">
                    {s.totalOtWorkers}{' '}
                    <span className="text-xs text-orange-600 font-normal">คน</span>
                  </div>
                  <div className="text-[11px] text-orange-600 mt-0.5">
                    รวม {s.totalOtHours.toLocaleString()} ชม.
                  </div>
                </div>

                {/* Late Count */}
                <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-100">
                  <div className="flex items-center gap-1.5 text-xs text-rose-700 mb-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    <span>มาสาย (&gt;7น.)</span>
                  </div>
                  <div className="text-xl font-bold text-rose-700">
                    {s.totalLateWorkers}{' '}
                    <span className="text-xs text-rose-600 font-normal">คน</span>
                  </div>
                  <div className="text-[11px] text-rose-600 mt-0.5">
                    {s.totalWorkers > 0
                      ? ((s.totalLateWorkers / s.totalWorkers) * 100).toFixed(1)
                      : 0}
                    % ของกะ
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
