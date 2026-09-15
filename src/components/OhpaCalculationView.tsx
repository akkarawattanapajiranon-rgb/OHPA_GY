import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ParsedShiftRecord } from '../types/attendance';
import { StockingTonnageReport } from '../types/ohpa';
import { calculateOhpaSummary } from '../utils/ohpaCalculator';
import {
  Calculator,
  RefreshCw,
  Calendar,
  ExternalLink,
  Download,
  Flame,
  Clock,
  Weight,
  Layers,
  Sparkles,
  AlertCircle,
  TrendingUp,
  Users
} from 'lucide-react';

interface OhpaCalculationViewProps {
  records: ParsedShiftRecord[]; // All scanned employees (e.g. ~470-750 people)
  currentScanDateFormatted: string; // e.g. "14/09/2026"
  onSelectGlobalDate?: (dateFormatted: string) => void;
}

export const OhpaCalculationView: React.FC<OhpaCalculationViewProps> = ({
  records,
  currentScanDateFormatted,
  onSelectGlobalDate
}) => {
  const [tonnageReport, setTonnageReport] = useState<StockingTonnageReport | null>(null);
  const [selectedPdValue, setSelectedPdValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch stocking tonnage report from /api/stocking-tonnage
  const fetchTonnageData = async (pdVal?: string, dateStr?: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      let url = '/api/stocking-tonnage';
      const params = new URLSearchParams();
      if (pdVal) params.append('pd', pdVal);
      else if (dateStr) params.append('date', dateStr);

      const qs = params.toString();
      if (qs) url += '?' + qs;

      const response = await fetch(url);
      const data = await response.json();

      if (data) {
        setTonnageReport(data);
        if (data.productionDayValue) {
          setSelectedPdValue(data.productionDayValue);
        }
        if (!data.success && data.message) {
          setFetchError(data.message);
        }
      }
    } catch (err: any) {
      setFetchError(err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์รายงาน 55012 ได้');
    } finally {
      setIsLoading(false);
    }
  };

  // Sync with currentScanDateFormatted whenever top navbar date changes
  useEffect(() => {
    if (!currentScanDateFormatted || currentScanDateFormatted === '-') return;

    // Convert DD/MM/YYYY to YYYYMMDD000000
    const parts = currentScanDateFormatted.split(/[/.-]/);
    let pdVal = '';
    if (parts.length === 3 && parts[2].length === 4) {
      pdVal = `${parts[2]}${parts[1].padStart(2, '0')}${parts[0].padStart(2, '0')}000000`;
    }
    if (pdVal) {
      setSelectedPdValue(pdVal);
    }
    fetchTonnageData(pdVal || undefined, currentScanDateFormatted);
  }, [currentScanDateFormatted]);

  const handleSelectDate = (newPdVal: string) => {
    setSelectedPdValue(newPdVal);
    fetchTonnageData(newPdVal);

    // Sync back to top global scan date in Navbar
    if (onSelectGlobalDate) {
      const opt = tonnageReport?.availableDates?.find(o => o.value === newPdVal);
      if (opt && opt.label) {
        onSelectGlobalDate(opt.label);
      } else if (newPdVal && newPdVal.length >= 8) {
        const yyyy = newPdVal.slice(0, 4);
        const mm = newPdVal.slice(4, 6);
        const dd = newPdVal.slice(6, 8);
        onSelectGlobalDate(`${dd}/${mm}/${yyyy}`);
      }
    }
  };

  const handleSyncWithScanDate = () => {
    fetchTonnageData(undefined, currentScanDateFormatted);
  };

  // Compute OHPA Summary
  const ohpaSummary = useMemo(() => {
    const displayDate = tonnageReport?.productionDay || currentScanDateFormatted || '-';
    return calculateOhpaSummary(records, tonnageReport, displayDate);
  }, [records, tonnageReport, currentScanDateFormatted]);

  const handleExportExcel = () => {
    if (!tonnageReport) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: OHPA KPI Summary
    const summaryData = [
      { 'หัวข้อ (KPI)': 'วันที่ผลิต (Production Day)', 'ค่า': ohpaSummary.productionDay },
      { 'หัวข้อ (KPI)': 'จำนวนพนักงานที่สแกนนิ้วทั้งหมด', 'ค่า': ohpaSummary.totalEmployeesCount + ' คน' },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงานปกติรวม', 'ค่า': ohpaSummary.totalNormalHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงาน OT รวม', 'ค่า': ohpaSummary.totalOtHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงานรวมทั้งหมด (Total Hours)', 'ค่า': ohpaSummary.totalWorkingHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': 'ยอดตันที่ Stock รวม (Daily Total Tonnage)', 'ค่า': ohpaSummary.totalTonnageKg.toLocaleString() + ' kg (' + ohpaSummary.totalTonnageTon + ' Tons)' },
      { 'หัวข้อ (KPI)': 'OHPA ประจำวัน (ชม.ทำงาน / ตัน)', 'ค่า': ohpaSummary.overallOhpaHoursPerTon + ' ชม./ตัน' },
    ];
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'OHPA_KPI_Summary');

    // Sheet 2: Stocking Tonnage Report 55012
    if (tonnageReport.rows && tonnageReport.rows.length > 0) {
      const tonnageRows = [
        ...tonnageReport.rows.map(r => ({
          'Code': r.code,
          'Product Category': r.categoryName,
          'MTD Tonnage (kg)': r.mtdTonnage,
          'Shift 1 Tonnage (kg)': r.shift1Tonnage,
          'Shift 2 Tonnage (kg)': r.shift2Tonnage,
          'Shift 3 Tonnage (kg)': r.shift3Tonnage,
          'Daily Total Tonnage (kg)': r.dailyTotalTonnage,
        })),
        ...(tonnageReport.total ? [{
          'Code': 'TOTAL',
          'Product Category': 'TOTAL',
          'MTD Tonnage (kg)': tonnageReport.total.mtdTonnage,
          'Shift 1 Tonnage (kg)': tonnageReport.total.shift1Tonnage,
          'Shift 2 Tonnage (kg)': tonnageReport.total.shift2Tonnage,
          'Shift 3 Tonnage (kg)': tonnageReport.total.shift3Tonnage,
          'Daily Total Tonnage (kg)': tonnageReport.total.dailyTotalTonnage,
        }] : [])
      ];
      const ws2 = XLSX.utils.json_to_sheet(tonnageRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'Daily_Stocking_55012');
    }

    // Sheet 3: Shift & Dept Breakdown
    const shiftData = ohpaSummary.shifts.map(s => ({
      'กะการทำงาน': s.shiftLabel,
      'จำนวนคน (คน)': s.headcount,
      'ชม.ทำงานปกติ (ชม.)': s.normalHours,
      'ชม.ทำงาน OT (ชม.)': s.otHours,
      'ชม.ทำงานรวม (ชม.)': s.totalHours,
      'Tonnage (kg)': s.tonnageKg,
      'Tonnage (Tons)': s.tonnageTon,
      'OHPA (ชม./ตัน)': s.ohpaHoursPerTon,
    }));
    const ws3 = XLSX.utils.json_to_sheet(shiftData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Shift_Breakdown');

    XLSX.writeFile(wb, 'OHPA_CAL_Report_' + (ohpaSummary.productionDay || 'Date').replace(/\//g, '') + '.xlsx');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                OHPA CAL & Daily Stocking Tonnage Report
              </h2>
              <span className="bg-blue-100 text-blue-700 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                55012
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              คำนวณอัตราส่วนชั่วโมงทำงานรวม (พนักงานทั้งหมด 750 คน) เทียบกับยอด Stocking Tonnage จากระบบ L2 Web
            </p>
          </div>
        </div>

        {/* Action Controls & Date Picker */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Production Day Select */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-500 mr-2" />
            <span className="text-xs font-semibold text-slate-600 mr-2">Production Day:</span>
            <select
              value={selectedPdValue || ''}
              onChange={(e) => handleSelectDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {tonnageReport?.availableDates && tonnageReport.availableDates.length > 0 ? (
                tonnageReport.availableDates.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              ) : (
                <option value="">{currentScanDateFormatted || '14/09/2026'}</option>
              )}
            </select>
          </div>

          <button
            onClick={handleSyncWithScanDate}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="ซิงค์วันตามไฟล์สแกนนิ้วที่เลือก"
          >
            <RefreshCw className={'w-3.5 h-3.5 ' + (isLoading ? 'animate-spin' : '')} />
            <span>ซิงค์วันสแกน</span>
          </button>

          <a
            href="https://10.124.129.34/l2web/datahost/all_areas/dpics.php?server=db_server&action=r06&mt=TBM&smt=TBM"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200"
            title="เปิดหน้าเว็บ 55012 ของระบบโรงงาน"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Link 55012</span>
          </a>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก Excel</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">สถานะการเชื่อมต่อ: </span>
            <span>{fetchError} (แสดงข้อมูลจำลอง/ล่าสุดสำหรับการคำนวณ)</span>
          </div>
        </div>
      )}

      {/* Primary KPI Summary Cards (3 Main Focused Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: OHPA Ratio */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white p-6 rounded-3xl shadow-lg shadow-blue-500/15 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-15">
            <Flame className="w-32 h-32" />
          </div>
          <div className="flex items-center justify-between z-10">
            <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">
              Overall Plant OHPA
            </span>
            <span className="p-2 bg-white/15 backdrop-blur-xs rounded-xl">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </span>
          </div>
          <div className="my-4 z-10">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl lg:text-5xl font-black tracking-tight">
                {ohpaSummary.overallOhpaHoursPerTon.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-blue-200">ชม. / ตัน</span>
            </div>
            <p className="text-xs text-blue-100/90 mt-2">
              สูตร: ชม.ทำงานรวม ({ohpaSummary.totalWorkingHours.toLocaleString()} ชม.) ÷ ยอดตัน ({ohpaSummary.totalTonnageTon.toLocaleString()} ตัน)
            </p>
          </div>
          <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs text-blue-100 z-10">
            <span>วันที่ประมวลผล:</span>
            <span className="font-extrabold">{ohpaSummary.productionDay}</span>
          </div>
        </div>

        {/* Card 2: Total Working Hours */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              ชม.ทำงานรวม (Total Working Hours)
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="my-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
                {ohpaSummary.totalWorkingHours.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-slate-500">ชม.</span>
            </div>
            <div className="flex items-center gap-4 text-xs mt-2 text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                ปกติ: <strong className="text-slate-800 font-bold">{ohpaSummary.totalNormalHours.toLocaleString()} ชม.</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                OT: <strong className="text-amber-600 font-bold">+{ohpaSummary.totalOtHours.toLocaleString()} ชม.</strong>
              </span>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>พนักงานที่สแกนนิ้ว:</span>
            <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              {ohpaSummary.totalEmployeesCount.toLocaleString()} คน
            </span>
          </div>
        </div>

        {/* Card 3: Stocking Tonnage */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              ยอด Stocking Tonnage รวม (Daily Total)
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Weight className="w-5 h-5" />
            </div>
          </div>
          <div className="my-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl lg:text-5xl font-black text-emerald-700 tracking-tight">
                {ohpaSummary.totalTonnageKg.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-emerald-600">kg</span>
            </div>
            <p className="text-xs font-bold text-slate-600 mt-2">
              = <span className="text-emerald-700 text-sm">{ohpaSummary.totalTonnageTon.toLocaleString()}</span> Metric Tons (ตัน)
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>MTD สะสมทั้งเดือน:</span>
            <span className="font-extrabold text-slate-800">
              {tonnageReport?.total?.mtdTonnage?.toLocaleString() || '-'} kg
            </span>
          </div>
        </div>
      </div>

      {/* Shift-by-Shift Performance Matrix */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                ประสิทธิภาพแยกตามกะ (Shift Performance Breakdown)
              </h3>
              <p className="text-xs text-slate-500">
                เปรียบเทียบชั่วโมงทำงาน กำลังพล ยอดตัน และค่า OHPA แต่ละกะ
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {ohpaSummary.shifts.map((s) => (
            <div
              key={s.shift}
              className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between hover:border-blue-300 transition-colors shadow-xs"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                <span className="text-sm font-extrabold text-slate-800">
                  {s.shiftLabel}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {s.headcount} คน
                </span>
              </div>

              <div className="py-4 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">ชั่วโมงทำงานรวม:</span>
                  <strong className="text-slate-900 font-bold">{s.totalHours.toLocaleString()} ชม.</strong>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span className="pl-2">- ปกติ / OT:</span>
                  <span>{s.normalHours} ชม. / <span className="text-amber-600 font-bold">+{s.otHours} ชม.</span></span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">ยอดตัน (Tonnage):</span>
                  <strong className="text-emerald-700 font-bold">{s.tonnageKg.toLocaleString()} kg ({s.tonnageTon} T)</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60 bg-white -mx-5 -mb-5 p-4 rounded-b-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">OHPA ประจำกะ:</span>
                <span className="text-xl font-black text-indigo-700">
                  {s.ohpaHoursPerTon} <span className="text-xs font-semibold text-slate-500">ชม./ตัน</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table Section: 55012 Daily Stocking Tonnage Report */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                (55012) Daily Stocking Tonnage Report for {ohpaSummary.productionDay}
              </h3>
              <p className="text-xs text-slate-500">
                ข้อมูลการ Stock ยางแยกตาม Product Category และตามกะ (จากเซิร์ฟเวอร์ระบบการผลิต)
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">
            Source: /l2web/datahost/all_areas/dpics.php?action=r06
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                <th className="py-3 px-3 border-r border-slate-200 text-center w-14">Code</th>
                <th className="py-3 px-4 border-r border-slate-200 min-w-[200px]">Product Category</th>
                <th className="py-3 px-4 text-right border-r border-slate-200 bg-slate-200/60 text-slate-800">MTD Tonnage (kg)</th>
                <th className="py-3 px-4 text-right border-r border-slate-200 bg-blue-50 text-blue-900">SHIFT 1 (kg)</th>
                <th className="py-3 px-4 text-right border-r border-slate-200 bg-amber-50 text-amber-900">SHIFT 2 (kg)</th>
                <th className="py-3 px-4 text-right border-r border-slate-200 bg-purple-50 text-purple-900">SHIFT 3 (kg)</th>
                <th className="py-3 px-4 text-right bg-emerald-100/80 text-emerald-950 font-black">DAILY TOTAL (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {tonnageReport?.rows && tonnageReport.rows.length > 0 ? (
                tonnageReport.rows.map((row, idx) => (
                  <tr
                    key={row.code + idx}
                    className={'hover:bg-slate-50/80 transition-colors ' + (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}
                  >
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800 border-r border-slate-100">{row.code}</td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-900 border-r border-slate-100">{row.categoryName}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600 border-r border-slate-100">{row.mtdTonnage.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-blue-700 font-medium border-r border-slate-100">{row.shift1Tonnage.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-amber-700 font-medium border-r border-slate-100">{row.shift2Tonnage.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right text-purple-700 font-medium border-r border-slate-100">{row.shift3Tonnage.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-right font-black text-emerald-800 bg-emerald-50/30">{row.dailyTotalTonnage.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    กำลังโหลดข้อมูลจากระบบ 55012...
                  </td>
                </tr>
              )}

              {/* Total Row */}
              {tonnageReport?.total && (
                <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-800">
                  <td className="py-3 px-3 text-center border-r border-slate-800 text-amber-400">TOTAL</td>
                  <td className="py-3 px-4 font-sans border-r border-slate-800 text-white">ยอดรวมทุกรายการ (TOTAL)</td>
                  <td className="py-3 px-4 text-right text-slate-200 border-r border-slate-800">{tonnageReport.total.mtdTonnage.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-blue-300 border-r border-slate-800">{tonnageReport.total.shift1Tonnage.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-amber-300 border-r border-slate-800">{tonnageReport.total.shift2Tonnage.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-purple-300 border-r border-slate-800">{tonnageReport.total.shift3Tonnage.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-emerald-300 bg-slate-800">{tonnageReport.total.dailyTotalTonnage.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department Working Hours Breakdown */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                สัดส่วนชั่วโมงทำงานแยกตามแผนก (Department Hours Contribution)
              </h3>
              <p className="text-xs text-slate-500">
                สรุปชั่วโมงทำงานและกำลังพลจริงของพนักงานแต่ละแผนกที่นำมาคำนวณ OHPA
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-4">แผนก / ฝ่าย (Department)</th>
                <th className="py-2.5 px-4 text-center">จำนวนคน (Headcount)</th>
                <th className="py-2.5 px-4 text-right">ชม.ปกติ (Normal)</th>
                <th className="py-2.5 px-4 text-right">ชม. OT</th>
                <th className="py-2.5 px-4 text-right font-black">ชม.รวมทั้งหมด (Total Hours)</th>
                <th className="py-2.5 px-4 text-right">% สัดส่วนชั่วโมง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ohpaSummary.departmentBreakdown.map((dept, idx) => (
                <tr key={dept.dept + idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-800">{dept.dept}</td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
                      {dept.headcount} คน
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-600 font-mono">{dept.normalHours.toLocaleString()} ชม.</td>
                  <td className="py-2.5 px-4 text-right text-amber-600 font-bold font-mono">+{dept.otHours.toLocaleString()} ชม.</td>
                  <td className="py-2.5 px-4 text-right font-black text-slate-900 font-mono">{dept.totalHours.toLocaleString()} ชม.</td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{ width: Math.min(100, dept.percentageOfTotalHours) + '%' }}
                        ></div>
                      </div>
                      <span className="font-bold text-slate-700 font-mono text-[11px] w-12 text-right">
                        {dept.percentageOfTotalHours}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
