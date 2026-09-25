import React, { useState, useMemo } from 'react';
import { ParsedShiftRecord, EmployeeInfo, DailyAdjustmentRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { ScanPreset } from '../data/default_scan_record';
import {
  extractAllLateAndEarlyRecords,
  exportLateEarlyExcel,
  LateRecordItem,
  EarlyLeaveRecordItem,
  WeeklyStatSummary,
  AreaStatSummary,
  ShiftStatSummary,
  TopViolatorItem
} from '../utils/lateEarlyHelper';
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
  Cell,
  LineChart,
  Line
} from 'recharts';
import {
  Clock,
  AlertTriangle,
  LogOut,
  Users,
  Calendar,
  Layers,
  Download,
  TrendingDown,
  Building2,
  ShieldAlert,
  Flame,
  X,
  Info,
  CalendarDays
} from 'lucide-react';

interface LateEarlyDashboardViewProps {
  gyRecords: ParsedShiftRecord[];
  contractorRecords: ContractorScanRecord[];
  employeeMapping: Record<string, EmployeeInfo>;
  currentScanDateFormatted: string;
  allScanPresets?: ScanPreset[];
  contractorRecordsByDate?: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }>;
  onSelectDate?: (dateFormatted: string) => void;
  dailyAdjustments?: DailyAdjustmentRecord[];
}

