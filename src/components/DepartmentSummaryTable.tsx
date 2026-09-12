import React, { useState } from 'react';
import { DepartmentSummary } from '../types/attendance';
import { Building2, Search, ArrowUpDown, Users, Flame } from 'lucide-react';

interface DepartmentSummaryTableProps {
  departmentSummaries: DepartmentSummary[];
  selectedDeptFilter: string;
  onSelectDept: (dept: string) => void;
}

export const DepartmentSummaryTable: React.FC<DepartmentSummaryTableProps> = ({
  departmentSummaries,
  selectedDeptFilter,
  onSelectDept
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'dept' | 'workers' | 'otHours'>('workers');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredDepts = departmentSummaries.filter(d =>
    d.dept.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.deptName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedDepts = [...filteredDepts].sort((a, b) => {
    let factor = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'workers') return (a.totalWorkers - b.totalWorkers) * factor;
    if (sortBy === 'otHours') return (a.totalOtHours - b.totalOtHours) * factor;
    return a.dept.localeCompare(b.dept, undefined, { numeric: true }) * factor;
  });

  const handleSort = (field: 'dept' | 'workers' | 'otHours') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              สรุปจำนวนคนและชั่วโมง OT แยกตามแผนก (Department Breakdown)
            </h3>
            <p className="text-xs text-slate-500">
              พบทั้งหมด {departmentSummaries.length} แผนกในระบบสแกนนิ้ว
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาแผนก..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 w-44"
            />
          </div>

          {selectedDeptFilter !== 'ALL' && (
            <button
              onClick={() => onSelectDept('ALL')}
              className="text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl border border-purple-200 transition-colors"
            >
              แสดงทุกแผนก
            </button>
          )}
        </div>
      </div>

      {/* Department Summary Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[420px]">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th
                onClick={() => handleSort('dept')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center gap-1">
                  <span>แผนก (Dept Code)</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('workers')}
                className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  <span>จำนวนคนรวม</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">กระจายตามกะ (กะ1 / กะ2 / กะ3)</th>
              <th className="py-3 px-4 text-center">ชม. งานปกติ</th>
              <th className="py-3 px-4 text-center">จำนวนคนทำ OT</th>
              <th
                onClick={() => handleSort('otHours')}
                className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  <span>ชม. OT รวม</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-center">มาสาย</th>
              <th className="py-3 px-4 text-center">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {sortedDepts.map(d => {
              const isSelected = selectedDeptFilter === d.dept;
              return (
                <tr
                  key={d.dept}
                  className={`hover:bg-slate-50 transition-colors ${
                    isSelected ? 'bg-purple-50/70 font-semibold' : ''
                  }`}
                >
                  <td className="py-3 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px] border border-slate-200">
                        {d.dept}
                      </span>
                      <span>{d.deptName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">
                    {d.totalWorkers} คน
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center space-x-1.5 text-[11px]">
                      <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                        กะ1: {d.shift1Workers}
                      </span>
                      <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200">
                        กะ2: {d.shift2Workers}
                      </span>
                      <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                        กะ3: {d.shift3Workers}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-emerald-600">
                    {d.totalNormalHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-amber-600">
                    {d.totalOtWorkers} คน
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-orange-600">
                    {d.totalOtHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-4 text-center">
                    {d.totalLateWorkers > 0 ? (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        {d.totalLateWorkers} คน
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onSelectDept(isSelected ? 'ALL' : d.dept)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors font-medium ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border-slate-200'
                      }`}
                    >
                      {isSelected ? 'ยกเลิกกรอง' : 'กรองแผนกนี้'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {sortedDepts.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  ไม่พบข้อมูลแผนกที่ค้นหา
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
