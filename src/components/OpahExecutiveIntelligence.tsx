import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart
} from 'recharts';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Layers,
  Lightbulb,
  Clock,
  Flame,
  Weight,
  Save,
  Download,
  History,
  Sparkles,
  ChevronRight,
  Car,
  Plane,
  Building2,
  Factory,
  Package,
  RefreshCw,
  SlidersHorizontal,
  ArrowRight,
  Calendar,
  ShieldCheck,
  Users
} from 'lucide-react';
import { OhpaSummary, StockingTonnageReport, DailyMtdItem, OhpaAreaMetrics } from '../types/ohpa';
import { RetreadTonnageData } from '../data/default_retread_tonnage';
import { PdiBeadReport } from '../data/default_pdi_bead';
import { RtrShutdownEntry } from '../data/default_rtr_shutdown';

export interface MonthlyHistoricalSnapshot {
  id: string; // e.g. "2026-09"
  monthName: string; // e.g. "กันยายน 2026 (Sep 2026)"
  daysCount: number;
  totalNetHours: number;
  normalHours: number;
  otHours: number;
  otPercentage: number;
  stockingKg: number;
  stockingLbs: number;
  mtdOpahLbsPerHour: number;
  targetOpah: number;
  targetMet: boolean;
  variancePct: number;
  savedAt: string;
  notes?: string;
}

interface OpahExecutiveIntelligenceProps {
  ohpaSummary: OhpaSummary;
  currentScanDateFormatted: string;
  viewMode: 'DAILY' | 'MTD';
  onSelectDate?: (dateFormatted: string) => void;
  retreadTonnage?: RetreadTonnageData;
  pdiBeadReport?: PdiBeadReport;
  rtrShutdownData?: Record<string, RtrShutdownEntry>;
}