export const LateEarlyDashboardView: React.FC<LateEarlyDashboardViewProps> = ({
  gyRecords,
  contractorRecords,
  employeeMapping,
  currentScanDateFormatted,
  allScanPresets = [],
  contractorRecordsByDate = {},
  onSelectDate,
  dailyAdjustments = []
}) => {
  // Horizon Filter: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  const [horizon, setHorizon] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [selectedWeek, setSelectedWeek] = useState<number>(0); // 0 = all weeks, 1..5 = specific week
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = all / current

  // Selected Employee for Incident Drilldown Modal
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  // Extract master dataset
  const dataset = useMemo(() => {
    return extractAllLateAndEarlyRecords(
      allScanPresets,
      contractorRecordsByDate,
      employeeMapping,
      dailyAdjustments
    );
  }, [allScanPresets, contractorRecordsByDate, employeeMapping, dailyAdjustments]);

  // Selected Employee Detail Records
  const selectedEmpData = useMemo(() => {
    if (!selectedEmpId) return null;
    const lateList = dataset.allLateRecords.filter(r => r.empId === selectedEmpId);
    const earlyList = dataset.allEarlyRecords.filter(r => r.empId === selectedEmpId);
    
    // Basic info from first available record
    const baseRecord = lateList[0] || earlyList[0];
    const rawId = selectedEmpId.replace(/\D/g, '');
    const mapped = employeeMapping[selectedEmpId] || employeeMapping[rawId] || employeeMapping[rawId.padStart(5, '0')];

    const nameTH = baseRecord?.nameTH || mapped?.nameTH || '-';
    const nameEN = baseRecord?.nameEN || mapped?.nameEN || '-';
    const empType = baseRecord?.empType || (selectedEmpId.startsWith('9') ? 'Contractor (WAS)' : 'Goodyear');
    const areaKey = baseRecord?.areaKey || mapped?.mu || '-';
    const areaName = baseRecord?.areaName || '-';
    const dept = baseRecord?.dept || mapped?.dept || '-';
    const position = baseRecord?.position || mapped?.position || '-';

    const totalLateCount = lateList.length;
    const totalLateMinutes = lateList.reduce((s, r) => s + r.lateMinutes, 0);
    const totalEarlyCount = earlyList.length;
    const totalEarlyHours = Math.round(earlyList.reduce((s, r) => s + r.earlyHours, 0) * 10) / 10;

    // Combined sorted timeline events
    const timeline = [
      ...lateList.map(r => ({
        type: 'LATE' as const,
        dateStr: r.dateStr,
        dayNum: r.dayNum,
        dayName: r.dayName,
        weekLabel: r.weekLabel,
        weekNum: r.weekNum,
        shift: r.shift,
        shiftLabel: r.shiftLabel,
        punchTime: r.inTime,
        punchLabel: 'เวลาเข้า',
        quantityFormatted: `+${r.lateMinutes} นาที`,
        machine: r.machine,
        remark: r.remark
      })),
      ...earlyList.map(r => ({
        type: 'EARLY' as const,
        dateStr: r.dateStr,
        dayNum: r.dayNum,
        dayName: r.dayName,
        weekLabel: r.weekLabel,
        weekNum: r.weekNum,
        shift: r.shift,
        shiftLabel: r.shiftLabel,
        punchTime: r.outTime,
        punchLabel: 'เวลาออก',
        quantityFormatted: `-${r.earlyHours} ชม. (ทำจริง ${r.effectiveWorkHours} ชม.)`,
        machine: r.machine,
        remark: r.remark
      }))
    ].sort((a, b) => a.dayNum - b.dayNum || (a.type === 'LATE' ? -1 : 1));

    return {
      empId: selectedEmpId,
      nameTH,
      nameEN,
      empType,
      areaKey,
      areaName,
      dept,
      position,
      totalLateCount,
      totalLateMinutes,
      totalEarlyCount,
      totalEarlyHours,
      timeline
    };
  }, [selectedEmpId, dataset, employeeMapping]);

  // Current Date's day number
  const currentDayNum = useMemo(() => {
    const clean = (currentScanDateFormatted || '').replace(/^[📅📄\s]*วันที่\s*/, '').trim();
    const parts = clean.split(/[/.-]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) return parseInt(parts[0], 10) || 1;
      if (parts[0].length === 4) return parseInt(parts[2], 10) || 1;
    }
    return 1;
  }, [currentScanDateFormatted]);

  // Filter Late & Early records based on Horizon (Daily, Weekly, Monthly)
  const filteredLateRecords = useMemo(() => {
    return dataset.allLateRecords.filter((r) => {
      if (horizon === 'DAILY') {
        const targetDay = selectedDay > 0 ? selectedDay : currentDayNum;
        if (r.dayNum !== targetDay) return false;
      } else if (horizon === 'WEEKLY') {
        if (selectedWeek > 0 && r.weekNum !== selectedWeek) return false;
      }
      return true;
    });
  }, [dataset.allLateRecords, horizon, selectedDay, currentDayNum, selectedWeek]);

  const filteredEarlyRecords = useMemo(() => {
    return dataset.allEarlyRecords.filter((r) => {
      if (horizon === 'DAILY') {
        const targetDay = selectedDay > 0 ? selectedDay : currentDayNum;
        if (r.dayNum !== targetDay) return false;
      } else if (horizon === 'WEEKLY') {
        if (selectedWeek > 0 && r.weekNum !== selectedWeek) return false;
      }
      return true;
    });
  }, [dataset.allEarlyRecords, horizon, selectedDay, currentDayNum, selectedWeek]);

  // Summary Metrics based on currently filtered scope
  const metrics = useMemo(() => {
    const lateCount = filteredLateRecords.length;
    const lateMinutes = filteredLateRecords.reduce((s, r) => s + r.lateMinutes, 0);
    const gyLate = filteredLateRecords.filter(r => r.empType === 'Goodyear').length;
    const contLate = filteredLateRecords.filter(r => r.empType === 'Contractor (WAS)').length;
    const uniqueLateEmp = new Set(filteredLateRecords.map(r => r.empId)).size;

    const earlyCount = filteredEarlyRecords.length;
    const earlyHours = Math.round(filteredEarlyRecords.reduce((s, r) => s + r.earlyHours, 0) * 10) / 10;
    const gyEarly = filteredEarlyRecords.filter(r => r.empType === 'Goodyear').length;
    const contEarly = filteredEarlyRecords.filter(r => r.empType === 'Contractor (WAS)').length;
    const uniqueEarlyEmp = new Set(filteredEarlyRecords.map(r => r.empId)).size;

    // All unique affected persons
    const totalAffectedEmp = new Set([
      ...filteredLateRecords.map(r => r.empId),
      ...filteredEarlyRecords.map(r => r.empId)
    ]).size;

    // Area breakdown for current filter
    const areaMap: Record<string, { late: number; early: number }> = {};
    ['BCA', 'CONSUMER', 'AERO', 'RETREAD', 'NON_HPT'].forEach(k => {
      areaMap[k] = { late: 0, early: 0 };
    });
    filteredLateRecords.forEach(r => {
      if (areaMap[r.areaKey]) areaMap[r.areaKey].late++;
    });
    filteredEarlyRecords.forEach(r => {
      if (areaMap[r.areaKey]) areaMap[r.areaKey].early++;
    });

    let topLateArea = '-';
    let maxAreaLate = -1;
    Object.entries(areaMap).forEach(([k, v]) => {
      if (v.late > maxAreaLate && v.late > 0) {
        maxAreaLate = v.late;
        topLateArea = k;
      }
    });

    return {
      lateCount,
      lateMinutes,
      gyLate,
      contLate,
      uniqueLateEmp,
      earlyCount,
      earlyHours,
      gyEarly,
      contEarly,
      uniqueEarlyEmp,
      totalAffectedEmp,
      topLateArea,
      areaMap
    };
  }, [filteredLateRecords, filteredEarlyRecords]);

  // Chart Data 1: Daily Trend (Days 1..30)
  const dailyTrendData = useMemo(() => {
    const map = new Map<number, { day: number; label: string; lateCount: number; earlyCount: number }>();
    dataset.availableDays.forEach(d => {
      map.set(d.day, {
        day: d.day,
        label: `${d.day} ก.ย.`,
        lateCount: 0,
        earlyCount: 0
      });
    });

    filteredLateRecords.forEach(r => {
      const entry = map.get(r.dayNum);
      if (entry) entry.lateCount++;
    });

    filteredEarlyRecords.forEach(r => {
      const entry = map.get(r.dayNum);
      if (entry) entry.earlyCount++;
    });

    return Array.from(map.values()).sort((a, b) => a.day - b.day);
  }, [dataset.availableDays, filteredLateRecords, filteredEarlyRecords]);

  // Chart Data 2: Area Distribution
  const areaChartData = useMemo(() => {
    const areaMeta: Record<string, { label: string; color: string }> = {
      BCA: { label: 'BCA (Banbury/Ext)', color: '#3B82F6' },
      CONSUMER: { label: 'Consumer (Radial)', color: '#10B981' },
      AERO: { label: 'Aviation / Aero', color: '#8B5CF6' },
      RETREAD: { label: 'Retread (หล่อดอก)', color: '#F59E0B' },
      NON_HPT: { label: 'Non-HPT / Support', color: '#64748B' }
    };

    return Object.entries(areaMeta).map(([k, meta]) => {
      const late = filteredLateRecords.filter(r => r.areaKey === k).length;
      const early = filteredEarlyRecords.filter(r => r.areaKey === k).length;
      return {
        areaKey: k,
        name: meta.label,
        'มาสาย (ครั้ง)': late,
        'กลับก่อน (ครั้ง)': early,
        total: late + early
      };
    });
  }, [filteredLateRecords, filteredEarlyRecords]);

  // Chart Data 3: Shift Distribution Pie
  const shiftChartData = useMemo(() => {
    const shiftNames = ['กะ 1 (07:00-15:00)', 'กะ 2 (15:00-23:00)', 'กะ 3 (23:00-07:00)'];
    const colors = ['#0284C7', '#F59E0B', '#6366F1'];
    return [1, 2, 3].map((s, idx) => {
      const late = filteredLateRecords.filter(r => r.shift === s).length;
      const early = filteredEarlyRecords.filter(r => r.shift === s).length;
      return {
        shift: s,
        name: shiftNames[idx],
        value: late + early,
        late,
        early,
        color: colors[idx]
      };
    });
  }, [filteredLateRecords, filteredEarlyRecords]);

  // Dynamic Ranked Lists for Late and Early (Filtered to >= 2 times)
  const allRankedLate = useMemo(() => {
    const map = new Map<string, TopViolatorItem>();
    filteredLateRecords.forEach(r => {
      if (!map.has(r.empId)) {
        map.set(r.empId, {
          empId: r.empId,
          nameTH: r.nameTH,
          nameEN: r.nameEN,
          empType: r.empType,
          areaKey: r.areaKey,
          areaName: r.areaName,
          dept: r.dept,
          position: r.position,
          count: 0,
          totalQuantity: 0,
          formattedQuantity: '',
          dates: []
        });
      }
      const entry = map.get(r.empId)!;
      entry.count++;
      entry.totalQuantity += r.lateMinutes;
      if (!entry.dates.includes(r.dateStr)) {
        entry.dates.push(r.dateStr);
      }
    });

    return Array.from(map.values())
      .map(e => ({
        ...e,
        formattedQuantity: `${e.totalQuantity} นาที`
      }))
      .sort((a, b) => b.count - a.count || b.totalQuantity - a.totalQuantity);
  }, [filteredLateRecords]);

  // Show only employees with 2 or more late incidents
  const displayedLateList = useMemo(() => {
    return allRankedLate.filter(e => e.count >= 2);
  }, [allRankedLate]);

  const allRankedEarly = useMemo(() => {
    const map = new Map<string, TopViolatorItem>();
    filteredEarlyRecords.forEach(r => {
      if (!map.has(r.empId)) {
        map.set(r.empId, {
          empId: r.empId,
          nameTH: r.nameTH,
          nameEN: r.nameEN,
          empType: r.empType,
          areaKey: r.areaKey,
          areaName: r.areaName,
          dept: r.dept,
          position: r.position,
          count: 0,
          totalQuantity: 0,
          formattedQuantity: '',
          dates: []
        });
      }
      const entry = map.get(r.empId)!;
      entry.count++;
      entry.totalQuantity = Math.round((entry.totalQuantity + r.earlyHours) * 10) / 10;
      if (!entry.dates.includes(r.dateStr)) {
        entry.dates.push(r.dateStr);
      }
    });

    return Array.from(map.values())
      .map(e => ({
        ...e,
        formattedQuantity: `${e.totalQuantity} ชม.`
      }))
      .sort((a, b) => b.count - a.count || b.totalQuantity - a.totalQuantity);
  }, [filteredEarlyRecords]);

  // Show only employees with 2 or more early leave incidents
  const displayedEarlyList = useMemo(() => {
    return allRankedEarly.filter(e => e.count >= 2);
  }, [allRankedEarly]);

  // Handle Excel Export
  const handleExportExcel = () => {
    const selectedDateStr = horizon === 'DAILY'
      ? `${String(selectedDay > 0 ? selectedDay : currentDayNum).padStart(2, '0')}/09/2026`
      : 'September_2026';
    exportLateEarlyExcel(dataset, horizon, selectedDateStr, selectedWeek);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Top Banner & Horizon Switcher */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mb-20"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Attendance & Punctuality Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>แดชบอร์ดสรุป คนมาสาย & ลากลับก่อน</span>
              <span className="text-xs sm:text-sm font-semibold px-3 py-1 rounded-xl bg-indigo-600/80 text-indigo-100 border border-indigo-400/30">
                หน้า 6
              </span>
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              รายงานสรุปสถิติและรายชื่อพนักงานที่สแกนเข้าสายเกินเวลาผ่อนผัน (Grace Period 7 นาที) หรือสแกนออกก่อนหมดกะทำงาน <span className="text-amber-300 font-medium">*นับเฉพาะพนักงานที่ทำงานกะเดียวปกติ (ไม่นับคนที่อยู่ต่อ OT / กรณีโทรตามมาทำงาน)</span>
            </p>
          </div>

          {/* Export & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/30"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก Excel ครบ 6 Sheet</span>
            </button>
          </div>
        </div>

        {/* Horizon Bar: Daily / Weekly / Monthly */}
        <div className="relative z-10 mt-6 pt-6 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-800/90 rounded-2xl border border-slate-700">
            <button
              onClick={() => setHorizon('DAILY')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                horizon === 'DAILY'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>รายวัน (Daily)</span>
            </button>
            <button
              onClick={() => setHorizon('WEEKLY')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                horizon === 'WEEKLY'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>รายสัปดาห์ (Weekly W1-W5)</span>
            </button>
            <button
              onClick={() => setHorizon('MONTHLY')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                horizon === 'MONTHLY'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>รายเดือน (Monthly MTD)</span>
            </button>
          </div>

          {/* Sub-selectors depending on Horizon */}
          {horizon === 'DAILY' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 font-medium">เลือกวันที่:</span>
              <select
                value={selectedDay > 0 ? selectedDay : currentDayNum}
                onChange={(e) => {
                  const day = parseInt(e.target.value, 10);
                  setSelectedDay(day);
                  const found = dataset.availableDays.find(d => d.day === day);
                  if (found && onSelectDate) {
                    onSelectDate(found.dateStr);
                  }
                }}
                className="bg-slate-800 text-white text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {dataset.availableDays.map((d) => (
                  <option key={d.day} value={d.day}>
                    {d.dayName} {d.dateStr} (สาย: {d.lateCount}, กลับก่อน: {d.earlyCount})
                  </option>
                ))}
              </select>
            </div>
          )}

          {horizon === 'WEEKLY' && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs text-slate-300 font-medium mr-1">เลือกสัปดาห์:</span>
              <button
                onClick={() => setSelectedWeek(0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedWeek === 0
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ทุกสัปดาห์ (All Weeks)
              </button>
              {dataset.weeklySummaries.map((w) => (
                <button
                  key={w.weekNum}
                  onClick={() => setSelectedWeek(w.weekNum)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedWeek === w.weekNum
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  W{w.weekNum} ({w.dateRange.replace(' ก.ย. 2026', '')})
                </button>
              ))}
            </div>
          )}

          {horizon === 'MONTHLY' && (
            <div className="text-xs text-indigo-200 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>รวบรวมข้อมูลสะสมทั้งเดือนกันยายน 2026 (1 - 30 ก.ย.)</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Stat Cards (5 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Late Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">มาสายรวม (Late)</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-600">{metrics.lateCount}</span>
              <span className="text-xs font-bold text-slate-500">ครั้ง</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2 font-medium">
              <span>GY: <strong className="text-slate-800">{metrics.gyLate}</strong></span>
              <span>WAS: <strong className="text-slate-800">{metrics.contLate}</strong></span>
            </div>
          </div>
        </div>

        {/* 2. Late Minutes Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">เวลารวมที่สาย</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-600">{metrics.lateMinutes}</span>
              <span className="text-xs font-bold text-slate-500">นาที</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2 font-medium">
              <span>เฉลี่ย: <strong className="text-slate-800">{metrics.lateCount > 0 ? Math.round(metrics.lateMinutes / metrics.lateCount) : 0} นาที/ครั้ง</strong></span>
            </div>
          </div>
        </div>

        {/* 3. Early Leave Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">กลับก่อนรวม (Early)</span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <LogOut className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-orange-600">{metrics.earlyCount}</span>
              <span className="text-xs font-bold text-slate-500">ครั้ง</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2 font-medium">
              <span>GY: <strong className="text-slate-800">{metrics.gyEarly}</strong></span>
              <span>WAS: <strong className="text-slate-800">{metrics.contEarly}</strong></span>
            </div>
          </div>
        </div>

        {/* 4. Early Leave Hours Lost */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ชั่วโมงที่ขาดไป</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-purple-600">{metrics.earlyHours}</span>
              <span className="text-xs font-bold text-slate-500">ชม.</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2 font-medium">
              <span>จำนวนคน: <strong className="text-slate-800">{metrics.uniqueEarlyEmp} คน</strong></span>
            </div>
          </div>
        </div>

        {/* 5. Total Unique Persons Affected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">พนักงานที่มีประวัติ</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-600">{metrics.totalAffectedEmp}</span>
              <span className="text-xs font-bold text-slate-500">คน</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-2 font-medium">
              <span>สาย: <strong className="text-rose-600">{metrics.uniqueLateEmp}</strong></span>
              <span>กลับก่อน: <strong className="text-orange-600">{metrics.uniqueEarlyEmp}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>แนวโน้มการมาสาย & กลับก่อน (Daily Trend)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">จำนวนครั้งที่เกิดเหตุการณ์ในแต่ละวันตลอดเดือนกันยายน</p>
            </div>
          </div>
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  labelFormatter={(label) => `วันที่ ${label} กันยายน 2026`}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="lateCount" name="มาสาย (ครั้ง)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="earlyCount" name="กลับก่อน (ครั้ง)" fill="#F97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shift Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>สัดส่วนแยกตามกะทำงาน (Shift Breakdown)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">กะ 1 (เช้า), กะ 2 (บ่าย), กะ 3 (ดึก)</p>
          </div>
          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={shiftChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {shiftChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            {shiftChartData.map((s) => (
              <div key={s.shift} className="p-2 rounded-xl bg-slate-50">
                <div className="text-[11px] font-bold text-slate-600">กะ {s.shift}</div>
                <div className="text-sm font-black text-slate-800">{s.value} <span className="text-[10px] font-normal text-slate-500">ครั้ง</span></div>
                <div className="text-[10px] text-slate-500">สาย {s.late} / ก่อน {s.early}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full Repeat Violators Lists (สาย >= 2 ครั้งขึ้นไป & กลับก่อน >= 2 ครั้งขึ้นไป) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Late Violators (>= 2 times) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-600" />
                <span>รายชื่อพนักงานมาสาย (สาย ≥ 2 ครั้ง)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">แสดงเฉพาะพนักงานที่มาสายตั้งแต่ 2 ครั้งขึ้นไป (กะเดียว ไม่รวม OT)</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200/60 rounded-xl">
              พบ {displayedLateList.length} คน
            </span>
          </div>

          <div className="mb-4 text-[11px] text-indigo-700 bg-indigo-50/70 border border-indigo-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>💡 <strong>คลิกที่แถวหรือชื่อพนักงาน</strong> เพื่อเปิดดูรายละเอียดวันที่และเวลาที่มาสาย</span>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold text-center w-10">#</th>
                  <th className="py-2.5 px-3 font-bold">รหัส / ชื่อพนักงาน</th>
                  <th className="py-2.5 px-3 font-bold">พื้นที่ / แผนก</th>
                  <th className="py-2.5 px-3 font-bold text-center">ประเภท</th>
                  <th className="py-2.5 px-3 font-bold text-right">จำนวนครั้ง</th>
                  <th className="py-2.5 px-3 font-bold text-right">เวลารวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedLateList.map((r, idx) => (
                  <tr
                    key={r.empId}
                    onClick={() => setSelectedEmpId(r.empId)}
                    className="hover:bg-rose-50/80 cursor-pointer transition-colors group"
                    title="คลิกเพื่อดูประวัติวันที่มาสาย"
                  >
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800 group-hover:text-rose-700 flex items-center gap-1.5 transition-colors">
                        <span>{r.nameTH}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">{r.empId} ({r.nameEN})</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-700">{r.areaKey}</span>
                      <div className="text-[10px] text-slate-400">{r.dept}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        r.empType === 'Goodyear' ? 'bg-blue-50 text-blue-700' : 'bg-teal-50 text-teal-700'
                      }`}>
                        {r.empType === 'Goodyear' ? 'GY' : 'WAS'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-rose-600 text-sm">
                      {r.count} <span className="text-[10px] font-normal text-slate-500">ครั้ง</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                      {r.formattedQuantity}
                    </td>
                  </tr>
                ))}
                {displayedLateList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      ไม่มีพนักงานที่มาสายตั้งแต่ 2 ครั้งขึ้นไปในช่วงเวลานี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Early Leave Violators (>= 2 times) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-orange-600" />
                <span>รายชื่อพนักงานกลับก่อน (กลับก่อน ≥ 2 ครั้ง)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">แสดงเฉพาะพนักงานที่สแกนออกก่อนหมดกะตั้งแต่ 2 ครั้งขึ้นไป</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-orange-50 text-orange-700 border border-orange-200/60 rounded-xl">
              พบ {displayedEarlyList.length} คน
            </span>
          </div>

          <div className="mb-4 text-[11px] text-indigo-700 bg-indigo-50/70 border border-indigo-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>💡 <strong>คลิกที่แถวหรือชื่อพนักงาน</strong> เพื่อเปิดดูรายละเอียดวันที่และเวลาที่กลับก่อน</span>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold text-center w-10">#</th>
                  <th className="py-2.5 px-3 font-bold">รหัส / ชื่อพนักงาน</th>
                  <th className="py-2.5 px-3 font-bold">พื้นที่ / แผนก</th>
                  <th className="py-2.5 px-3 font-bold text-center">ประเภท</th>
                  <th className="py-2.5 px-3 font-bold text-right">จำนวนครั้ง</th>
                  <th className="py-2.5 px-3 font-bold text-right">ชั่วโมงรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedEarlyList.map((r, idx) => (
                  <tr
                    key={r.empId}
                    onClick={() => setSelectedEmpId(r.empId)}
                    className="hover:bg-orange-50/80 cursor-pointer transition-colors group"
                    title="คลิกเพื่อดูประวัติวันที่กลับก่อน"
                  >
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-800 group-hover:text-orange-700 flex items-center gap-1.5 transition-colors">
                        <span>{r.nameTH}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">{r.empId} ({r.nameEN})</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-700">{r.areaKey}</span>
                      <div className="text-[10px] text-slate-400">{r.dept}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        r.empType === 'Goodyear' ? 'bg-blue-50 text-blue-700' : 'bg-teal-50 text-teal-700'
                      }`}>
                        {r.empType === 'Goodyear' ? 'GY' : 'WAS'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-orange-600 text-sm">
                      {r.count} <span className="text-[10px] font-normal text-slate-500">ครั้ง</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                      {r.formattedQuantity}
                    </td>
                  </tr>
                ))}
                {displayedEarlyList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      ไม่มีพนักงานที่กลับก่อนตั้งแต่ 2 ครั้งขึ้นไปในช่วงเวลานี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Employee Incident History Modal */}
      {selectedEmpData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedEmpData.empType === 'Goodyear' ? 'bg-blue-500/30 text-blue-200 border border-blue-400/40' : 'bg-teal-500/30 text-teal-200 border border-teal-400/40'
                  }`}>
                    {selectedEmpData.empType}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
                    {selectedEmpData.areaKey}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>{selectedEmpData.nameTH}</span>
                  <span className="text-sm font-normal text-slate-300">({selectedEmpData.nameEN})</span>
                </h3>
                <div className="text-xs text-slate-300 flex flex-wrap items-center gap-3">
                  <span>รหัส: <strong className="text-white font-mono">{selectedEmpData.empId}</strong></span>
                  <span>•</span>
                  <span>แผนก: <strong className="text-white">{selectedEmpData.dept}</strong></span>
                  <span>•</span>
                  <span>ตำแหน่ง: <strong className="text-white">{selectedEmpData.position}</strong></span>
                </div>
              </div>

              <button
                onClick={() => setSelectedEmpId(null)}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Stat Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200 text-xs">
              <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                <div className="text-slate-500 font-medium">มาสายทั้งหมด</div>
                <div className="text-lg font-black text-rose-600 mt-0.5">
                  {selectedEmpData.totalLateCount} <span className="text-xs font-normal text-slate-500">ครั้ง</span>
                </div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                <div className="text-slate-500 font-medium">เวลารวมที่สาย</div>
                <div className="text-lg font-black text-amber-600 mt-0.5">
                  {selectedEmpData.totalLateMinutes} <span className="text-xs font-normal text-slate-500">นาที</span>
                </div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                <div className="text-slate-500 font-medium">กลับก่อนทั้งหมด</div>
                <div className="text-lg font-black text-orange-600 mt-0.5">
                  {selectedEmpData.totalEarlyCount} <span className="text-xs font-normal text-slate-500">ครั้ง</span>
                </div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                <div className="text-slate-500 font-medium">ชั่วโมงที่ขาดไป</div>
                <div className="text-lg font-black text-purple-600 mt-0.5">
                  {selectedEmpData.totalEarlyHours} <span className="text-xs font-normal text-slate-500">ชม.</span>
                </div>
              </div>
            </div>

            {/* Timeline Table */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-600" />
                  <span>บันทึกประวัติรายวัน (Incident Timeline - {selectedEmpData.timeline.length} รายการ)</span>
                </h4>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-bold text-center w-10">#</th>
                      <th className="py-2.5 px-3 font-bold">วันที่ / วันในสัปดาห์</th>
                      <th className="py-2.5 px-3 font-bold">สัปดาห์</th>
                      <th className="py-2.5 px-3 font-bold text-center">กะ</th>
                      <th className="py-2.5 px-3 font-bold">ประเภท</th>
                      <th className="py-2.5 px-3 font-bold text-center">เวลาสแกน</th>
                      <th className="py-2.5 px-3 font-bold text-right">ผลกระทบ</th>
                      <th className="py-2.5 px-3 font-bold">เครื่องจักร / หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEmpData.timeline.map((item, idx) => (
                      <tr key={idx} className={item.type === 'LATE' ? 'hover:bg-rose-50/40' : 'hover:bg-orange-50/40'}>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-800">{item.dateStr}</div>
                          <div className="text-[10px] text-slate-500">{item.dayName}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                            W{item.weekNum}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[10px]">
                            กะ {item.shift}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.type === 'LATE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                              <AlertTriangle className="w-3 h-3" />
                              <span>มาสาย</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold text-[10px]">
                              <LogOut className="w-3 h-3" />
                              <span>กลับก่อน</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                          <div>{item.punchTime}</div>
                          <div className="text-[9px] text-slate-400 font-normal">({item.punchLabel})</div>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-black text-xs ${
                          item.type === 'LATE' ? 'text-rose-600' : 'text-orange-600'
                        }`}>
                          {item.quantityFormatted}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-700 font-medium">{item.machine || '-'}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{item.remark || '-'}</div>
                        </td>
                      </tr>
                    ))}
                    {selectedEmpData.timeline.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          ไม่พบประวัติเหตุการณ์ของพนักงานท่านนี้
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedEmpId(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
