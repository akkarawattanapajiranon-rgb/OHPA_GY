import React, { useState } from 'react';
import { ManpowerComparisonRow } from '../types/attendance';
import { Users, Search, AlertCircle, CheckCircle2, ArrowUpDown } from 'lucide-react';

interface ManpowerGapTableProps {
  data: ManpowerComparisonRow[];
}

export const ManpowerGapTable: React.FC<ManpowerGapTableProps> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVER_ONLY' | 'UNDER_ONLY' | 'EXACT_ONLY'>('ALL');

  const filteredData = data.filter(row => {
    // Status filter across any shift
    if (statusFilter === 'OVER_ONLY' && !(row.shift1Status === 'OVER' || row.shift2Status === 'OVER' || row.shift3Status === 'OVER')) return false;
    if (statusFilter === 'UNDER_ONLY' && !(row.shift1Status === 'UNDER' || row.shift2Status === 'UNDER' || row.shift3Status === 'UNDER')) return false;
    if (statusFilter === 'EXACT_ONLY' && !(row.shift1Status === 'EXACT' && row.shift2Status === 'EXACT' && row.shift3Status === 'EXACT')) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      row.positionName.toLowerCase().includes(q) ||
      row.costCenter.toLowerCase().includes(q)
    );
  });

  // Calculate totals
  const totalS1Target = data.reduce((a, b) => a + b.shift1Target, 0);
  const totalS1Actual = data.reduce((a, b) => a + b.shift1Actual, 0);

  const totalS2Target = data.reduce((a, b) => a + b.shift2Target, 0);
  const totalS2Actual = data.reduce((a, b) => a + b.shift2Actual, 0);

  const totalS3Target = data.reduce((a, b) => a + b.shift3Target, 0);
  const totalS3Actual = data.reduce((a, b) => a + b.shift3Actual, 0);

  const renderStatusBadge = (
    target: number,
    actual: number,
    gap: number,
    status: 'EXACT' | 'OVER' | 'UNDER',
    regular?: number,
    otHC?: number,
    otHours?: number,
    otPeople?: number,
    positionName?: string
  ) => {
    const isWasReplacement = positionName === 'แทน WAS';

    if (target === 0 && actual === 0 && (!otHours || otHours === 0)) {
      return <span className="text-slate-400 font-mono text-[11px]">-</span>;
    }

    const hasOtSupport = (otHC !== undefined && otHC > 0) || (otHours !== undefined && otHours > 0);
    const displayOtPeople = otPeople || otHC || (otHours ? Math.ceil(otHours / 8) : 0);

    // Special Case: แทน WAS -> Show clean headcount e.g. "1 คน"
    if (isWasReplacement) {
      const count = displayOtPeople || actual;
      if (count <= 0) return <span className="text-slate-400 font-mono text-[11px]">-</span>;
      return (
        <span className="inline-flex items-center font-semibold px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200">
          {count} คน
        </span>
      );
    }

    // Dedicated case: Machines with no regular target in this shift (Target = 0) but having OT workers (e.g. 3-Roll Shift 2/3)
    if (target === 0 && hasOtSupport) {
      return (
        <div className="inline-flex flex-col items-center justify-center">
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[11px] border border-blue-200 shadow-xs"
            title={`กะนี้ไม่มีเป้าหมายปกติ มีพนักงานทำ OT มาช่วย ${displayOtPeople} คน (รวม ${otHours} ชม.)`}
          >
            ⚡ OT {displayOtPeople} คน ({otHours} ชม.)
          </span>
          {regular !== undefined && regular > 0 && (
            <span className="text-[10px] text-slate-500 font-medium mt-0.5">
              (สแกนปกติ {regular} คน)
            </span>
          )}
        </div>
      );
    }

    if (status === 'EXACT') {
      return (
        <div className="inline-flex flex-col items-center justify-center">
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded text-[11px] border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            พอดี ({actual}/{target})
          </span>
          {hasOtSupport && (
            <span
              className="text-[10px] text-emerald-800 font-medium mt-0.5 bg-emerald-100/60 px-1.5 py-0.2 rounded border border-emerald-200/60"
              title={`สแกนกะนี้ ${regular} คน + มีคนทำ OT มาช่วย ${displayOtPeople} คน (${otHours} ชม.)`}
            >
              (สแกน {regular} + OT {displayOtPeople} คน)
            </span>
          )}
        </div>
      );
    }
    if (status === 'OVER') {
      return (
        <div className="inline-flex flex-col items-center justify-center">
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded text-[11px] border border-rose-200 shadow-xs">
            <AlertCircle className="w-3 h-3 text-rose-500" />
            เกิน +{gap} ({actual}/{target})
          </span>
          {hasOtSupport && (
            <span
              className="text-[10px] text-rose-700 font-medium mt-0.5 bg-rose-100/60 px-1.5 py-0.2 rounded border border-rose-200/60"
              title={`สแกนกะนี้ ${regular} คน + มีคนทำ OT มาช่วย ${displayOtPeople} คน (${otHours} ชม.)`}
            >
              (สแกน {regular} + OT {displayOtPeople} คน)
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="inline-flex flex-col items-center justify-center">
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded text-[11px] border border-amber-200 shadow-xs">
          <AlertCircle className="w-3 h-3 text-amber-500" />
          ขาด {gap} ({actual}/{target})
        </span>
        {hasOtSupport && (
          <span
            className="text-[10px] text-amber-800 font-medium mt-0.5 bg-amber-100/60 px-1.5 py-0.2 rounded border border-amber-200/60"
            title={`สแกนกะนี้ ${regular} คน + มีคนทำ OT มาช่วย ${displayOtPeople} คน (${otHours} ชม.)`}
          >
            (สแกน {regular} + OT {displayOtPeople} คน)
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              ตารางเปรียบเทียบกำลังคน Standard HC vs สแกนนิ้วจริง (ทีม A)
            </h3>
            <p className="text-xs text-slate-500">
              เปรียบเทียบเป้าหมายอัตรากำลัง (Standard HC) กับพนักงานที่สแกนนิ้วเข้าทำงานจริงในแต่ละกะ
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาตำแหน่ง / Cost Center..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-56"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-medium"
          >
            <option value="ALL">แสดงทุกตำแหน่ง ({data.length})</option>
            <option value="OVER_ONLY">เฉพาะที่มีคนเกิน</option>
            <option value="UNDER_ONLY">เฉพาะที่มีคนขาด</option>
            <option value="EXACT_ONLY">เฉพาะที่จัดคนพอดี</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-3 text-center">#</th>
              <th className="py-3 px-4">ตำแหน่งงาน / เครื่องจักร (Machine/Position)</th>
              <th className="py-3 px-3 text-center">Cost Center</th>
              <th className="py-3 px-4 text-center bg-amber-50/50 border-x border-amber-100">
                กะ 1 (07:00 - 15:00)
              </th>
              <th className="py-3 px-4 text-center bg-orange-50/50 border-r border-orange-100">
                กะ 2 (15:00 - 23:00)
              </th>
              <th className="py-3 px-4 text-center bg-indigo-50/50">
                กะ 3 (23:00 - 07:00)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {filteredData.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                  {idx + 1}
                </td>
                <td className="py-2.5 px-4 font-bold text-slate-900">
                  <div>{row.positionName}</div>
                  {row.positionName.toLowerCase().includes('hot apexer') && (
                    <div className="text-[10px] text-blue-600 font-normal mt-0.5 flex items-center gap-1">
                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                        🔄 สลับกะยืดหยุ่นได้: 3-3-2 / 2-3-3 / 3-2-3 (รวม 8 คน)
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center font-mono">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                    {row.costCenter}
                  </span>
                </td>

                {/* Shift 1 */}
                <td className="py-2.5 px-4 text-center bg-amber-50/20 border-x border-amber-100/60">
                  {renderStatusBadge(
                    row.shift1Target,
                    row.shift1Actual,
                    row.shift1Gap,
                    row.shift1Status,
                    row.shift1Regular,
                    row.shift1OtHC,
                    row.shift1OtHours,
                    row.shift1OtPeople,
                    row.positionName
                  )}
                </td>

                {/* Shift 2 */}
                <td className="py-2.5 px-4 text-center bg-orange-50/20 border-r border-orange-100/60">
                  {renderStatusBadge(
                    row.shift2Target,
                    row.shift2Actual,
                    row.shift2Gap,
                    row.shift2Status,
                    row.shift2Regular,
                    row.shift2OtHC,
                    row.shift2OtHours,
                    row.shift2OtPeople,
                    row.positionName
                  )}
                </td>

                {/* Shift 3 */}
                <td className="py-2.5 px-4 text-center bg-indigo-50/20">
                  {renderStatusBadge(
                    row.shift3Target,
                    row.shift3Actual,
                    row.shift3Gap,
                    row.shift3Status,
                    row.shift3Regular,
                    row.shift3OtHC,
                    row.shift3OtHours,
                    row.shift3OtPeople,
                    row.positionName
                  )}
                </td>
              </tr>
            ))}

            {filteredData.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  ไม่พบตำแหน่งงานตามเงื่อนไขที่ค้นหา
                </td>
              </tr>
            )}
          </tbody>

          {/* Grand Totals */}
          <tfoot className="bg-slate-100 font-bold text-slate-900 border-t border-slate-200 text-xs">
            <tr>
              <td className="py-3 px-4" colSpan={3}>
                รวมเป้าหมายกำลังคนทั้งหมด (Total Standard HC Target vs Actual)
              </td>
              <td className="py-3 px-4 text-center bg-amber-100/60 border-x border-amber-200">
                เป้า {totalS1Target} | จริง {totalS1Actual} คน
                {totalS1Actual > totalS1Target && (
                  <span className="text-rose-600 ml-1 font-bold">(เกิน +{totalS1Actual - totalS1Target})</span>
                )}
                {totalS1Actual < totalS1Target && (
                  <span className="text-amber-700 ml-1 font-bold">(ขาด {totalS1Actual - totalS1Target})</span>
                )}
                {totalS1Actual === totalS1Target && totalS1Target > 0 && (
                  <span className="text-emerald-600 ml-1 font-bold">(พอดี)</span>
                )}
              </td>
              <td className="py-3 px-4 text-center bg-orange-100/60 border-r border-orange-200">
                เป้า {totalS2Target} | จริง {totalS2Actual} คน
                {totalS2Actual > totalS2Target && (
                  <span className="text-rose-600 ml-1 font-bold">(เกิน +{totalS2Actual - totalS2Target})</span>
                )}
                {totalS2Actual < totalS2Target && (
                  <span className="text-amber-700 ml-1 font-bold">(ขาด {totalS2Actual - totalS2Target})</span>
                )}
                {totalS2Actual === totalS2Target && totalS2Target > 0 && (
                  <span className="text-emerald-600 ml-1 font-bold">(พอดี)</span>
                )}
              </td>
              <td className="py-3 px-4 text-center bg-indigo-100/60">
                เป้า {totalS3Target} | จริง {totalS3Actual} คน
                {totalS3Actual > totalS3Target && (
                  <span className="text-rose-600 ml-1 font-bold">(เกิน +{totalS3Actual - totalS3Target})</span>
                )}
                {totalS3Actual < totalS3Target && (
                  <span className="text-amber-700 ml-1 font-bold">(ขาด {totalS3Actual - totalS3Target})</span>
                )}
                {totalS3Actual === totalS3Target && totalS3Target > 0 && (
                  <span className="text-emerald-600 ml-1 font-bold">(พอดี)</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
