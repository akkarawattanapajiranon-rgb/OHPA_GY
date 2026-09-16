import React, { useState } from 'react';
import { ParsedShiftRecord } from '../types/attendance';
import {
  Search,
  Download,
  AlertTriangle,
  Flame,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Briefcase,
  LogOut,
  Tag,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { classifyArea } from '../utils/ohpaCalculator';

interface EmployeeDetailTableProps {
  records: ParsedShiftRecord[];
  selectedShiftFilter: number | 'ALL';
  selectedDeptFilter: string;
  selectedCategoryFilter?: string;
  onSelectShift: (shift: number | 'ALL') => void;
  onSelectDept: (dept: string) => void;
  onSelectCategory?: (category: string) => void;
}

export const EmployeeDetailTable: React.FC<EmployeeDetailTableProps> = ({
  records,
  selectedShiftFilter,
  selectedDeptFilter,
  selectedCategoryFilter: propCategoryFilter,
  onSelectShift,
  onSelectDept,
  onSelectCategory
}) => {
  const [internalCategoryFilter, setInternalCategoryFilter] = useState<string>('ALL');
  const selectedCategoryFilter = propCategoryFilter !== undefined ? propCategoryFilter : internalCategoryFilter;
  const handleCategoryChange = (cat: string) => {
    if (onSelectCategory) {
      onSelectCategory(cat);
    } else {
      setInternalCategoryFilter(cat);
    }
    setCurrentPage(1);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OT_ONLY' | 'LATE_ONLY' | 'EARLY_LEAVE' | 'MISSING_PUNCH'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Extract available categories & depts for filters
  const categories = Array.from(new Set(records.map(r => r.category || 'Other'))).filter(Boolean).sort();
  const departments = Array.from(new Set(records.map(r => r.dept))).filter(Boolean).sort();

  // Category counts
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = records.filter(r => (r.category || 'Other') === cat).length;
    return acc;
  }, {} as Record<string, number>);

  // Helper for Category badge colors
  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'BCA':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Bias Aero':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Radial Aero':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Consumer':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Retread':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Non-MFG : Quality':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'Non-MFG : Engineering':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Filter records
  const filteredRecords = records.filter(r => {
    // Shift filter
    if (selectedShiftFilter !== 'ALL' && r.shift !== selectedShiftFilter) return false;
    // Category filter
    if (selectedCategoryFilter !== 'ALL' && (r.category || 'Other') !== selectedCategoryFilter) return false;
    // Dept filter
    if (selectedDeptFilter !== 'ALL' && r.dept !== selectedDeptFilter) return false;

    // Status filter
    if (statusFilter === 'OT_ONLY' && r.otHours <= 0) return false;
    if (statusFilter === 'LATE_ONLY' && !r.isLate) return false;
    if (statusFilter === 'EARLY_LEAVE' && !r.isEarlyLeave) return false;
    if (statusFilter === 'MISSING_PUNCH' && !r.hasMissingPunch) return false;

    // Search query
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.empId.toLowerCase().includes(q) ||
      r.nameTH.toLowerCase().includes(q) ||
      r.nameEN.toLowerCase().includes(q) ||
      (r.category && r.category.toLowerCase().includes(q)) ||
      r.dept.toLowerCase().includes(q) ||
      (r.machine && r.machine.toLowerCase().includes(q)) ||
      r.position.toLowerCase().includes(q)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + pageSize);

  // Summary counts
  const totalOtCount = records.filter(r => r.otHours > 0).length;
  const totalLateCount = records.filter(r => r.isLate).length;
  const totalEarlyLeaveCount = records.filter(r => r.isEarlyLeave).length;

  // Export to Excel with full Working Hours & Team Allocation
  const handleExportExcel = () => {
    const exportData = filteredRecords.map((r, i) => {
      let statusText = 'ตรงเวลา';
      if (r.isEarlyLeave && r.isLate) {
        statusText = `ลากลับก่อน (ทำ ${r.effectiveWorkHours} ชม.) & สาย ${r.lateMinutes} นาที`;
      } else if (r.isEarlyLeave) {
        statusText = `ลากลับก่อน (ทำ ${r.effectiveWorkHours} ชม.)`;
      } else if (r.isLate) {
        statusText = `สาย (${r.lateMinutes} นาที)`;
      } else if (!r.inTime || !r.outTime) {
        statusText = 'ขาดสแกน / สแกนไม่ครบ';
      }

      const areaResult = classifyArea(r.category, r.dept, r.costCenter, undefined, undefined, undefined, r.mu);
      const nHours = r.normalWorkHours !== undefined ? r.normalWorkHours : (r.effectiveWorkHours || 8);
      const otH = r.otHours || 0;
      const totH = nHours + otH;

      return {
        'ลำดับ': i + 1,
        'รหัสพนักงาน': r.empId,
        'ชื่อ-นามสกุล (ไทย)': r.nameTH,
        'ชื่อภาษาอังกฤษ (EN)': r.nameEN || '-',
        'ประเภท': 'Goodyear',
        'พื้นที่หลัก (5 Areas)': areaResult.key,
        'กลุ่มโรงงาน': areaResult.name,
        'หมวดหมู่ (Category)': r.category || '-',
        'เครื่องจักร (Machine)': r.machine || r.position,
        'ตำแหน่งงาน (Position)': r.position || '-',
        'Cost Center': r.dept,
        'กะการทำงาน': r.shiftLabel,
        'เวลาสแกนเข้า (IN)': r.inTimeFormatted || '-',
        'เวลาสแกนออก (OUT)': r.outTimeFormatted || '-',
        'ชม. ปกติ (ชม.)': nHours,
        'ชม. OT (ชม.)': otH,
        'ชม. ทำงานรวม (ชม.)': totH,
        'สถานะการสแกน': statusText,
        'หมายเหตุ OT': r.otNote || '-'
      };
    });

    const wb = XLSX.utils.book_new();

    // Sheet 1: All filtered records
    const wsAll = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, wsAll, 'Raw_Data_รายคน');

    // Sub-sheets separated by 5 Production Areas
    const areasList = ['BCA', 'Consumer', 'Bias Aero', 'Radial Aero', 'Retread'];
    areasList.forEach(areaKey => {
      const teamRecords = exportData.filter(r => r['พื้นที่หลัก (5 Areas)'] === areaKey);
      if (teamRecords.length > 0) {
        const renumbered = teamRecords.map((r, idx) => ({ ...r, 'ลำดับ': idx + 1 }));
        const wsTeam = XLSX.utils.json_to_sheet(renumbered);
        XLSX.utils.book_append_sheet(wb, wsTeam, `Team_${areaKey.replace(/\s+/g, '_')}`);
      }
    });

    XLSX.writeFile(wb, `ตารางสแกนนิ้วและจัดสรรทีมรายบุคคล_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                ตารางบันทึกการสแกนนิ้วรายบุคคล
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {filteredRecords.length} คน
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                รายชื่อพนักงานที่สแกนนิ้วเข้าทำงานจริง (1 คน ต่อ 1 แถว ไม่ซ้ำรายชื่อ)
              </p>
            </div>
          </div>
        </div>

        {/* Quick Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหารหัส, ชื่อ, เครื่องจักร..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-52"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={e => {
              handleCategoryChange(e.target.value);
            }}
            className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-medium"
          >
            <option value="ALL">หมวดหมู่ทั้งหมด ({records.length})</option>
            {categories.map(c => (
              <option key={c} value={c}>{c} ({categoryCounts[c] || 0})</option>
            ))}
          </select>

          {/* Shift Filter */}
          <select
            value={selectedShiftFilter}
            onChange={e => {
              onSelectShift(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
              setCurrentPage(1);
            }}
            className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-medium"
          >
            <option value="ALL">กะทั้งหมด</option>
            <option value="1">กะ 1 (07:00 - 15:00)</option>
            <option value="2">กะ 2 (15:00 - 23:00)</option>
            <option value="3">กะ 3 (23:00 - 07:00)</option>
          </select>

          {/* Dept Filter */}
          <select
            value={selectedDeptFilter}
            onChange={e => {
              onSelectDept(e.target.value);
              setCurrentPage(1);
            }}
            className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-medium"
          >
            <option value="ALL">Cost Center ทั้งหมด</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-medium"
          >
            <option value="ALL">สถานะทั้งหมด</option>
            <option value="OT_ONLY">เฉพาะคนทำ OT ({totalOtCount})</option>
            <option value="LATE_ONLY">เฉพาะคนมาสาย ({totalLateCount})</option>
            <option value="EARLY_LEAVE">เฉพาะคนลากลับก่อน ({totalEarlyLeaveCount})</option>
            <option value="MISSING_PUNCH">เฉพาะคนลืมสแกน</option>
          </select>

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก Excel</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => handleCategoryChange('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedCategoryFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>ทุกหมวดหมู่</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            selectedCategoryFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {records.length}
          </span>
        </button>

        {categories.map(cat => {
          const count = categoryCounts[cat] || 0;
          const isSelected = selectedCategoryFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <Tag className="w-3 h-3 text-current opacity-70" />
              <span>{cat}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-3 text-center w-12">#</th>
              <th className="py-3 px-3 w-24">รหัสพนักงาน</th>
              <th className="py-3 px-4">ชื่อ - นามสกุล</th>
              <th className="py-3 px-3">หมวดหมู่ (Category)</th>
              <th className="py-3 px-3">เครื่องจักร (Machine)</th>
              <th className="py-3 px-3">Cost Center</th>
              <th className="py-3 px-3 text-center">กะ</th>
              <th className="py-3 px-3 text-center">OT</th>
              <th className="py-3 px-3 text-center">เวลาสแกนเข้า (IN)</th>
              <th className="py-3 px-3 text-center">เวลาสแกนออก (OUT)</th>
              <th className="py-3 px-3 text-center">สถานะการทำงาน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-400">
                  ไม่พบข้อมูลตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              paginatedRecords.map((r, idx) => {
                const rowNum = startIndex + idx + 1;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Index */}
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                      {rowNum}
                    </td>

                    {/* Emp ID */}
                    <td className="py-2.5 px-3 font-bold text-slate-900 font-mono">
                      {r.empId}
                    </td>

                    {/* Employee Name */}
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      <div>{r.nameTH}</div>
                      {r.nameEN && r.nameEN !== r.nameTH && (
                        <div className="text-[10px] text-slate-400 font-normal">{r.nameEN}</div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getCategoryBadgeClass(r.category)}`}>
                        {r.category || 'Other'}
                      </span>
                    </td>

                    {/* Machine & Position */}
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      <div className="font-semibold text-slate-900">{r.machine || r.position}</div>
                      {r.regularMachineOverride ? (
                        <div className="mt-0.5">
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-300">
                            🔄 ย้ายกะปกติไป: {r.regularMachineOverride}
                          </span>
                        </div>
                      ) : r.machine && r.position && r.machine !== r.position && (
                        <div className="text-[10px] text-slate-500 font-normal">{r.position}</div>
                      )}
                    </td>

                    {/* Cost Center / Dept */}
                    <td className="py-2.5 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px] border border-slate-200">
                        {r.dept}
                      </span>
                    </td>

                    {/* Shift Badge */}
                    <td className="py-2.5 px-3 text-center font-medium">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          r.shift === 1
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : r.shift === 2
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        กะ {r.shift}
                      </span>
                    </td>

                    {/* OT Column */}
                    <td className="py-2.5 px-3 text-center">
                      {r.otHours > 0 ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px] border border-amber-300 shadow-xs">
                            <Flame className="w-3 h-3 text-amber-600" />
                            {r.otNote}
                          </span>
                          {r.otMachineOverride && (
                            <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 mt-0.5">
                              ⭐ ทำ OT ที่: {r.otMachineOverride}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">-</span>
                      )}
                    </td>

                    {/* Scan In */}
                    <td className="py-2.5 px-3 text-center font-mono">
                      {r.inTimeFormatted !== '-' ? (
                        <span className="font-medium text-slate-800">{r.inTimeFormatted}</span>
                      ) : (
                        <span className="text-rose-500 font-semibold text-[11px]">ไม่พบสแกนเข้า</span>
                      )}
                    </td>

                    {/* Scan Out */}
                    <td className="py-2.5 px-3 text-center font-mono">
                      {r.outTimeFormatted !== '-' ? (
                        <span className="font-medium text-slate-800">{r.outTimeFormatted}</span>
                      ) : (
                        <span className="text-rose-500 font-semibold text-[11px]">ไม่พบสแกนออก</span>
                      )}
                    </td>

                    {/* Status Column */}
                    <td className="py-2.5 px-3 text-center">
                      {r.adjustmentInfo?.isApprovedTiming || r.adjustmentInfo?.customStartTime ? (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px] border border-blue-200 shadow-xs">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            เวลาพิเศษ {r.adjustmentInfo.customStartTime ? `(${r.adjustmentInfo.customStartTime})` : ''}
                          </span>
                          {r.adjustmentInfo.reason && (
                            <span className="text-[10px] text-blue-700 font-medium max-w-[140px] truncate" title={r.adjustmentInfo.reason}>
                              {r.adjustmentInfo.reason}
                            </span>
                          )}
                        </div>
                      ) : r.isEarlyLeave && r.isLate ? (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded text-[11px] border border-amber-200 shadow-xs">
                            <LogOut className="w-3 h-3 text-amber-600" />
                            ลากลับก่อน {r.earlyLeaveHours ? `(${r.earlyLeaveHours} ชม.)` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-medium px-1.5 py-0.2 rounded text-[10px] border border-rose-200">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                            สาย {r.lateMinutes} นาที
                          </span>
                        </div>
                      ) : r.isEarlyLeave ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded text-[11px] border border-amber-200 shadow-xs">
                          <LogOut className="w-3 h-3 text-amber-600" />
                          ลากลับก่อน {r.earlyLeaveHours ? `(${r.earlyLeaveHours} ชม.)` : ''}
                        </span>
                      ) : r.isLate ? (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-semibold px-2 py-0.5 rounded text-[11px] border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          สาย ({r.lateMinutes} นาที)
                        </span>
                      ) : r.inTimeFormatted !== '-' && r.outTimeFormatted !== '-' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          ตรงเวลา
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>แสดง</span>
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>ทั้งหมด</option>
          </select>
          <span>รายการ ต่อหน้า (ทั้งหมด {filteredRecords.length} คน)</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 font-medium text-slate-700">
            หน้า {safeCurrentPage} จาก {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
