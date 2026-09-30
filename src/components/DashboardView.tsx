import React, { useState, useMemo } from 'react';
import { ParsedShiftRecord, EmployeeInfo, DailyAdjustmentRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { ScanPreset } from '../data/default_scan_record';
import { PdiBeadReport, DEFAULT_PDI_BEAD_REPORT } from '../data/default_pdi_bead';
import {
  HierarchyNode,
  HierarchyWorker,
  FunctionType,
  EmploymentType,
  buildPlantHierarchyTree,
  buildPlantHierarchyTreeForRange
} from '../utils/plantHierarchyEngine';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Building2,
  Layers,
  Cpu,
  Users,
  Clock,
  Flame,
  Search,
  Download,
  Filter,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Briefcase,
  ShieldCheck,
  HardHat,
  Award,
  CheckCircle2,
  Calendar,
  CalendarRange,
  SlidersHorizontal
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardViewProps {
  gyRecords: ParsedShiftRecord[];
  contractorRecords: ContractorScanRecord[];
  employeeMapping: Record<string, EmployeeInfo>;
  currentScanDateFormatted: string;
  allScanPresets?: ScanPreset[];
  contractorRecordsByDate?: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }>;
  onSelectDate?: (dateFormatted: string) => void;
  dailyAdjustments?: DailyAdjustmentRecord[];
  pdiBeadReport?: PdiBeadReport;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  gyRecords,
  contractorRecords,
  employeeMapping,
  currentScanDateFormatted,
  allScanPresets = [],
  contractorRecordsByDate = {},
  onSelectDate,
  dailyAdjustments = [],
  pdiBeadReport = DEFAULT_PDI_BEAD_REPORT
}) => {
  // Navigation & Drilldown State
  const [selectedNodeId, setSelectedNodeId] = useState<string>('PLANT');
  const [shiftFilter, setShiftFilter] = useState<number | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'PRODUCTION' | 'ENG' | 'QTECH' | 'WAS'>('ALL');
  const [functionFilter, setFunctionFilter] = useState<FunctionType | 'ALL'>('ALL');
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Preset Dates for Quick Selection (Descending: Newest to Oldest)
  const availablePresetDates = useMemo(() => {
    const set = new Set<string>();
    allScanPresets.forEach(p => {
      if (p.dateFormatted) set.add(p.dateFormatted);
    });
    return Array.from(set).sort((a, b) => {
      const pA = a.split('/').map(Number);
      const pB = b.split('/').map(Number);
      return (pB[2] || 0) - (pA[2] || 0) || (pB[1] || 0) - (pA[1] || 0) || (pB[0] || 0) - (pA[0] || 0);
    });
  }, [allScanPresets]);

  // Chronological Preset Dates (Ascending: Oldest to Newest)
  const chronologicalPresetDates = useMemo(() => {
    return [...availablePresetDates].reverse();
  }, [availablePresetDates]);

  // Date Mode State: 'SINGLE' (วันเดียว) | 'RANGE' (ช่วงวันที่)
  const [dateMode, setDateMode] = useState<'SINGLE' | 'RANGE'>('SINGLE');
  const [rangeStartDate, setRangeStartDate] = useState<string>('');
  const [rangeEndDate, setRangeEndDate] = useState<string>('');

  const effectiveStartDate = rangeStartDate || chronologicalPresetDates[0] || '01/09/2026';
  const effectiveEndDate = rangeEndDate || currentScanDateFormatted || availablePresetDates[0] || '29/09/2026';

  // Cache for parsed presets across multiple days to make range calculations instantaneous
  const parsedPresetsCache = useMemo(() => new Map<string, ParsedShiftRecord[]>(), []);

  // 1. Build Full Tree from Scan Records (Single Day or Date Range)
  const { root, allWorkers, dateRangeInfo } = useMemo(() => {
    if (dateMode === 'RANGE') {
      const rangeResult = buildPlantHierarchyTreeForRange(
        effectiveStartDate,
        effectiveEndDate,
        allScanPresets,
        contractorRecordsByDate,
        employeeMapping,
        shiftFilter,
        dailyAdjustments,
        categoryFilter,
        parsedPresetsCache
      );
      return {
        root: rangeResult.root,
        allWorkers: rangeResult.allWorkers,
        dateRangeInfo: {
          isRange: true,
          daysCount: rangeResult.daysCount,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          matchedDates: rangeResult.matchedDates
        }
      };
    }

    // Default Single Day Mode
    const singleDayResult = buildPlantHierarchyTree(
      gyRecords,
      contractorRecords,
      employeeMapping,
      currentScanDateFormatted,
      shiftFilter,
      allScanPresets,
      contractorRecordsByDate,
      dailyAdjustments,
      categoryFilter
    );
    return {
      root: singleDayResult.root,
      allWorkers: singleDayResult.allWorkers,
      dateRangeInfo: {
        isRange: false,
        daysCount: 1,
        startDate: currentScanDateFormatted,
        endDate: currentScanDateFormatted,
        matchedDates: [currentScanDateFormatted]
      }
    };
  }, [
    dateMode,
    effectiveStartDate,
    effectiveEndDate,
    gyRecords,
    contractorRecords,
    employeeMapping,
    currentScanDateFormatted,
    shiftFilter,
    allScanPresets,
    contractorRecordsByDate,
    dailyAdjustments,
    categoryFilter,
    parsedPresetsCache
  ]);

  // 2. Find Currently Selected Node & Breadcrumbs path
  const { currentNode, breadcrumbs } = useMemo(() => {
    const path: HierarchyNode[] = [];

    function findNodeAndPath(node: HierarchyNode, targetId: string, currentPath: HierarchyNode[]): HierarchyNode | null {
      const newPath = [...currentPath, node];
      if (node.id === targetId) {
        path.push(...newPath);
        return node;
      }
      if (node.children) {
        for (const child of node.children) {
          const res = findNodeAndPath(child, targetId, newPath);
          if (res) return res;
        }
      }
      return null;
    }

    const found = findNodeAndPath(root, selectedNodeId, []);
    return {
      currentNode: found || root,
      breadcrumbs: path.length > 0 ? path : [root]
    };
  }, [root, selectedNodeId]);

  // 3. Filtered Workers in Selected Node
  const displayedWorkers = useMemo(() => {
    if (!currentNode) return [];
    let list = currentNode.workers;

    if (functionFilter !== 'ALL') {
      list = list.filter(w => w.functionType === functionFilter);
    }
    if (employmentFilter !== 'ALL') {
      list = list.filter(w => w.employmentType === employmentFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        w =>
          w.empId.toLowerCase().includes(q) ||
          w.name.toLowerCase().includes(q) ||
          w.machineName.toLowerCase().includes(q) ||
          w.position.toLowerCase().includes(q) ||
          w.dept.toLowerCase().includes(q) ||
          w.costCenter.toLowerCase().includes(q)
      );
    }
    return list;
  }, [currentNode, functionFilter, employmentFilter, searchTerm]);

  // 4. Export Hierarchy to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Plant Hierarchy Summary
    const summaryRows: any[] = [];
    function flattenNode(node: HierarchyNode, depth = 0) {
      const indent = '  '.repeat(depth);
      summaryRows.push({
        'ระดับโครงสร้าง': indent + node.title,
        'Level': node.level,
        'จำนวนคนรวม (คน)': node.metrics.headcount,
        'ชม. ปกติ (ชม.)': node.metrics.normalHours,
        'ชม. OT (ชม.)': node.metrics.otHours,
        'ชม. รวมทั้งหมด (ชม.)': node.metrics.totalHours,
        'อัตรา OT (%)': `${node.metrics.otPercentage}%`,
        '🏭 Production (ชม.)': node.functions.production.totalHours,
        '🔬 Qtech (ชม.)': node.functions.qtech.totalHours,
        '⚙️ Eng (ชม.)': node.functions.eng.totalHours,
        '🤝 Share (ชม.)': node.functions.share.totalHours,
        '👔 Monthly (ชม.)': node.employment.monthly.totalHours,
        '👷 GY Hourly (ชม.)': node.employment.gyHourly.totalHours,
        '🦺 Contractor (ชม.)': node.employment.contractor.totalHours
      });
      if (node.children) {
        node.children.forEach(child => flattenNode(child, depth + 1));
      }
    }
    flattenNode(root, 0);

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Plant_Hierarchy_Summary');

    // Sheet 2: All Workers Drill-Down Detail
    const workerRows = allWorkers.map(w => ({
      'รหัสพนักงาน': w.empId,
      'ชื่อ-นามสกุล': w.name,
      'ประเภทพนักงาน': w.employmentLabel,
      'สายงาน (Function)': w.functionLabel,
      'ทีมหลัก (Team)': w.teamName,
      'กระบวนการ (Process)': w.processName,
      'เครื่องจักร / ประจำจุด (M/C)': w.machineName,
      'Cost Center': w.costCenter,
      'แผนก': w.dept,
      'ตำแหน่ง': w.position,
      'กะการทำงาน': w.shiftLabel,
      'ชม. ปกติ': w.normalHours,
      'ชม. OT': w.otHours,
      'ชม. รวม': w.totalHours
    }));
    const wsWorkers = XLSX.utils.json_to_sheet(workerRows);
    XLSX.utils.book_append_sheet(wb, wsWorkers, 'Worker_Details');

    const dateLabel = dateMode === 'RANGE'
      ? `${effectiveStartDate.replace(/\//g, '')}_to_${effectiveEndDate.replace(/\//g, '')}`
      : (currentScanDateFormatted || 'Date').replace(/\//g, '');
    XLSX.writeFile(wb, `Plant_TotalHours_OT_Hierarchy_${dateLabel}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Top Control Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Plant Total Hours & OT Hierarchy Dashboard
            </h2>
            <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
              From Plant ➔ by Team ➔ by Cost Center
            </span>
            <span className="bg-indigo-100 text-indigo-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
              Production • Qtech • Eng
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            แดชบอร์ดโครงสร้างโรงงานระดับลึก: ตรวจสอบกำลังพล ชั่วโมงทำงาน และ OT ทีละขั้นจากระดับโรงงาน สู่ทีม กระบวนการ และศูนย์ต้นทุน (Cost Center)
          </p>
        </div>

        {/* Date, Shift, and Export Action Bar */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Date Mode Toggle Pill: วันเดียว | ช่วงวันที่ */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setDateMode('SINGLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                dateMode === 'SINGLE'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="เลือกดูเฉพาะวันเดียว"
            >
              <Calendar className="w-3.5 h-3.5" />
              วันเดียว
            </button>
            <button
              type="button"
              onClick={() => {
                setDateMode('RANGE');
                if (!rangeStartDate && chronologicalPresetDates.length > 0) {
                  setRangeStartDate(chronologicalPresetDates[0]);
                }
                if (!rangeEndDate && availablePresetDates.length > 0) {
                  setRangeEndDate(availablePresetDates[0]);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all ${
                dateMode === 'RANGE'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="เลือกดูสะสมตามช่วงวันที่ (จาก...ถึง...)"
            >
              <CalendarRange className="w-3.5 h-3.5" />
              ช่วงวันที่
            </button>
          </div>

          {/* Date Selector: Single vs Range */}
          {dateMode === 'SINGLE' ? (
            availablePresetDates.length > 0 && onSelectDate && (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
                <Calendar className="w-4 h-4 text-indigo-600 mr-2" />
                <span className="text-xs font-semibold text-slate-600 mr-2">วันที่:</span>
                <select
                  value={currentScanDateFormatted}
                  onChange={(e) => onSelectDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {availablePresetDates.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )
          ) : (
            <div className="flex flex-wrap items-center gap-2 bg-indigo-50/70 border border-indigo-200 rounded-xl px-3 py-1 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-indigo-900 flex items-center gap-1">
                  จาก:
                </span>
                <select
                  value={effectiveStartDate}
                  onChange={(e) => setRangeStartDate(e.target.value)}
                  className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer shadow-2xs"
                >
                  {chronologicalPresetDates.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <span className="text-indigo-400 font-bold text-xs">➔</span>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-indigo-900">ถึง:</span>
                <select
                  value={effectiveEndDate}
                  onChange={(e) => setRangeEndDate(e.target.value)}
                  className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer shadow-2xs"
                >
                  {chronologicalPresetDates.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <span className="bg-indigo-600 text-white font-extrabold text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs whitespace-nowrap">
                สะสม {dateRangeInfo.daysCount} วัน
              </span>

              {/* Quick Shortcuts */}
              <div className="flex items-center gap-1 pl-1 border-l border-indigo-200">
                <button
                  type="button"
                  onClick={() => {
                    if (chronologicalPresetDates.length > 0) {
                      setRangeStartDate(chronologicalPresetDates[0]);
                      setRangeEndDate(chronologicalPresetDates[chronologicalPresetDates.length - 1]);
                    }
                  }}
                  className="text-[10px] font-bold px-1.5 py-0.5 bg-white hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200 transition-colors shadow-2xs"
                  title="เลือกทั้งเดือน (ตั้งแต่วันที่ 1 ถึงวันล่าสุด)"
                >
                  ทั้งเดือน (MTD)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (chronologicalPresetDates.length > 0) {
                      const lastIdx = chronologicalPresetDates.length - 1;
                      const startIdx = Math.max(0, lastIdx - 6);
                      setRangeStartDate(chronologicalPresetDates[startIdx]);
                      setRangeEndDate(chronologicalPresetDates[lastIdx]);
                    }
                  }}
                  className="text-[10px] font-bold px-1.5 py-0.5 bg-white hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200 transition-colors shadow-2xs"
                  title="เลือก 7 วันล่าสุด"
                >
                  7 วัน
                </button>
              </div>
            </div>
          )}

          {/* Shift Filter Pill Group */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setShiftFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                shiftFilter === 'ALL'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทุกกะ
            </button>
            <button
              onClick={() => setShiftFilter(1)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                shiftFilter === 1
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              กะ 1
            </button>
            <button
              onClick={() => setShiftFilter(2)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                shiftFilter === 2
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              กะ 2
            </button>
            <button
              onClick={() => setShiftFilter(3)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                shiftFilter === 3
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              กะ 3
            </button>
          </div>

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="ส่งออกรายงานโครงสร้างชั่วโมงทำงาน & OT"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก Excel</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Plant Organization Chart Tree (Org Chart Format) */}
      <div className="bg-slate-950 text-white rounded-3xl p-3 sm:p-4 md:p-6 shadow-2xl border border-slate-800/80 w-full overflow-hidden">
        {/* Org Chart Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-wide text-slate-100 uppercase">
                  โครงสร้างผังองค์กรโรงงาน (Plant Organization Chart)
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  Org Chart Tree
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                คลิกที่กล่อง (Node) ใดก็ได้ในผังองค์กรเพื่อเลือกเจาะลึกข้อมูลชั่วโมงทำงาน OT และรายชื่อพนักงานแบบเฉพาะจุด
              </p>
            </div>
          </div>

          {/* Filter Selection Buttons: ALL / Production / Eng / Qtech / WAS */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-700/80 shadow-inner">
            <span className="text-[11px] font-black text-slate-400 px-2 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>แสดงเฉพาะ:</span>
            </span>

            {/* ALL */}
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === 'ALL'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-black ring-2 ring-amber-300'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              ทั้งหมด (ALL)
            </button>

            {/* Production */}
            <button
              onClick={() => setCategoryFilter('PRODUCTION')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'PRODUCTION'
                  ? 'bg-blue-500 text-white shadow-md font-black ring-2 ring-blue-300'
                  : 'text-blue-300 hover:text-white hover:bg-blue-950/60'
              }`}
            >
              <span>🏭</span>
              <span>Production</span>
            </button>

            {/* Eng */}
            <button
              onClick={() => setCategoryFilter('ENG')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'ENG'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-300'
                  : 'text-amber-300 hover:text-white hover:bg-amber-950/60'
              }`}
            >
              <span>⚙️</span>
              <span>Eng</span>
            </button>

            {/* Qtech */}
            <button
              onClick={() => setCategoryFilter('QTECH')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'QTECH'
                  ? 'bg-purple-500 text-white shadow-md font-black ring-2 ring-purple-300'
                  : 'text-purple-300 hover:text-white hover:bg-purple-950/60'
              }`}
            >
              <span>🔬</span>
              <span>Qtech</span>
            </button>

            {/* WAS */}
            <button
              onClick={() => setCategoryFilter('WAS')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'WAS'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black ring-2 ring-emerald-300'
                  : 'text-emerald-300 hover:text-white hover:bg-emerald-950/60'
              }`}
            >
              <span>🦺</span>
              <span>WAS</span>
            </button>
          </div>
        </div>

        {/* Tree Canvas */}
        <div className="w-full pb-3 select-none">
          {/* LEVEL 0: ROOT - PLANT LEVEL (Centered) */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => setSelectedNodeId('PLANT')}
              className={`w-full max-w-md rounded-xl p-2.5 transition-all duration-200 cursor-pointer shadow-lg relative overflow-hidden group ${
                selectedNodeId === 'PLANT'
                  ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-slate-950 ring-4 ring-amber-400/60 scale-[1.01] shadow-amber-500/25'
                  : 'bg-slate-900 border-2 border-amber-500/60 hover:border-amber-400 text-slate-100 hover:bg-slate-850 hover:scale-[1.005]'
              }`}
            >
              {/* Accent top stripe */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />
              
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-lg ${selectedNodeId === 'PLANT' ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-400/20 text-amber-400'}`}>
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider block opacity-75 leading-none">
                      Root Node (ระดับโรงงาน)
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black tracking-wide">
                        PLANT (ทั้งโรงงาน Goodyear)
                      </span>
                      {dateRangeInfo.isRange && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-300 text-slate-950 rounded-full shadow-2xs">
                          สะสม {dateRangeInfo.daysCount} วัน ({dateRangeInfo.startDate} - {dateRangeInfo.endDate})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {selectedNodeId === 'PLANT' && (
                  <span className="bg-slate-950 text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                    กำลังดูอยู่
                  </span>
                )}
              </div>

              <div className={`grid grid-cols-3 gap-1 pt-1.5 border-t text-center ${selectedNodeId === 'PLANT' ? 'border-black/15' : 'border-slate-800'}`}>
                <div className="bg-black/10 rounded-md py-0.5 px-1">
                  <span className="text-[8.5px] block opacity-75 font-semibold">กำลังพลรวม</span>
                  <span className="text-[10.5px] font-black inline-flex items-center justify-center gap-1">
                    <Users className={`w-3.5 h-3.5 inline ${selectedNodeId === 'PLANT' ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                    {root.metrics.headcount.toLocaleString()} คน
                  </span>
                </div>
                <div className="bg-black/10 rounded-md py-0.5 px-1">
                  <span className="text-[8.5px] block opacity-75 font-semibold">ชม. ทำงานรวม</span>
                  <span className="text-[10.5px] font-black">⏱️ {root.metrics.totalHours.toLocaleString()} ชม.</span>
                </div>
                <div className="bg-black/10 rounded-md py-0.5 px-1">
                  <span className="text-[8.5px] block opacity-75 font-semibold">ชั่วโมง OT</span>
                  <span className="text-[10.5px] font-black text-amber-300 drop-shadow-xs">
                    🔥 {root.metrics.otHours.toLocaleString()}h ({root.metrics.otPercentage}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Vertical stem from Plant to Bus Bar */}
            <div className="w-0.5 h-4 bg-slate-600" />
          </div>

          {/* LEVEL 1 BUS CONNECTOR & 7 PROPORTIONAL TEAM COLUMNS */}
          <div className="relative w-full">
            {/* Horizontal Bus Bar spanning across all 7 main branch centers */}
            <div className="hidden lg:block absolute top-0 left-[7.14%] right-[3.57%] h-0.5 bg-slate-600">
              {/* Proportional Junction indicators */}
              <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
              <div className="absolute top-1/2 left-[16.0%] -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/30" />
              <div className="absolute top-1/2 left-[32.0%] -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-purple-400/30" />
              <div className="absolute top-1/2 left-[44.0%] -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
              <div className="absolute top-1/2 left-[56.0%] -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-orange-400 ring-2 ring-orange-400/30" />
              <div className="absolute top-1/2 left-[80.0%] -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-rose-400 ring-2 ring-rose-400/30" />
              <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-2 h-2 rounded-full bg-teal-400 ring-2 ring-teal-400/30" />
            </div>

            {/* 14 Grid Units Container for Perfect Balance on Single Page */}
            <div className="grid grid-cols-14 gap-1 sm:gap-1.5 pt-3 w-full">
              {/* ============================================================ */}
              {/* COLUMN 1: BCA (2 Grid Units) */}
              {/* ============================================================ */}
              {(() => {
                const bcaNode = root.children?.find(t => t.id === 'BCA');
                const isTeamSelected = selectedNodeId === 'BCA' || (breadcrumbs.some(b => b.id === 'BCA') && selectedNodeId !== 'PLANT');
                const mixNode = bcaNode?.children?.find(p => p.id === 'BCA_MIX_EXTRUSION');
                const prepNode = bcaNode?.children?.find(p => p.id === 'BCA_COMPONENT_PREP');

                return (
                  <div className="col-span-2 flex flex-col items-center min-w-0">
                    {/* Top drop line from bus bar */}
                    <div className="w-0.5 h-3 bg-slate-600 -mt-3 mb-0" />

                    {/* Team Node Card */}
                    <div
                      onClick={() => setSelectedNodeId('BCA')}
                      className={`w-full rounded-xl p-1.5 text-center transition-all cursor-pointer shadow-md relative overflow-hidden group ${
                        selectedNodeId === 'BCA'
                          ? 'bg-amber-400 text-slate-950 ring-2 sm:ring-4 ring-amber-300 scale-[1.01]'
                          : isTeamSelected
                          ? 'bg-amber-400/90 text-slate-950 ring-2 ring-amber-400'
                          : 'bg-slate-900 border border-amber-500/50 hover:border-amber-400 text-slate-100 hover:bg-slate-850'
                      }`}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                      <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        <span>BCA</span>
                      </div>
                      <div className="text-[8px] sm:text-[8.5px] opacity-80 mt-0.5 truncate">Banbury / Prep</div>
                      <div className="mt-1 pt-1 border-t border-black/10 flex items-center justify-around text-[8px] sm:text-[9.5px] font-bold">
                        <span className="inline-flex items-center gap-0.5"><Users className={`w-2.5 h-2.5 inline shrink-0 ${(selectedNodeId === 'BCA' || isTeamSelected) ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} /> {bcaNode?.metrics.headcount || 0}</span>
                        <span>⏱️ {bcaNode?.metrics.totalHours || 0}h</span>
                        <span className="text-amber-300 drop-shadow-xs">OT {bcaNode?.metrics.otHours || 0}h</span>
                      </div>
                    </div>

                    {/* Stem down to Processes */}
                    <div className="w-0.5 h-3 bg-slate-600" />

                    {/* Level 2 Bus Bar for BCA (Mix & Extrusion + Component Prep) */}
                    <div className="w-full relative">
                      <div className="absolute top-0 left-[25%] right-[25%] h-0.5 bg-slate-600" />
                      <div className="grid grid-cols-2 gap-1 pt-2">
                        {/* Process 1: Mix & Extrusion */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('BCA_MIX_EXTRUSION')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'BCA_MIX_EXTRUSION'
                                ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                                : 'bg-slate-900 border border-blue-500/40 hover:border-blue-400 text-blue-100 hover:bg-blue-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Mix & Extrusion</div>
                            <div className="text-[8px] text-blue-300 font-semibold mt-0.5 truncate">
                              {mixNode?.metrics.totalHours || 0}h ({mixNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Machines */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {mixNode?.children && mixNode.children.length > 0 ? (
                              mixNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-amber-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-amber-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>

                        {/* Process 2: Component Prep */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('BCA_COMPONENT_PREP')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'BCA_COMPONENT_PREP'
                                ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                                : 'bg-slate-900 border border-blue-500/40 hover:border-blue-400 text-blue-100 hover:bg-blue-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Component Prep</div>
                            <div className="text-[8px] text-blue-300 font-semibold mt-0.5 truncate">
                              {prepNode?.metrics.totalHours || 0}h ({prepNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Machines */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {prepNode?.children && prepNode.children.length > 0 ? (
                              prepNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-amber-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-amber-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ============================================================ */}
              {/* COLUMN 2: CONSUMER (2 Grid Units) */}
              {/* ============================================================ */}
              {(() => {
                const conNode = root.children?.find(t => t.id === 'CONSUMER');
                const isTeamSelected = selectedNodeId === 'CONSUMER' || (breadcrumbs.some(b => b.id === 'CONSUMER') && selectedNodeId !== 'PLANT');
                const buildNode = conNode?.children?.find(p => p.id === 'CONSUMER_BUILD');
                const ffNode = conNode?.children?.find(p => p.id === 'CONSUMER_FF_CURING');

                return (
                  <div className="col-span-2 flex flex-col items-center min-w-0">
                    {/* Top drop line from bus bar */}
                    <div className="w-0.5 h-3 bg-slate-600 -mt-3 mb-0" />

                    {/* Team Node Card */}
                    <div
                      onClick={() => setSelectedNodeId('CONSUMER')}
                      className={`w-full rounded-xl p-1.5 text-center transition-all cursor-pointer shadow-md relative overflow-hidden group ${
                        selectedNodeId === 'CONSUMER'
                          ? 'bg-cyan-400 text-slate-950 ring-2 sm:ring-4 ring-cyan-300 scale-[1.01]'
                          : isTeamSelected
                          ? 'bg-cyan-400/90 text-slate-950 ring-2 ring-cyan-400'
                          : 'bg-slate-900 border border-cyan-500/50 hover:border-cyan-400 text-slate-100 hover:bg-slate-850'
                      }`}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-400" />
                      <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                        <span>CONSUMER</span>
                      </div>
                      <div className="text-[8px] sm:text-[8.5px] opacity-80 mt-0.5 truncate">Assembly & Cure</div>
                      <div className="mt-1 pt-1 border-t border-black/10 flex items-center justify-around text-[8px] sm:text-[9.5px] font-bold">
                        <span className="inline-flex items-center gap-0.5"><Users className={`w-2.5 h-2.5 inline shrink-0 ${(selectedNodeId === 'CONSUMER' || isTeamSelected) ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} /> {conNode?.metrics.headcount || 0}</span>
                        <span>⏱️ {conNode?.metrics.totalHours || 0}h</span>
                        <span className="text-amber-300 drop-shadow-xs">OT {conNode?.metrics.otHours || 0}h</span>
                      </div>
                    </div>

                    {/* Stem down to Processes */}
                    <div className="w-0.5 h-3 bg-slate-600" />

                    {/* Level 2 Bus Bar for Consumer (Build + FF/Curing) */}
                    <div className="w-full relative">
                      <div className="absolute top-0 left-[25%] right-[25%] h-0.5 bg-slate-600" />
                      <div className="grid grid-cols-2 gap-1 pt-2">
                        {/* Process 1: Build */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('CONSUMER_BUILD')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'CONSUMER_BUILD'
                                ? 'bg-cyan-600 text-white ring-2 ring-cyan-300'
                                : 'bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-100 hover:bg-cyan-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Build</div>
                            <div className="text-[8px] text-cyan-300 font-semibold mt-0.5 truncate">
                              {buildNode?.metrics.totalHours || 0}h ({buildNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Machines */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {buildNode?.children && buildNode.children.length > 0 ? (
                              buildNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-cyan-400 text-slate-950 border-cyan-300 ring-2 ring-cyan-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-cyan-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-cyan-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>

                        {/* Process 2: FF / Curing */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('CONSUMER_FF_CURING')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'CONSUMER_FF_CURING'
                                ? 'bg-cyan-600 text-white ring-2 ring-cyan-300'
                                : 'bg-slate-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-100 hover:bg-cyan-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">FF / Curing</div>
                            <div className="text-[8px] text-cyan-300 font-semibold mt-0.5 truncate">
                              {ffNode?.metrics.totalHours || 0}h ({ffNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Machines */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {ffNode?.children && ffNode.children.length > 0 ? (
                              ffNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-cyan-400 text-slate-950 border-cyan-300 ring-2 ring-cyan-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-cyan-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-cyan-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ============================================================ */}
              {/* COLUMN 3: AERO (2 Grid Units) */}
              {/* ============================================================ */}
              {(() => {
                const aeroNode = root.children?.find(t => t.id === 'AERO');
                const isTeamSelected = selectedNodeId === 'AERO' || (breadcrumbs.some(b => b.id === 'AERO') && selectedNodeId !== 'PLANT');
                const biasNode = aeroNode?.children?.find(p => p.id === 'AERO_BIAS');
                const radialNode = aeroNode?.children?.find(p => p.id === 'AERO_RADIAL');

                return (
                  <div className="col-span-2 flex flex-col items-center min-w-0">
                    {/* Top drop line from bus bar */}
                    <div className="w-0.5 h-3 bg-slate-600 -mt-3 mb-0" />

                    {/* Team Node Card */}
                    <div
                      onClick={() => setSelectedNodeId('AERO')}
                      className={`w-full rounded-xl p-1.5 text-center transition-all cursor-pointer shadow-md relative overflow-hidden group ${
                        selectedNodeId === 'AERO'
                          ? 'bg-purple-400 text-slate-950 ring-2 sm:ring-4 ring-purple-300 scale-[1.01]'
                          : isTeamSelected
                          ? 'bg-purple-400/90 text-slate-950 ring-2 ring-purple-400'
                          : 'bg-slate-900 border border-purple-500/50 hover:border-purple-400 text-slate-100 hover:bg-slate-850'
                      }`}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-purple-400" />
                      <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                        <span>AERO</span>
                      </div>
                      <div className="text-[8px] sm:text-[8.5px] opacity-80 mt-0.5 truncate">Aviation Tire Ops</div>
                      <div className="mt-1 pt-1 border-t border-black/10 flex items-center justify-around text-[8px] sm:text-[9.5px] font-bold">
                        <span className="inline-flex items-center gap-0.5"><Users className={`w-2.5 h-2.5 inline shrink-0 ${(selectedNodeId === 'AERO' || isTeamSelected) ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} /> {aeroNode?.metrics.headcount || 0}</span>
                        <span>⏱️ {aeroNode?.metrics.totalHours || 0}h</span>
                        <span className="text-amber-300 drop-shadow-xs">OT {aeroNode?.metrics.otHours || 0}h</span>
                      </div>
                    </div>

                    {/* Stem down to Processes */}
                    <div className="w-0.5 h-3 bg-slate-600" />

                    {/* Level 2 Bus Bar for AERO (Bias + Radial) */}
                    <div className="w-full relative">
                      <div className="absolute top-0 left-[25%] right-[25%] h-0.5 bg-slate-600" />
                      <div className="grid grid-cols-2 gap-1 pt-2">
                        {/* Process 1: Bias Aero */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('AERO_BIAS')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'AERO_BIAS'
                                ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                                : 'bg-slate-900 border border-purple-500/40 hover:border-purple-400 text-purple-100 hover:bg-purple-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Bias Aero</div>
                            <div className="text-[8px] text-purple-300 font-semibold mt-0.5 truncate">
                              {biasNode?.metrics.totalHours || 0}h ({biasNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Machines */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {biasNode?.children && biasNode.children.length > 0 ? (
                              biasNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-purple-400 text-slate-950 border-purple-300 ring-2 ring-purple-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-purple-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-purple-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>

                        {/* Process 2: Radial Aero */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('AERO_RADIAL')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'AERO_RADIAL'
                                ? 'bg-purple-600 text-white ring-2 ring-purple-300'
                                : 'bg-slate-900 border border-purple-500/40 hover:border-purple-400 text-purple-100 hover:bg-purple-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Radial Aero</div>
                            <div className="text-[8px] text-purple-300 font-semibold mt-0.5 truncate">
                              {radialNode?.metrics.totalHours || 0}h ({radialNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Machines */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {radialNode?.children && radialNode.children.length > 0 ? (
                              radialNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-purple-400 text-slate-950 border-purple-300 ring-2 ring-purple-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-purple-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-purple-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ============================================================ */}
              {/* COLUMN 4: RETREAD (1 Grid Unit) */}
              {/* ============================================================ */}
              {(() => {
                const retNode = root.children?.find(t => t.id === 'RETREAD');
                const isTeamSelected = selectedNodeId === 'RETREAD' || (breadcrumbs.some(b => b.id === 'RETREAD') && selectedNodeId !== 'PLANT');
                const retOpsNode = retNode?.children?.find(p => p.id === 'RETREAD_RETREAD_OPS');

                return (
                  <div className="col-span-1 flex flex-col items-center min-w-0">
                    {/* Top drop line from bus bar */}
                    <div className="w-0.5 h-3 bg-slate-600 -mt-3 mb-0" />

                    {/* Team Node Card */}
                    <div
                      onClick={() => setSelectedNodeId('RETREAD')}
                      className={`w-full rounded-xl p-1.5 text-center transition-all cursor-pointer shadow-md relative overflow-hidden group ${
                        selectedNodeId === 'RETREAD'
                          ? 'bg-emerald-400 text-slate-950 ring-2 sm:ring-4 ring-emerald-300 scale-[1.01]'
                          : isTeamSelected
                          ? 'bg-emerald-400/90 text-slate-950 ring-2 ring-emerald-400'
                          : 'bg-slate-900 border border-emerald-500/50 hover:border-emerald-400 text-slate-100 hover:bg-slate-850'
                      }`}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                      <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                        <span>RETREAD</span>
                      </div>
                      <div className="text-[8px] sm:text-[8.5px] opacity-80 mt-0.5 truncate">Retread Plant</div>
                      <div className="mt-1 pt-1 border-t border-black/10 flex items-center justify-around text-[8px] sm:text-[9.5px] font-bold">
                        <span className="inline-flex items-center gap-0.5"><Users className={`w-2.5 h-2.5 inline shrink-0 ${(selectedNodeId === 'RETREAD' || isTeamSelected) ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} /> {retNode?.metrics.headcount || 0}</span>
                        <span>⏱️ {retNode?.metrics.totalHours || 0}h</span>
                        <span className="text-amber-300 drop-shadow-xs">OT {retNode?.metrics.otHours || 0}h</span>
                      </div>
                    </div>

                    {/* Stem down to Process */}
                    <div className="w-0.5 h-3 bg-slate-600" />

                    {/* Level 2 Single Process for Retread */}
                    <div className="w-full flex flex-col items-center pt-2 min-w-0">
                      <div
                        onClick={() => setSelectedNodeId('RETREAD_RETREAD_OPS')}
                        className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                          selectedNodeId === 'RETREAD_RETREAD_OPS'
                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                            : 'bg-slate-900 border border-emerald-500/40 hover:border-emerald-400 text-emerald-100 hover:bg-emerald-950/50'
                        }`}
                      >
                        <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Retread Ops</div>
                        <div className="text-[8px] text-emerald-300 font-semibold mt-0.5 truncate">
                          {retOpsNode?.metrics.totalHours || 0}h ({retOpsNode?.metrics.headcount || 0}p)
                        </div>
                      </div>

                      {/* Stem to Level 3 Machines */}
                      <div className="w-0.5 h-2.5 bg-slate-700" />
                      <div className="w-full space-y-1">
                        {retOpsNode?.children && retOpsNode.children.length > 0 ? (
                          retOpsNode.children.map(mach => {
                            const isMachSelected = selectedNodeId === mach.id;
                            return (
                              <button
                                key={mach.id}
                                onClick={() => setSelectedNodeId(mach.id)}
                                className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                  isMachSelected
                                    ? 'bg-emerald-400 text-slate-950 border-emerald-300 ring-2 ring-emerald-300 font-bold'
                                    : 'bg-slate-900/95 border-slate-700/80 hover:border-emerald-400 hover:bg-slate-800 text-slate-200'
                                }`}
                                title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                              >
                                <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                  {mach.title}
                                </div>
                                <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                  isMachSelected ? 'text-slate-950 font-black' : 'text-emerald-300'
                                }`}>
                                  <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                  <span className="inline-flex items-center gap-0.5">
                                    <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                    {mach.metrics.headcount}p
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ============================================================ */}
              {/* COLUMN 5: ENGINEERING (2 Grid Units) */}
              {/* ============================================================ */}
              {(() => {
                const engNode = root.children?.find(t => t.id === 'ENG');
                const isTeamSelected = selectedNodeId === 'ENG' || (breadcrumbs.some(b => b.id === 'ENG') && selectedNodeId !== 'PLANT');
                const maintNode = engNode?.children?.find(p => p.id === 'ENG_ENG_MAINT');
                const plantEngNode = engNode?.children?.find(p => p.id === 'ENG_ENG_PLANT');

                return (
                  <div className="col-span-2 flex flex-col items-center min-w-0">
                    {/* Top drop line from bus bar */}
                    <div className="w-0.5 h-3 bg-slate-600 -mt-3 mb-0" />

                    {/* Team Node Card */}
                    <div
                      onClick={() => setSelectedNodeId('ENG')}
                      className={`w-full rounded-xl p-1.5 text-center transition-all cursor-pointer shadow-md relative overflow-hidden group ${
                        selectedNodeId === 'ENG'
                          ? 'bg-orange-400 text-slate-950 ring-2 sm:ring-4 ring-orange-300 scale-[1.01]'
                          : isTeamSelected
                          ? 'bg-orange-400/90 text-slate-950 ring-2 ring-orange-400'
                          : 'bg-slate-900 border border-orange-500/50 hover:border-orange-400 text-slate-100 hover:bg-slate-850'
                      }`}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-orange-400" />
                      <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                        <span>ENG</span>
                      </div>
                      <div className="text-[8px] sm:text-[8.5px] opacity-80 mt-0.5 truncate">Engineering & Maint</div>
                      <div className="mt-1 pt-1 border-t border-black/10 flex items-center justify-around text-[8px] sm:text-[9.5px] font-bold">
                        <span className="inline-flex items-center gap-0.5"><Users className={`w-2.5 h-2.5 inline shrink-0 ${(selectedNodeId === 'ENG' || isTeamSelected) ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} /> {engNode?.metrics.headcount || 0}</span>
                        <span>⏱️ {engNode?.metrics.totalHours || 0}h</span>
                        <span className="text-amber-300 drop-shadow-xs">OT {engNode?.metrics.otHours || 0}h</span>
                      </div>
                    </div>

                    {/* Stem down to Processes */}
                    <div className="w-0.5 h-3 bg-slate-600" />

                    {/* Level 2 Bus Bar for ENG (Maintenance + Plant Eng) */}
                    <div className="w-full relative">
                      <div className="absolute top-0 left-[25%] right-[25%] h-0.5 bg-slate-600" />
                      <div className="grid grid-cols-2 gap-1 pt-2">
                        {/* Process 1: Maintenance */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('ENG_ENG_MAINT')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'ENG_ENG_MAINT'
                                ? 'bg-orange-600 text-white ring-2 ring-orange-300'
                                : 'bg-slate-900 border border-orange-500/40 hover:border-orange-400 text-orange-100 hover:bg-orange-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Maintenance</div>
                            <div className="text-[8px] text-orange-300 font-semibold mt-0.5 truncate">
                              {maintNode?.metrics.totalHours || 0}h ({maintNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Stations */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {maintNode?.children && maintNode.children.length > 0 ? (
                              maintNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-orange-400 text-slate-950 border-orange-300 ring-2 ring-orange-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-orange-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-orange-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>

                        {/* Process 2: Plant Engineering */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('ENG_ENG_PLANT')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'ENG_ENG_PLANT'
                                ? 'bg-orange-600 text-white ring-2 ring-orange-300'
                                : 'bg-slate-900 border border-orange-500/40 hover:border-orange-400 text-orange-100 hover:bg-orange-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Plant Eng</div>
                            <div className="text-[8px] text-orange-300 font-semibold mt-0.5 truncate">
                              {plantEngNode?.metrics.totalHours || 0}h ({plantEngNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Stations */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {plantEngNode?.children && plantEngNode.children.length > 0 ? (
                              plantEngNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-orange-400 text-slate-950 border-orange-300 ring-2 ring-orange-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-orange-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-orange-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ============================================================ */}
              {/* COLUMN 6: QTECH (4 Grid Units - 4 Equal Pillars) */}
              {/* ============================================================ */}
              {(() => {
                const qtechNode = root.children?.find(t => t.id === 'QTECH');
                const isTeamSelected = selectedNodeId === 'QTECH' || (breadcrumbs.some(b => b.id === 'QTECH') && selectedNodeId !== 'PLANT');
                const qtechANode = qtechNode?.children?.find(p => p.id === 'QTECH_QTECH_A');
                const qtechBNode = qtechNode?.children?.find(p => p.id === 'QTECH_QTECH_B');
                const qtechAeroNode = qtechNode?.children?.find(p => p.id === 'QTECH_QTECH_AERO');
                const qtechQaNode = qtechNode?.children?.find(p => p.id === 'QTECH_QTECH_QA');

                return (
                  <div className="col-span-4 flex flex-col items-center min-w-0">
                    {/* Top drop line from bus bar */}
                    <div className="w-0.5 h-3 bg-slate-600 -mt-3 mb-0" />

                    {/* Team Node Card */}
                    <div
                      onClick={() => setSelectedNodeId('QTECH')}
                      className={`w-full rounded-xl p-1.5 text-center transition-all cursor-pointer shadow-md relative overflow-hidden group ${
                        selectedNodeId === 'QTECH'
                          ? 'bg-rose-400 text-slate-950 ring-2 sm:ring-4 ring-rose-300 scale-[1.01]'
                          : isTeamSelected
                          ? 'bg-rose-400/90 text-slate-950 ring-2 ring-rose-400'
                          : 'bg-slate-900 border border-rose-500/50 hover:border-rose-400 text-slate-100 hover:bg-slate-850'
                      }`}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-rose-400" />
                      <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                        <span>QTECH</span>
                      </div>
                      <div className="text-[8px] sm:text-[8.5px] opacity-80 mt-0.5 truncate">Quality & Tech</div>
                      <div className="mt-1 pt-1 border-t border-black/10 flex items-center justify-around text-[8px] sm:text-[9.5px] font-bold">
                        <span className="inline-flex items-center gap-0.5"><Users className={`w-2.5 h-2.5 inline shrink-0 ${(selectedNodeId === 'QTECH' || isTeamSelected) ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} /> {qtechNode?.metrics.headcount || 0}</span>
                        <span>⏱️ {qtechNode?.metrics.totalHours || 0}h</span>
                        <span className="text-amber-300 drop-shadow-xs">OT {qtechNode?.metrics.otHours || 0}h</span>
                      </div>
                    </div>

                    {/* Stem down to Processes */}
                    <div className="w-0.5 h-3 bg-slate-600" />

                    {/* Level 2 Bus Bar for QTECH (4 Equal Pillars: Qtech A, Qtech B, Aero, QA) */}
                    <div className="w-full relative">
                      <div className="absolute top-0 left-[12.5%] right-[12.5%] h-0.5 bg-slate-600">
                        <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <div className="absolute top-1/2 left-[33.33%] -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <div className="absolute top-1/2 left-[66.67%] -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-1.5 h-1.5 rounded-full bg-rose-400" />
                      </div>
                      <div className="grid grid-cols-4 gap-1 pt-2">
                        {/* Pillar 1: Qtech A */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('QTECH_QTECH_A')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'QTECH_QTECH_A'
                                ? 'bg-rose-600 text-white ring-2 ring-rose-300'
                                : 'bg-slate-900 border border-rose-500/40 hover:border-rose-400 text-rose-100 hover:bg-rose-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Qtech A</div>
                            <div className="text-[8px] text-rose-300 font-semibold mt-0.5 truncate">
                              {qtechANode?.metrics.totalHours || 0}h ({qtechANode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Stations */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {qtechANode?.children && qtechANode.children.length > 0 ? (
                              qtechANode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-rose-400 text-slate-950 border-rose-300 ring-2 ring-rose-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-rose-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-rose-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>

                        {/* Pillar 2: Qtech B */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('QTECH_QTECH_B')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'QTECH_QTECH_B'
                                ? 'bg-rose-600 text-white ring-2 ring-rose-300'
                                : 'bg-slate-900 border border-rose-500/40 hover:border-rose-400 text-rose-100 hover:bg-rose-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Qtech B</div>
                            <div className="text-[8px] text-rose-300 font-semibold mt-0.5 truncate">
                              {qtechBNode?.metrics.totalHours || 0}h ({qtechBNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Stations */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {qtechBNode?.children && qtechBNode.children.length > 0 ? (
                              qtechBNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-rose-400 text-slate-950 border-rose-300 ring-2 ring-rose-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-rose-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-rose-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>

                        {/* Pillar 3: Aero */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('QTECH_QTECH_AERO')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'QTECH_QTECH_AERO'
                                ? 'bg-rose-600 text-white ring-2 ring-rose-300'
                                : 'bg-slate-900 border border-rose-500/40 hover:border-rose-400 text-rose-100 hover:bg-rose-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">Aero</div>
                            <div className="text-[8px] text-rose-300 font-semibold mt-0.5 truncate">
                              {qtechAeroNode?.metrics.totalHours || 0}h ({qtechAeroNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Stations */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {qtechAeroNode?.children && qtechAeroNode.children.length > 0 ? (
                              qtechAeroNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-rose-400 text-slate-950 border-rose-300 ring-2 ring-rose-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-rose-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-rose-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>

                        {/* Pillar 4: QA */}
                        <div className="flex flex-col items-center min-w-0">
                          <div className="w-0.5 h-2 bg-slate-600 -mt-2 mb-0" />
                          <div
                            onClick={() => setSelectedNodeId('QTECH_QTECH_QA')}
                            className={`w-full p-1 rounded-md text-center transition-all cursor-pointer shadow-xs ${
                              selectedNodeId === 'QTECH_QTECH_QA'
                                ? 'bg-rose-600 text-white ring-2 ring-rose-300'
                                : 'bg-slate-900 border border-rose-500/40 hover:border-rose-400 text-rose-100 hover:bg-rose-950/50'
                            }`}
                          >
                            <div className="text-[9px] sm:text-[9.5px] font-black leading-tight truncate">QA</div>
                            <div className="text-[8px] text-rose-300 font-semibold mt-0.5 truncate">
                              {qtechQaNode?.metrics.totalHours || 0}h ({qtechQaNode?.metrics.headcount || 0}p)
                            </div>
                          </div>

                          {/* Stem to Level 3 Stations */}
                          <div className="w-0.5 h-2.5 bg-slate-700" />
                          <div className="w-full space-y-1">
                            {qtechQaNode?.children && qtechQaNode.children.length > 0 ? (
                              qtechQaNode.children.map(mach => {
                                const isMachSelected = selectedNodeId === mach.id;
                                return (
                                  <button
                                    key={mach.id}
                                    onClick={() => setSelectedNodeId(mach.id)}
                                    className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                      isMachSelected
                                        ? 'bg-rose-400 text-slate-950 border-rose-300 ring-2 ring-rose-300 font-bold'
                                        : 'bg-slate-900/95 border-slate-700/80 hover:border-rose-400 hover:bg-slate-800 text-slate-200'
                                    }`}
                                    title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                                  >
                                    <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                      {mach.title}
                                    </div>
                                    <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                      isMachSelected ? 'text-slate-950 font-black' : 'text-rose-300'
                                    }`}>
                                      <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                      <span className="inline-flex items-center gap-0.5">
                                        <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                        {mach.metrics.headcount}p
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ============================================================ */}
              {/* COLUMN 7: SUPPORT DEPT (1 Grid Unit) */}
              {/* ============================================================ */}
              {(() => {
                const supportNode = root.children?.find(t => t.id === 'SUPPORT');
                const isTeamSelected = selectedNodeId === 'SUPPORT' || (breadcrumbs.some(b => b.id === 'SUPPORT') && selectedNodeId !== 'PLANT');
                const supportOpsNode = supportNode?.children?.find(p => p.id === 'SUPPORT_SUPPORT_OPS');

                return (
                  <div className="col-span-1 flex flex-col items-center min-w-0">
                    {/* Top drop line from bus bar */}
                    <div className="w-0.5 h-3 bg-slate-600 -mt-3 mb-0" />

                    {/* Team Node Card */}
                    <div
                      onClick={() => setSelectedNodeId('SUPPORT')}
                      className={`w-full rounded-xl p-1.5 text-center transition-all cursor-pointer shadow-md relative overflow-hidden group ${
                        selectedNodeId === 'SUPPORT'
                          ? 'bg-teal-400 text-slate-950 ring-2 sm:ring-4 ring-teal-300 scale-[1.01]'
                          : isTeamSelected
                          ? 'bg-teal-400/90 text-slate-950 ring-2 ring-teal-400'
                          : 'bg-slate-900 border border-teal-500/50 hover:border-teal-400 text-slate-100 hover:bg-slate-850'
                      }`}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-teal-400" />
                      <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 inline-block" />
                        <span>SUPPORT</span>
                      </div>
                      <div className="text-[8px] sm:text-[8.5px] opacity-80 mt-0.5 truncate">Support Dept</div>
                      <div className="mt-1 pt-1 border-t border-black/10 flex items-center justify-around text-[8px] sm:text-[9.5px] font-bold">
                        <span className="inline-flex items-center gap-0.5"><Users className={`w-2.5 h-2.5 inline shrink-0 ${(selectedNodeId === 'SUPPORT' || isTeamSelected) ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} /> {supportNode?.metrics.headcount || 0}</span>
                        <span>⏱️ {supportNode?.metrics.totalHours || 0}h</span>
                        <span className="text-amber-300 drop-shadow-xs">OT {supportNode?.metrics.otHours || 0}h</span>
                      </div>
                    </div>

                    {/* Stem directly down to Level 3 Stations */}
                    <div className="w-0.5 h-3 bg-slate-600" />

                    {/* Level 3 Stations for Support Dept */}
                    <div className="w-full flex flex-col items-center pt-1 min-w-0">
                      <div className="w-full space-y-1">
                        {supportOpsNode?.children && supportOpsNode.children.length > 0 ? (
                          supportOpsNode.children.map(mach => {
                            const isMachSelected = selectedNodeId === mach.id;
                            return (
                              <button
                                key={mach.id}
                                onClick={() => setSelectedNodeId(mach.id)}
                                className={`w-full p-1 rounded-md border text-left flex flex-col justify-center gap-0.5 transition-all cursor-pointer shadow-xs min-h-[38px] ${
                                  isMachSelected
                                    ? 'bg-teal-400 text-slate-950 border-teal-300 ring-2 ring-teal-300 font-bold'
                                    : 'bg-slate-900/95 border-slate-700/80 hover:border-teal-400 hover:bg-slate-800 text-slate-200'
                                }`}
                                title={`${mach.title} (${mach.metrics.totalHours} ชม., ${mach.metrics.headcount} คน)`}
                              >
                                <div className="text-[8.5px] sm:text-[9px] font-bold leading-tight break-words line-clamp-2">
                                  {mach.title}
                                </div>
                                <div className={`text-[7.5px] sm:text-[8px] flex items-center justify-between font-extrabold ${
                                  isMachSelected ? 'text-slate-950 font-black' : 'text-teal-300'
                                }`}>
                                  <span>⏱️ {mach.metrics.totalHours.toLocaleString()}h</span>
                                  <span className="inline-flex items-center gap-0.5">
                                    <Users className={`w-2.5 h-2.5 shrink-0 ${isMachSelected ? 'text-slate-950 fill-slate-950/40' : 'text-cyan-300 fill-cyan-300/50 drop-shadow-xs'}`} />
                                    {mach.metrics.headcount}p
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-[8px] text-slate-500 italic text-center py-1">ไม่มีข้อมูล</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Breadcrumbs & Node Selection Indicator */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2 text-xs font-bold text-slate-600">
          <span className="text-slate-400">มุมมองปัจจุบัน:</span>
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={b.id}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              <button
                onClick={() => setSelectedNodeId(b.id)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  idx === breadcrumbs.length - 1
                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {b.title}
              </button>
            </React.Fragment>
          ))}
        </div>

        {selectedNodeId !== 'PLANT' && (
          <button
            onClick={() => setSelectedNodeId('PLANT')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับไประดับโรงงาน (Plant Level)</span>
          </button>
        )}
      </div>

      {/* 4. Core KPI Summary Cards for Selected Node */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Working Hours */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ชั่วโมงทำงานรวม</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {currentNode.metrics.totalHours.toLocaleString()}
            <span className="text-xs font-semibold text-slate-400 ml-1">ชม.</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            ปกติ {currentNode.metrics.normalHours.toLocaleString()} ชม.
          </div>
        </div>

        {/* OT Hours */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ชั่วโมง OT</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">
            {currentNode.metrics.otHours.toLocaleString()}
            <span className="text-xs font-semibold text-slate-400 ml-1">ชม.</span>
          </div>
          <div className="text-[11px] font-bold text-amber-700 mt-1">
            อัตรา OT: {currentNode.metrics.otPercentage}%
          </div>
        </div>

        {/* Headcount */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">กำลังพลรวม</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-700 mt-2">
            {currentNode.metrics.headcount.toLocaleString()}
            <span className="text-xs font-semibold text-slate-400 ml-1">คน</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            เฉลี่ย {(currentNode.metrics.headcount > 0 ? (currentNode.metrics.totalHours / currentNode.metrics.headcount).toFixed(1) : 0)} ชม./คน
          </div>
        </div>

        {/* GY Hourly Workers */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">พนักงาน GY</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {currentNode.employment.gyHourly.totalHours.toLocaleString()}
            <span className="text-xs font-semibold text-slate-400 ml-1">ชม.</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            {currentNode.employment.gyHourly.headcount} คน (OT {currentNode.employment.gyHourly.otHours}h)
          </div>
        </div>

        {/* Contractor (WAS) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contractor (WAS)</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <HardHat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700 mt-2">
            {currentNode.employment.contractor.totalHours.toLocaleString()}
            <span className="text-xs font-semibold text-slate-400 ml-1">ชม.</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            {currentNode.employment.contractor.headcount} คน (OT {currentNode.employment.contractor.otHours}h)
          </div>
        </div>
      </div>

      {/* 5. Functional Breakdown (Production, Qtech, Eng, Share) Cards */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span>การจำแนกตามสายงาน (Function Breakdown in {currentNode.title})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              แยกตาม 3 ฝ่ายหลัก: ฝ่ายผลิต (Production), คุณภาพ (Qtech), และวิศวกรรม/ซ่อมบำรุง (Eng)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Function 1: Production */}
          <div
            onClick={() => setFunctionFilter(functionFilter === 'PRODUCTION' ? 'ALL' : 'PRODUCTION')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              functionFilter === 'PRODUCTION'
                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                🏭 Production (ฝ่ายผลิต)
              </span>
              <span className="text-[10px] font-extrabold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                {currentNode.functions.production.headcount} คน
              </span>
            </div>
            <div className="text-xl font-black text-blue-950 mt-2">
              {currentNode.functions.production.totalHours.toLocaleString()} ชม.
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
              <span>ปกติ {currentNode.functions.production.normalHours}h</span>
              <span className="font-bold text-amber-700">OT {currentNode.functions.production.otHours}h ({currentNode.functions.production.otPercentage}%)</span>
            </div>
          </div>

          {/* Function 2: Qtech */}
          <div
            onClick={() => setFunctionFilter(functionFilter === 'QTECH' ? 'ALL' : 'QTECH')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              functionFilter === 'QTECH'
                ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-300'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                🔬 Qtech (ฝ่ายคุณภาพ/QA)
              </span>
              <span className="text-[10px] font-extrabold bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">
                {currentNode.functions.qtech.headcount} คน
              </span>
            </div>
            <div className="text-xl font-black text-purple-950 mt-2">
              {currentNode.functions.qtech.totalHours.toLocaleString()} ชม.
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
              <span>ปกติ {currentNode.functions.qtech.normalHours}h</span>
              <span className="font-bold text-amber-700">OT {currentNode.functions.qtech.otHours}h ({currentNode.functions.qtech.otPercentage}%)</span>
            </div>
          </div>

          {/* Function 3: Eng */}
          <div
            onClick={() => setFunctionFilter(functionFilter === 'ENG' ? 'ALL' : 'ENG')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              functionFilter === 'ENG'
                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-300'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                ⚙️ Eng (วิศวกรรม/ซ่อมบำรุง)
              </span>
              <span className="text-[10px] font-extrabold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                {currentNode.functions.eng.headcount} คน
              </span>
            </div>
            <div className="text-xl font-black text-amber-950 mt-2">
              {currentNode.functions.eng.totalHours.toLocaleString()} ชม.
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
              <span>ปกติ {currentNode.functions.eng.normalHours}h</span>
              <span className="font-bold text-amber-700">OT {currentNode.functions.eng.otHours}h ({currentNode.functions.eng.otPercentage}%)</span>
            </div>
          </div>
        </div>

        {/* Visual Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100">
          {/* Chart 1: Sub-Nodes / Breakdown BarChart */}
          <div className="lg:col-span-2 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>📊 เปรียบเทียบชั่วโมงทำงาน & OT ใน {currentNode.title}</span>
              <span className="text-[10px] text-slate-500 font-normal">ปกติ (Normal) vs OT</span>
            </h4>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={currentNode.children && currentNode.children.length > 0
                    ? currentNode.children.map(c => ({
                        name: c.title.length > 18 ? c.title.slice(0, 16) + '…' : c.title,
                        'ชม. ปกติ': c.metrics.normalHours,
                        'ชม. OT': c.metrics.otHours,
                        'คน': c.metrics.headcount
                      }))
                    : [
                        { name: 'Production', 'ชม. ปกติ': currentNode.functions.production.normalHours, 'ชม. OT': currentNode.functions.production.otHours, 'คน': currentNode.functions.production.headcount },
                        { name: 'Qtech', 'ชม. ปกติ': currentNode.functions.qtech.normalHours, 'ชม. OT': currentNode.functions.qtech.otHours, 'คน': currentNode.functions.qtech.headcount },
                        { name: 'Eng', 'ชม. ปกติ': currentNode.functions.eng.normalHours, 'ชม. OT': currentNode.functions.eng.otHours, 'คน': currentNode.functions.eng.headcount }
                      ]
                  }
                  margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="ชม. ปกติ" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="ชม. OT" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Functions & Employment Distribution PieCharts */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
              🥧 สัดส่วนชั่วโมงจำแนกตามฝ่าย (Function Breakdown)
            </h4>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Production', value: currentNode.functions.production.totalHours, color: '#3b82f6' },
                      { name: 'Qtech', value: currentNode.functions.qtech.totalHours, color: '#a855f7' },
                      { name: 'Eng', value: currentNode.functions.eng.totalHours, color: '#f59e0b' }
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={62}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {[
                      { name: 'Production', color: '#3b82f6' },
                      { name: 'Qtech', color: '#a855f7' },
                      { name: 'Eng', color: '#f59e0b' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${Number(value).toLocaleString()} ชม.`, 'ชั่วโมงรวม']}
                    contentStyle={{ borderRadius: 12, fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-center text-[10px]">
              <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">GY รายกะ</span>
                <span className="font-extrabold text-emerald-700">{currentNode.employment.gyHourly.totalHours}h</span>
              </div>
              <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Contractor (WAS)</span>
                <span className="font-extrabold text-purple-700">{currentNode.employment.contractor.totalHours}h</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Sub-Nodes Comparison Table / Cards (Drill Down to Children) */}
      {currentNode.children && currentNode.children.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <span>
                  {currentNode.level === 'PLANT'
                    ? 'โครงสร้างแยกตามทีม (Teams in Plant)'
                    : currentNode.level === 'TEAM'
                    ? `กระบวนการย่อยในทีม ${currentNode.title} (Processes)`
                    : `เครื่องจักร / ประจำจุดใน ${currentNode.title} (Machines & Stations)`}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                คลิกที่แถวเพื่อเจาะลึกลงไปในระดับถัดไป
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold">
                  <th className="py-3 px-4">ชื่อส่วนงาน / เครื่องจักร</th>
                  <th className="py-3 px-3 text-center">กำลังพล (คน)</th>
                  <th className="py-3 px-3 text-right">ชม. ปกติ</th>
                  <th className="py-3 px-3 text-right">ชม. OT</th>
                  <th className="py-3 px-3 text-right text-indigo-900">ชม. รวม</th>
                  <th className="py-3 px-3 text-center">อัตรา OT</th>
                  <th className="py-3 px-3 text-right">🏭 Production</th>
                  <th className="py-3 px-3 text-right">🔬 Qtech</th>
                  <th className="py-3 px-3 text-right">⚙️ Eng</th>
                  <th className="py-3 px-3 text-right">🤝 Share</th>
                  <th className="py-3 px-3 text-center">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentNode.children.map(child => (
                  <tr
                    key={child.id}
                    onClick={() => setSelectedNodeId(child.id)}
                    className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="p-1 bg-slate-100 text-slate-600 rounded group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                      <span>{child.title}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">
                      {child.metrics.headcount}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {child.metrics.normalHours.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-amber-600">
                      {child.metrics.otHours.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-indigo-700 bg-indigo-50/30">
                      {child.metrics.totalHours.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-600">
                      {child.metrics.otPercentage}%
                    </td>
                    <td className="py-3 px-3 text-right text-blue-700 font-semibold">
                      {child.functions.production.totalHours}
                    </td>
                    <td className="py-3 px-3 text-right text-purple-700 font-semibold">
                      {child.functions.qtech.totalHours}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-700 font-semibold">
                      {child.functions.eng.totalHours}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-semibold">
                      {child.functions.share.totalHours}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(child.id);
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-[11px] font-bold transition-all"
                      >
                        เจาะลึก ➔
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Individual Worker Roster in Selected Node */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>รายชื่อพนักงานใน {currentNode.title} ({displayedWorkers.length} คน)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงรายการพนักงานและผู้รับเหมาช่วงที่ลงบันทึกเวลาในจุดนี้
            </p>
          </div>

          {/* Table Filters & Search */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Employment Filter */}
            <select
              value={employmentFilter}
              onChange={(e) => setEmploymentFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">ทุกประเภทการจ้าง</option>
              <option value="GY_HOURLY">พนักงาน GY (รายกะ)</option>
              <option value="CONTRACTOR_HOURLY">Contractor (WAS)</option>
            </select>

            {/* Function Filter */}
            <select
              value={functionFilter}
              onChange={(e) => setFunctionFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">ทุกสายงาน (All Functions)</option>
              <option value="PRODUCTION">🏭 Production</option>
              <option value="QTECH">🔬 Qtech</option>
              <option value="ENG">⚙️ Eng</option>
            </select>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหารหัส/ชื่อ/เครื่อง..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
              />
            </div>
          </div>
        </div>

        {/* Worker Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-600 font-extrabold">
              <tr>
                <th className="py-2.5 px-3">รหัสพนักงาน</th>
                <th className="py-2.5 px-3">ชื่อ-นามสกุล</th>
                <th className="py-2.5 px-3">ประเภท</th>
                <th className="py-2.5 px-3">สายงาน</th>
                <th className="py-2.5 px-3">ทีม / กระบวนการ</th>
                <th className="py-2.5 px-3">เครื่องจักร / จุดงาน</th>
                <th className="py-2.5 px-3">Cost Center</th>
                <th className="py-2.5 px-2 text-center">กะ</th>
                <th className="py-2.5 px-3 text-right">ชม. ปกติ</th>
                <th className="py-2.5 px-3 text-right">ชม. OT</th>
                <th className="py-2.5 px-3 text-right text-indigo-900 font-black">ชม. รวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedWorkers.length > 0 ? (
                displayedWorkers.map((w, idx) => (
                  <tr key={`${w.empId}_${w.shift}_${idx}`} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-slate-700">{w.empId}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{w.name}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        w.employmentType === 'GY_HOURLY'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : w.employmentType === 'CONTRACTOR_HOURLY'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {w.employmentLabel}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        w.functionType === 'PRODUCTION'
                          ? 'bg-blue-50 text-blue-700'
                          : w.functionType === 'QTECH'
                          ? 'bg-purple-50 text-purple-700'
                          : w.functionType === 'ENG'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {w.functionLabel}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 font-medium">
                      {w.teamName} ➔ {w.processName}
                    </td>
                    <td className="py-2 px-3 text-slate-800 font-bold">
                      {w.machineName}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-500">{w.costCenter}</td>
                    <td className="py-2 px-2 text-center font-bold text-slate-700">{w.shiftLabel}</td>
                    <td className="py-2 px-3 text-right text-slate-600">{w.normalHours}</td>
                    <td className="py-2 px-3 text-right font-bold text-amber-600">{w.otHours}</td>
                    <td className="py-2 px-3 text-right font-black text-indigo-700 bg-indigo-50/40">{w.totalHours}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-medium">
                    ไม่พบข้อมูลพนักงานตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