export const OpahExecutiveIntelligence: React.FC<OpahExecutiveIntelligenceProps> = ({
  ohpaSummary,
  currentScanDateFormatted,
  viewMode,
  onSelectDate,
  retreadTonnage,
  pdiBeadReport,
  rtrShutdownData
}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DEPARTMENTS' | 'TRENDS' | 'HISTORY'>('OVERVIEW');
  const [selectedDeptKey, setSelectedDeptKey] = useState<string>('Consumer');

  // Baseline target definition
  const PLANT_TARGET = 36.0;
  const DEPT_TARGETS: Record<string, number> = {
    'Plant': 36.0,
    'Consumer': 88.0,
    'Total Aviation': 30.0,
    'Bias Aero': 30.0,
    'Radial Aero': 30.0,
    'BCA': 104.0,
    'Retread': 9.0
  };

  // Metrics extraction
  const currentDailyOpah = ohpaSummary.overallOpahLbsPerHour || 0;
  const currentDailyHours = ohpaSummary.opahWorkingHours || 0;
  const currentDailyLbs = ohpaSummary.totalTonnageLbs || 0;
  const currentDailyKg = ohpaSummary.totalTonnageKg || 0;
  const currentDailyOtHours = ohpaSummary.totalOtHours || 0;
  const currentDailyNormalHours = ohpaSummary.totalNormalHours || 0;
  const currentDailyOtPct = currentDailyHours > 0 ? Math.round((currentDailyOtHours / (currentDailyNormalHours + currentDailyOtHours)) * 1000) / 10 : 0;

  const mtdDays = ohpaSummary.mtd?.daysCount || 1;
  const mtdOpah = ohpaSummary.mtd?.mtdOpahLbsPerHour || currentDailyOpah;
  const mtdHours = ohpaSummary.mtd?.mtdOpahWorkingHours || currentDailyHours;
  const mtdLbs = ohpaSummary.mtd?.mtdStockingLbs || currentDailyLbs;
  const mtdKg = ohpaSummary.mtd?.mtdStockingKg || currentDailyKg;

  // Active view evaluation
  const activeOpah = viewMode === 'MTD' ? mtdOpah : currentDailyOpah;
  const activeHours = viewMode === 'MTD' ? mtdHours : currentDailyHours;
  const activeLbs = viewMode === 'MTD' ? mtdLbs : currentDailyLbs;
  const activeKg = viewMode === 'MTD' ? mtdKg : currentDailyKg;

  // Target Gap & Sensitivity Math
  const gapLbsPerHour = Math.round((activeOpah - PLANT_TARGET) * 100) / 100;
  const gapPct = PLANT_TARGET > 0 ? Math.round(((activeOpah - PLANT_TARGET) / PLANT_TARGET) * 1000) / 10 : 0;
  const isTargetMet = activeOpah >= PLANT_TARGET;

  // Production deficit (how many lbs/kg needed to reach target at current hours)
  const requiredTotalLbsForTarget = Math.round(PLANT_TARGET * activeHours);
  const lbsDeficit = Math.max(0, requiredTotalLbsForTarget - activeLbs);
  const kgDeficit = Math.round(lbsDeficit / 2.20462);

  // Hours excess (how many net hours must be cut if stocking stays constant)
  const allowedHoursForCurrentLbs = activeLbs > 0 && PLANT_TARGET > 0 ? Math.round((activeLbs / PLANT_TARGET) * 10) / 10 : 0;
  const hoursExcess = Math.max(0, Math.round((activeHours - allowedHoursForCurrentLbs) * 10) / 10);

  // Overtime sensitivity simulation
  const simulatedOpahMinus50Ot = useMemo(() => {
    const reducedHours = Math.max(1, activeHours - (currentDailyOtHours * 0.5));
    return Math.round((activeLbs / reducedHours) * 100) / 100;
  }, [activeHours, currentDailyOtHours, activeLbs]);

  const simulatedOpahZeroOt = useMemo(() => {
    const reducedHours = Math.max(1, activeHours - currentDailyOtHours);
    return Math.round((activeLbs / reducedHours) * 100) / 100;
  }, [activeHours, currentDailyOtHours, activeLbs]);

  // Historical Daily Trend Data preparation for Recharts
  const chartData = useMemo(() => {
    if (!ohpaSummary.mtd?.dailyItems) return [];
    return ohpaSummary.mtd.dailyItems.map(item => ({
      day: item.day,
      dateLabel: `${item.day}/09`,
      dayName: item.dayName,
      hours: item.opahWorkingHours,
      normalHours: Math.round((item.totalHours - (item.pdiDeductHours || 0)) * 0.85),
      otHours: Math.round((item.totalHours - (item.pdiDeductHours || 0)) * 0.15),
      opah: item.dailyOpahLbsPerHour || 0,
      stockingLbs: item.stockingLbs || 0,
      stockingKg: item.stockingKg || 0,
      target: PLANT_TARGET
    }));
  }, [ohpaSummary.mtd?.dailyItems]);

  // Find Best and Lowest Days in the month
  const { bestDay, worstDay, avg7DayOpah, otTrendStatus } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { bestDay: null, worstDay: null, avg7DayOpah: 0, otTrendStatus: 'STABLE' };
    }
    const validDays = chartData.filter(d => d.opah > 0);
    if (validDays.length === 0) return { bestDay: null, worstDay: null, avg7DayOpah: 0, otTrendStatus: 'STABLE' };

    const sortedByOpah = [...validDays].sort((a, b) => b.opah - a.opah);
    const best = sortedByOpah[0];
    const worst = sortedByOpah[sortedByOpah.length - 1];

    // 7-day rolling average of last 7 entries
    const last7 = validDays.slice(-7);
    const avg7 = last7.reduce((sum, d) => sum + d.opah, 0) / (last7.length || 1);

    return {
      bestDay: best,
      worstDay: worst,
      avg7DayOpah: Math.round(avg7 * 100) / 100,
      otTrendStatus: currentDailyOtPct > 15 ? 'HIGH' : currentDailyOtPct > 10 ? 'MODERATE' : 'HEALTHY'
    };
  }, [chartData, currentDailyOtPct]);

  // ===== MULTI-MONTH HISTORICAL ARCHIVE PERSISTENCE =====
  const STORAGE_KEY = 'ohpa_monthly_historical_snapshots';

  const [snapshots, setSnapshots] = useState<MonthlyHistoricalSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved historical snapshots:', e);
    }
    // Default baseline initial snapshot for September 2026
    return [
      {
        id: '2026-09',
        monthName: 'กันยายน 2026 (Sep 2026)',
        daysCount: mtdDays,
        totalNetHours: mtdHours,
        normalHours: Math.round(mtdHours * 0.86),
        otHours: Math.round(mtdHours * 0.14),
        otPercentage: 14.0,
        stockingKg: mtdKg,
        stockingLbs: mtdLbs,
        mtdOpahLbsPerHour: mtdOpah,
        targetOpah: PLANT_TARGET,
        targetMet: mtdOpah >= PLANT_TARGET,
        variancePct: Math.round(((mtdOpah - PLANT_TARGET) / PLANT_TARGET) * 1000) / 10,
        savedAt: new Date().toISOString(),
        notes: 'บันทึกประวัติฐานข้อมูลเดือนกันยายน 2026 (เริ่มระบบระบบคำนวณ OPAH 5 เสาหลัก)'
      }
    ];
  });

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleSaveCurrentSnapshot = () => {
    const newSnapshot: MonthlyHistoricalSnapshot = {
      id: '2026-09',
      monthName: 'กันยายน 2026 (Sep 2026)',
      daysCount: mtdDays,
      totalNetHours: mtdHours,
      normalHours: Math.round(mtdHours * 0.86),
      otHours: Math.round(mtdHours * 0.14),
      otPercentage: currentDailyOtPct,
      stockingKg: mtdKg,
      stockingLbs: mtdLbs,
      mtdOpahLbsPerHour: mtdOpah,
      targetOpah: PLANT_TARGET,
      targetMet: mtdOpah >= PLANT_TARGET,
      variancePct: Math.round(((mtdOpah - PLANT_TARGET) / PLANT_TARGET) * 1000) / 10,
      savedAt: new Date().toISOString(),
      notes: `อัปเดตข้อมูลสะสมถึงวันที่ ${currentScanDateFormatted || '29/09/2026'} (${mtdDays} วันทำงาน)`
    };

    setSnapshots(prev => {
      const filtered = prev.filter(s => s.id !== newSnapshot.id);
      const updated = [newSnapshot, ...filtered];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    setSaveSuccessMsg(`บันทึก Snapshot ประจำเดือน ${newSnapshot.monthName} เรียบร้อยแล้ว!`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleExportHistoryExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows = snapshots.map(s => ({
      'รหัสเดือน': s.id,
      'ชื่อเดือน': s.monthName,
      'จำนวนวันทำงาน': s.daysCount,
      'ชั่วโมงสุทธิ (ชม.)': s.totalNetHours,
      'ชั่วโมง OT (ชม.)': s.otHours,
      'อัตรา OT (%)': `${s.otPercentage}%`,
      'ยอด Stocking (kg)': s.stockingKg,
      'ยอด Stocking (lbs)': s.stockingLbs,
      'ค่า OPAH (lbs/ชม.)': s.mtdOpahLbsPerHour,
      'เป้าหมาย (Target)': s.targetOpah,
      'สถานะ': s.targetMet ? 'ผ่านเป้าหมาย (HIT)' : 'ไม่ถึงเป้าหมาย (GAP)',
      'ส่วนต่าง (%)': `${s.variancePct > 0 ? '+' : ''}${s.variancePct}%`,
      'วันที่บันทึก': s.savedAt,
      'หมายเหตุ': s.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'OPAH_Monthly_History');
    XLSX.writeFile(wb, `OPAH_Monthly_Historical_Snapshots_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-6 animate-fadeIn">
      {/* 1. Header & Navigation Pills */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl shadow-sm">
              <Target className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              ศูนย์วิเคราะห์ผลการดำเนินงาน OPAH สู่เป้าหมาย & กลยุทธ์การปรับปรุง
            </h3>
            <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-200 shadow-2xs">
              🎯 Target: {PLANT_TARGET.toFixed(2)} lbs/ชม.
            </span>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200/60">
              <Sparkles className="w-3 h-3 inline mr-1 text-indigo-500" />
              Executive Intelligence Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            บทวิเคราะห์ผลลัพธ์รายวันและรายเดือน (MTD): ตรวจสอบ Gap สู่เป้าหมาย, วิเคราะห์ชั่วโมงทำงาน, แนวทางแก้ปัญหาในวันที่ไม่ถึงเป้า, เจาะลึก 5 แผนก, และคลังข้อมูลประวัติเพื่อการเติบโตในอนาคต
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'OVERVIEW'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            สรุปภาพรวม & Gap
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DEPARTMENTS')}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'DEPARTMENTS'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Factory className="w-3.5 h-3.5" />
            แยก 5 แผนกหลัก
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TRENDS')}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'TRENDS'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            เทรนด์ชั่วโมงทำงาน
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            ประวัติสะสมรายเดือน
          </button>
        </div>
      </div>

      {/* Save Success Alert Notification */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <span className="text-[10px] text-emerald-600">บันทึกลง Local Storage สำเร็จ</span>
        </div>
      )}

      {/* ================= TAB 1: OVERVIEW & TARGET GAP INTELLIGENCE ================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Target KPI Scorecards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Actual vs Target KPI */}
            <div className={`p-5 rounded-3xl border transition-all ${
              isTargetMet
                ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-50/40 to-white border-emerald-300 shadow-emerald-500/5'
                : 'bg-gradient-to-br from-rose-500/10 via-rose-50/40 to-white border-rose-300 shadow-rose-500/5'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {viewMode === 'MTD' ? 'MTD OPAH' : 'Daily OPAH'} vs Target
                </span>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                  isTargetMet
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-rose-600 text-white shadow-2xs'
                }`}>
                  {isTargetMet ? '✓ บรรลุเป้าหมาย' : '✗ ต่ำกว่าเป้าหมาย'}
                </span>
              </div>

              <div className="mt-2.5 flex items-baseline gap-2">
                <span className={`text-3xl sm:text-4xl font-black tracking-tight ${
                  isTargetMet ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {activeOpah.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-slate-500">lbs / ชม.</span>
                <span className="text-xs text-slate-400 font-mono">
                  (เป้า: {PLANT_TARGET.toFixed(1)})
                </span>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">ส่วนต่างจากเป้าหมาย (Variance):</span>
                <strong className={`font-mono font-black ${isTargetMet ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {gapLbsPerHour > 0 ? `+${gapLbsPerHour}` : gapLbsPerHour} lbs/h ({gapPct > 0 ? `+${gapPct}%` : `${gapPct}%`})
                </strong>
              </div>
            </div>

            {/* Card 2: Production Deficit or Surplus */}
            <div className="p-5 rounded-3xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {isTargetMet ? 'ยอดผลิตส่วนเกิน (Surplus Cushion)' : 'ยอดผลิตที่ยังขาด (Volume Deficit)'}
                  </span>
                  <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                    <Weight className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                    {isTargetMet ? '+' : '-'}{Math.abs(lbsDeficit > 0 ? lbsDeficit : (activeLbs - requiredTotalLbsForTarget)).toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-slate-500 ml-1.5">lbs</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  เทียบเท่ากับ <strong className="text-slate-800">{Math.abs(kgDeficit > 0 ? kgDeficit : Math.round((activeLbs - requiredTotalLbsForTarget) / 2.20462)).toLocaleString()} kg</strong>
                  {isTargetMet ? ' ผลิตได้เกินเกณฑ์ที่กำหนด' : ' ที่ต้องผลิตเพิ่มด้วยชั่วโมงทำงานปัจจุบัน'}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/70 text-[11px] text-slate-600">
                ยอด Stocking จริง: <strong className="text-slate-900">{activeLbs.toLocaleString()} lbs</strong> ({activeKg.toLocaleString()} kg)
              </div>
            </div>

            {/* Card 3: Hours Sensitivity & Overtime Impact */}
            <div className="p-5 rounded-3xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    ชั่วโมงทำงาน & สัดส่วน OT
                  </span>
                  <span className={`p-1.5 rounded-lg ${
                    otTrendStatus === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                    {activeHours.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-slate-500">ชม. สุทธิ</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  ชั่วโมง OT: <strong className="text-amber-700">{currentDailyOtHours.toLocaleString()} ชม.</strong> ({currentDailyOtPct}%)
                  {currentDailyOtPct > 15 ? ' ⚠️ สัดส่วน OT สูงเกินเกณฑ์ 15%' : ' ✓ อยู่ในเกณฑ์เหมาะสม'}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/70 text-[11px] flex justify-between items-center text-slate-600">
                <span>หากลด OT ลง 50%:</span>
                <strong className="text-indigo-700 font-mono">OPAH ➔ {simulatedOpahMinus50Ot.toFixed(2)} lbs/h</strong>
              </div>
            </div>
          </div>

          {/* Root Cause Analysis & Strategic Action Plan */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-amber-400 text-slate-950 rounded-xl shadow-xs">
                  <Lightbulb className="w-5 h-5 font-black" />
                </span>
                <div>
                  <h4 className="text-base font-black tracking-tight text-white">
                    บทวิเคราะห์สาเหตุและแผนกลยุทธ์การปรับปรุงสู่เป้าหมาย (Action Plan for Target Achievement)
                  </h4>
                  <p className="text-xs text-slate-300">
                    ข้อเสนอแนะเชิงปฏิบัติการเพื่อปิด Gap ในวันที่ผลการดำเนินงานต่ำกว่า 36.0 lbs/ชม. และรักษาเสถียรภาพการผลิต
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {/* Action Pillar 1: Overtime Control */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Flame className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-black uppercase">1. การควบคุม Overtime</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    ควบคุมสัดส่วน OT ให้อยู่ต่ำกว่า <strong>12-15%</strong> จำกัดการเปิด OT เฉพาะเครื่องจักรหลักที่มี Tonnage Output ชัดเจน (Core Machines) และตัดชั่วโมง OT ในสายสนับสนุนที่ไม่จำเป็น
                  </p>
                  <div className="text-[11px] text-amber-200 font-semibold bg-amber-400/10 p-2 rounded-lg border border-amber-400/20">
                    💡 Impact: หากตัด OT ลง 100 ชม. จะเพิ่ม OPAH ได้เฉลี่ย <strong>+1.2 ถึง +1.8 lbs/ชม.</strong>
                  </div>
                </div>

                {/* Action Pillar 2: Stocking Throughput */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-2">
                  <div className="flex items-center gap-2 text-teal-300">
                    <Package className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-black uppercase">2. เร่งรอบ Stocking คลัง</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    ตรวจสอบยางสำเร็จรูปที่ผ่านการ Curing และ Final Finish แล้วแต่ยังค้างตรวจ QA หรือรอรับเข้าคลังสินค้า ประสานงานกับคลังให้สแกนรับเข้า SAP 55012 ทันรอบตัดประจำวัน
                  </p>
                  <div className="text-[11px] text-teal-200 font-semibold bg-teal-400/10 p-2 rounded-lg border border-teal-400/20">
                    💡 Gap Solution: ต้องเร่งยอด Stocking เข้าคลังอีก <strong>{lbsDeficit > 0 ? lbsDeficit.toLocaleString() : '0'} lbs</strong> เพื่อบรรลุเป้าหมาย
                  </div>
                </div>

                {/* Action Pillar 3: Deduction & Additions Audit */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-2">
                  <div className="flex items-center gap-2 text-rose-300">
                    <SlidersHorizontal className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-black uppercase">3. ตรวจสอบการหักเวลา</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    ตรวจสอบการบันทึกตัดเวลา PDI Deduct, บวกคืนชั่วโมง Bead (B-end), และการหักชั่วโมง RTR Shutdown ให้ครบถ้วน การไม่หักชั่วโมงหยุดเครื่องจักรจะกดดันให้ OPAH ต่ำกว่าความเป็นจริง
                  </p>
                  <div className="text-[11px] text-rose-200 font-semibold bg-rose-400/10 p-2 rounded-lg border border-rose-400/20">
                    💡 วันนี้หักเวลา: PDI -{ohpaSummary.pdiDeductHours}h, Bead +{ohpaSummary.beadAddHours.toFixed(1)}h
                  </div>
                </div>

                {/* Action Pillar 4: Line Balancing */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-300">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-black uppercase">4. ปรับสมดุลไลน์ผลิต</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    เกลี่ยกำลังพลจากขั้นตอนที่มีงานคอย (WIP Buffer สูง) ไปเสริมจุดคอขวด เช่น ย้ายช่างจาก Component Prep ไปช่วยจุด Building หรือ Curing เพื่อให้เกิด Finished Goods ทันที
                  </p>
                  <div className="text-[11px] text-indigo-200 font-semibold bg-indigo-400/10 p-2 rounded-lg border border-indigo-400/20">
                    💡 Manpower Ratio: GY {ohpaSummary.totalEmployeesCount} คน + Contractor {ohpaSummary.shifts[0]?.contractorHeadcount || 0} คน
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: DEPARTMENT BREAKDOWN (5 AREAS) ================= */}
      {activeTab === 'DEPARTMENTS' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <h4 className="text-sm font-black text-slate-900">
                ผลการดำเนินงาน OPAH และการวิเคราะห์แยก 5 แผนกหลัก
              </h4>
              <p className="text-xs text-slate-500">
                เปรียบเทียบชั่วโมงทำงานจริง, ยอดผลิต, และค่า OPAH แต่ละสายการผลิตกับเป้าหมายเฉพาะของแต่ละแผนก
              </p>
            </div>
            {/* Department Selector Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {['Consumer', 'Total Aviation', 'BCA', 'Retread'].map(key => {
                const target = DEPT_TARGETS[key] || 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDeptKey(key)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                      selectedDeptKey === key
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {key} (Target: {target})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Department Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(ohpaSummary.areaBreakdown || [])
              .filter(a => ['Consumer', 'Bias Aero', 'Radial Aero', 'Retread', 'BCA'].includes(a.areaKey))
              .map(area => {
                const isSelected = selectedDeptKey === area.areaKey || (selectedDeptKey === 'Total Aviation' && (area.areaKey === 'Bias Aero' || area.areaKey === 'Radial Aero'));
                const deptTarget = DEPT_TARGETS[area.areaKey] || 0;
                const areaOpah = area.areaOpahLbsPerHour || 0;
                const isMet = deptTarget > 0 ? areaOpah >= deptTarget : true;
                const diff = deptTarget > 0 ? Math.round((areaOpah - deptTarget) * 100) / 100 : 0;

                return (
                  <div
                    key={area.areaKey}
                    onClick={() => setSelectedDeptKey(area.areaKey)}
                    className={`p-5 rounded-3xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 border-indigo-400 bg-white shadow-md'
                        : 'border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{area.icon}</span>
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-900">{area.areaName}</h5>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {area.departments.length} หน่วยงาน
                          </span>
                        </div>
                      </div>
                      {deptTarget > 0 && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isMet ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isMet ? '✓ ON TARGET' : '✗ GAP'}
                        </span>
                      )}
                    </div>

                    <div className="py-3 space-y-1.5 text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500">OPAH ประจำแผนก:</span>
                        <strong className="text-base font-mono font-black text-slate-900">
                          {areaOpah > 0 ? areaOpah.toFixed(2) : '-'} <span className="text-[10px] font-normal text-slate-500">lbs/h</span>
                        </strong>
                      </div>
                      {deptTarget > 0 && (
                        <div className="flex justify-between items-baseline text-[11px]">
                          <span className="text-slate-400">เป้าหมายแผนก:</span>
                          <span className="font-mono font-bold text-slate-600">
                            {deptTarget.toFixed(1)} lbs/h ({diff > 0 ? `+${diff}` : diff})
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-baseline pt-1 border-t border-slate-100">
                        <span className="text-slate-500">ชม. ทำงานสุทธิ:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {(area.finalOpahHours || area.totalHours).toLocaleString()} ชม.
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500">ยอด Stocking:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {(area.areaTonnageLbs || 0).toLocaleString()} lbs
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500">กำลังพลปฏิบัติงาน:</span>
                        <span className="font-bold text-slate-700">
                          {area.totalHeadcount} คน (GY {area.gyHeadcount} / Cont {area.contractorHeadcount})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Departmental Diagnostic & Recommendations Box */}
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h4 className="text-sm font-black text-slate-900">
                บทวิเคราะห์และแนวทางพัฒนาเฉพาะแผนก: <span className="text-indigo-700">{selectedDeptKey}</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
                <span className="font-black text-slate-800 block text-xs">🔍 การวินิจฉัยปัญหาคอขวด (Bottleneck Diagnosis)</span>
                <p className="text-slate-600 leading-relaxed">
                  {selectedDeptKey === 'Consumer' && 'ตรวจสอบการส่งมอบชิ้นส่วนจาก Steelastic (4140) สู่เครื่องสร้างโครงยาง VMI & R25 (5110) และป้องกันไม่ให้เตาอบ Curing (5120) มี Downtime รอชิ้นงาน'}
                  {selectedDeptKey.includes('Aero') && 'ตรวจสอบอัตราการปล่อยยางเครื่องบิน (Aircraft Tire Inspection) และการจัดเก็บชั่วโมงเตาหล่อดอก/Curing ให้สัมพันธ์กับยอด Stocking รายวัน'}
                  {selectedDeptKey === 'BCA' && 'ตรวจสอบยอดการผลิตยางคอมปาวด์ใน Banbury (3200) และการหักชั่วโมง PDI / BCA Dev เพื่อสะท้อน Productivity จริงของวัตถุดิบ'}
                  {selectedDeptKey === 'Retread' && 'ตรวจสอบการรับยอด Stocking ยางหล่อดอกใน SAP และบันทึกเวลา RTR Shutdown เพื่อปรับชั่วโมง OPAH ให้ถูกต้อง'}
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
                <span className="font-black text-slate-800 block text-xs">⚡ มาตรการเพิ่มผลผลิต (Productivity Levers)</span>
                <p className="text-slate-600 leading-relaxed">
                  {selectedDeptKey === 'Consumer' && 'ลดระยะเวลา Mold Changeover ในหน่วย Curing 5120 และจัดลำดับไซส์ยางให้มีความต่อเนื่องเพื่อลดการสูญเสียเวลาสูญเปล่า'}
                  {selectedDeptKey.includes('Aero') && 'เน้นการผลิตยางเกรดหลักที่มีน้ำหนักชิ้นงานต่อรอบสูง (High Tonnage per cure cycle) เพื่อดันตัวเลข Lbs ต่อชั่วโมงให้พุ่งขึ้น'}
                  {selectedDeptKey === 'BCA' && 'ควบคุม Batch Cycle Time ในหน่วยผสม และลดปริมาณ Scrap/Waste Compound ที่ขอบ Calender'}
                  {selectedDeptKey === 'Retread' && 'เพิ่มอัตราการหมุนเวียนยาง Casing จากลูกค้าเข้าสู่สายการขัดและพอกดอกยางอย่างสม่ำเสมอ'}
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
                <span className="font-black text-slate-800 block text-xs"><Users className="w-3.5 h-3.5 inline mr-1 text-cyan-600 align-text-bottom" /> การบริหารกำลังพล (Labor Allocation)</span>
                <p className="text-slate-600 leading-relaxed">
                  {selectedDeptKey === 'Consumer' && 'จัดสรรกำลังพลผู้รับเหมา (WAS Contractor) เข้าทดแทนจุดงานทั่วไป และสงวนพนักงาน GY ฝีมือสูงไว้ที่เครื่องสร้างหลัก VMI'}
                  {selectedDeptKey.includes('Aero') && 'ควบคุมชั่วโมงโอเวอร์ไทม์ของช่างตรวจสภาพและช่างประกอบยางให้สอดคล้องกับคิวยางที่รอตรวจสอบจริง'}
                  {selectedDeptKey === 'BCA' && 'จัดการหมุนเวียนกำลังพลระหว่างกะในหน่วย Cement House (3300) และ Mixing (3200) ตามปริมาณงานผสม'}
                  {selectedDeptKey === 'Retread' && 'ควบคุมชั่วโมงการทำงานในช่วงที่มี Shutdown เพื่อไม่ให้ชั่วโมงบวมเกินความจำเป็น'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: TRENDS & HISTORICAL COMPARISON ================= */}
      {activeTab === 'TRENDS' && (
        <div className="space-y-6">
          {/* Historical Highs and Lows Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Best Day */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <span className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                <Award className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  🌟 วันที่ทำผลงานสูงสุด (Best Day)
                </span>
                <div className="text-lg font-black text-emerald-950 mt-0.5">
                  {bestDay ? `วันที่ ${bestDay.day}/09 (${bestDay.dayName})` : '-'}
                </div>
                <p className="text-xs text-emerald-700 mt-1">
                  OPAH สูงถึง <strong className="font-mono font-black">{bestDay?.opah.toFixed(2)} lbs/h</strong> ด้วยยอด Stocking <strong>{(bestDay?.stockingLbs || 0).toLocaleString()} lbs</strong> ต่อชั่วโมงสุทธิ {bestDay?.hours.toLocaleString()} ชม.
                </p>
              </div>
            </div>

            {/* Worst Day */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <span className="p-2 bg-rose-600 text-white rounded-xl shadow-xs shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                  ⚠️ วันที่ทำผลงานต่ำสุด (Lowest Day)
                </span>
                <div className="text-lg font-black text-rose-950 mt-0.5">
                  {worstDay ? `วันที่ ${worstDay.day}/09 (${worstDay.dayName})` : '-'}
                </div>
                <p className="text-xs text-rose-700 mt-1">
                  OPAH อยู่ที่ <strong className="font-mono font-black">{worstDay?.opah.toFixed(2)} lbs/h</strong> เนื่องจากยอด Stocking น้อย ({worstDay?.stockingLbs.toLocaleString()} lbs) หรือเป็นช่วงวันหยุด Standby
                </p>
              </div>
            </div>

            {/* 7-Day Rolling Average */}
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-start gap-3">
              <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800">
                  📈 ค่าเฉลี่ยเคลื่อนที่ 7 วัน (7-Day Rolling Avg)
                </span>
                <div className="text-lg font-black text-indigo-950 mt-0.5 font-mono">
                  {avg7DayOpah.toFixed(2)} lbs/ชม.
                </div>
                <p className="text-xs text-indigo-700 mt-1">
                  {avg7DayOpah >= PLANT_TARGET
                    ? '✓ โมเมนตัมการผลิต 7 วันล่าสุดอยู่ในเกณฑ์ผ่านเป้าหมาย 36.0 lbs/h'
                    : '⚠️ โมเมนตัม 7 วันล่าสุดยังต่ำกว่าเป้าหมาย จำเป็นต้องเร่งยอดผลิตปิดท้ายเดือน'}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Recharts Chart: Hours & Daily OPAH Trend */}
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  กราฟเปรียบเทียบเทรนด์ชั่วโมงทำงาน (Total Hours) กับค่า OPAH รายวันตลอดทั้งเดือน
                </h4>
                <p className="text-xs text-slate-500">
                  แท่งแสดงชั่วโมงทำงานสุทธิ (Net Hours) และเส้นแสดงค่า OPAH เทียบกับเส้นประเป้าหมาย 36.0 lbs/ชม.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-indigo-600 rounded-sm" />
                  <span className="font-semibold text-slate-700">ชม. สุทธิ (Net Hours)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-500 rounded-full" />
                  <span className="font-semibold text-slate-700">OPAH (lbs/ชม.)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500" />
                  <span className="font-semibold text-rose-700">Target (36.0)</span>
                </div>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" orientation="left" stroke="#475569" tick={{ fontSize: 11 }} label={{ value: 'ชั่วโมงทำงาน (ชม.)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#059669" domain={[0, 60]} tick={{ fontSize: 11 }} label={{ value: 'OPAH (lbs/ชม.)', angle: 90, position: 'insideRight', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '1rem', border: 'none', color: '#F8FAFC', fontSize: '12px' }}
                    formatter={(val: any, name: any) => {
                      if (name === 'hours') return [`${val.toLocaleString()} ชม.`, 'ชม. สุทธิ'];
                      if (name === 'opah') return [`${val.toFixed(2)} lbs/ชม.`, 'OPAH'];
                      if (name === 'target') return [`${val} lbs/ชม.`, 'เป้าหมาย'];
                      return [val, name];
                    }}
                  />
                  <Bar yAxisId="left" dataKey="hours" fill="#4F46E5" radius={[4, 4, 0, 0]} opacity={0.85} name="hours" />
                  <Line yAxisId="right" type="monotone" dataKey="opah" stroke="#10B981" strokeWidth={3} dot={{ r: 3, fill: '#10B981' }} activeDot={{ r: 6 }} name="opah" />
                  <ReferenceLine yAxisId="right" y={PLANT_TARGET} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={2} label={{ value: 'Target 36.0', position: 'top', fill: '#EF4444', fontSize: 10, fontWeight: 'bold' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: MULTI-MONTH HISTORICAL ARCHIVE ================= */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                  <History className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-black text-slate-900">
                  ระบบเก็บบันทึกประวัติและต่อยอดในอนาคต (Multi-Month Historical Archive)
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                เก็บรวบรวมประวัติผลการดำเนินงาน OPAH รายเดือนอย่างต่อเนื่อง เพื่อเปรียบเทียบแนวโน้ม Month-over-Month (MoM) เมื่อมีข้อมูลเดือนถัดไป (ต.ค., พ.ย., ธ.ค.)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveCurrentSnapshot}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                title="บันทึกข้อมูล MTD ของเดือนปัจจุบันเก็บไว้ในระบบถาวร"
              >
                <Save className="w-3.5 h-3.5" />
                บันทึก Snapshot เดือนนี้
              </button>
              <button
                type="button"
                onClick={handleExportHistoryExcel}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                title="ดาวน์โหลดประวัติทั้งหมดเป็นไฟล์ Excel"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                Export ประวัติ Excel
              </button>
            </div>
          </div>

          {/* Historical Snapshot Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-extrabold text-[11px] tracking-wider uppercase">
                  <th className="py-3 px-3">รอบเดือน (Month)</th>
                  <th className="py-3 px-2 text-center">วันทำงาน</th>
                  <th className="py-3 px-3 text-right">ชม. สุทธิ (Net Hours)</th>
                  <th className="py-3 px-3 text-right">ชม. OT (%)</th>
                  <th className="py-3 px-3 text-right">ยอด Stocking (lbs)</th>
                  <th className="py-3 px-3 text-right text-amber-300">OPAH (lbs/h)</th>
                  <th className="py-3 px-2 text-center">เป้าหมาย (Target)</th>
                  <th className="py-3 px-2 text-center">สถานะ</th>
                  <th className="py-3 px-3">บันทึกล่าสุด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {snapshots.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      {s.monthName}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700">
                      {s.daysCount} วัน
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {s.totalNetHours.toLocaleString()} ชม.
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {s.otHours.toLocaleString()}h ({s.otPercentage}%)
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold">
                      {s.stockingLbs.toLocaleString()} lbs
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-indigo-700 text-sm">
                      {s.mtdOpahLbsPerHour.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-semibold text-slate-600">
                      {s.targetOpah.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        s.targetMet
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {s.targetMet ? '✓ ผ่านเป้า' : '✗ ไม่ผ่าน'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(s.savedAt).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200/80 text-xs text-indigo-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">ความต่อเนื่องของข้อมูล (Future Expansion Protocol):</strong>
              <p className="mt-0.5 text-indigo-800">
                เมื่อเข้าสู่เดือนถัดไป (เช่น ตุลาคม 2026) ข้อมูลของเดือนกันยายนนี้จะถูกเก็บไว้ในฐานประวัติถาวร ท่านสามารถเปรียบเทียบแนวโน้มผลผลิตรายเดือน (Month-over-Month), วิเคราะห์ประสิทธิภาพการใช้แรงงาน, และประเมินประสิทธิผลของมาตรการปรับปรุงได้อย่างต่อเนื่อง
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
