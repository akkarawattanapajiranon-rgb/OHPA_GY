import React from 'react';
import { ShiftSummary } from '../types/attendance';
import { Layers } from 'lucide-react';

interface ShiftSummaryTableProps {
  shiftSummaries: ShiftSummary[];
}

export const ShiftSummaryTable: React.FC<ShiftSummaryTableProps> = ({ shiftSummaries }) => {
  const grandTotalWorkers = shiftSummaries.reduce((a, s) => a + s.totalWorkers, 0);
  const grandTotalNormalHours = shiftSummaries.reduce((a, s) => a + s.totalNormalHours, 0);
  const grandTotalOtWorkers = shiftSummaries.reduce((a, s) => a + s.totalOtWorkers, 0);
  const grandTotalOtHours = shiftSummaries.reduce((a, s) => a + s.totalOtHours, 0);
  const grandTotalLate = shiftSummaries.reduce((a, s) => a + s.totalLateWorkers, 0);
  const grandTotalMissing = shiftSummaries.reduce((a, s) => a + s.totalMissingPunch, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              ตารางเปรียบเทียบข้อมูลสรุปตามกะ (Shift Breakdown Table)
            </h3>
            <p className="text-xs text-slate-500">
              รายละเอียดเปรียบเทียบยอดรวมพนักงานและจำนวนชั่วโมงทำงานแยกตามกะ
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">ชื่อกะ</th>
              <th className="py-3 px-4">ช่วงเวลาทำงาน</th>
              <th className="py-3 px-4 text-center">จำนวนพนักงาน (คน)</th>
              <th className="py-3 px-4 text-center">ชม. งานปกติรวม</th>
              <th className="py-3 px-4 text-center">จำนวนคนทำ OT</th>
              <th className="py-3 px-4 text-center">ชม. OT รวม</th>
              <th className="py-3 px-4 text-center">มาสาย (&gt;7 น.)</th>
              <th className="py-3 px-4 text-center">ลืมสแกน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {shiftSummaries.map(s => (
              <tr key={s.shift} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      s.shift === 1
                        ? 'bg-amber-400'
                        : s.shift === 2
                        ? 'bg-orange-500'
                        : 'bg-indigo-500'
                    }`}
                  ></span>
                  {s.shiftName}
                </td>
                <td className="py-3 px-4 text-slate-600 font-medium">{s.timeRange}</td>
                <td className="py-3 px-4 text-center font-bold text-slate-900">
                  {s.totalWorkers.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-center font-semibold text-emerald-600">
                  {s.totalNormalHours.toLocaleString()} ชม.
                </td>
                <td className="py-3 px-4 text-center font-semibold text-amber-600">
                  {s.totalOtWorkers.toLocaleString()} คน
                </td>
                <td className="py-3 px-4 text-center font-bold text-orange-600">
                  {s.totalOtHours.toLocaleString()} ชม.
                </td>
                <td className="py-3 px-4 text-center">
                  {s.totalLateWorkers > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      {s.totalLateWorkers} คน
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {s.totalMissingPunch > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                      {s.totalMissingPunch} คน
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-bold text-slate-900 border-t border-slate-200">
            <tr>
              <td className="py-3 px-4" colSpan={2}>
                รวมทั้งหมด (Grand Total)
              </td>
              <td className="py-3 px-4 text-center text-blue-600">
                {grandTotalWorkers.toLocaleString()} คน
              </td>
              <td className="py-3 px-4 text-center text-emerald-700">
                {grandTotalNormalHours.toLocaleString()} ชม.
              </td>
              <td className="py-3 px-4 text-center text-amber-700">
                {grandTotalOtWorkers.toLocaleString()} คน
              </td>
              <td className="py-3 px-4 text-center text-orange-700">
                {grandTotalOtHours.toLocaleString()} ชม.
              </td>
              <td className="py-3 px-4 text-center text-rose-700">
                {grandTotalLate} คน
              </td>
              <td className="py-3 px-4 text-center text-purple-700">
                {grandTotalMissing} รายการ
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
