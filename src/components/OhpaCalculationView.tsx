import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ParsedShiftRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
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
  Users,
  HardHat,
  Building2,
  CheckCircle2,
  Briefcase,
  ShieldBan,
  Info
} from 'lucide-react';

interface OhpaCalculationViewProps {
  records: ParsedShiftRecord[]; // Goodyear scanned employees
  contractorRecords?: ContractorScanRecord[]; // Contractor WAS scanned employees
  currentScanDateFormatted: string; // e.g. "14/09/2026"
  onSelectGlobalDate?: (dateFormatted: string) => void;
  allScanPresets?: { id?: string; name: string; dateFormatted?: string; content: string }[];
  contractorRecordsByDate?: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }>;
  employeeMapping?: Record<string, any>;
  dailyAdjustments?: any[];
}

export const OhpaCalculationView: React.FC<OhpaCalculationViewProps> = ({
  records,
  contractorRecords = [],
  currentScanDateFormatted,
  onSelectGlobalDate,
  allScanPresets = [],
  contractorRecordsByDate = {},
  employeeMapping = {},
  dailyAdjustments = []
}) => {
  const [tonnageReport, setTonnageReport] = useState<StockingTonnageReport | null>(null);
  const [selectedPdValue, setSelectedPdValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'DAILY' | 'MTD'>('DAILY');

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

  // Compute Combined OPAH Summary (Goodyear + Contractor + Monthly staff, excluding 6320, plus MTD)
  const ohpaSummary = useMemo(() => {
    const displayDate = tonnageReport?.productionDay || currentScanDateFormatted || '-';
    return calculateOhpaSummary(
      records,
      contractorRecords,
      tonnageReport,
      displayDate,
      allScanPresets,
      contractorRecordsByDate,
      employeeMapping,
      dailyAdjustments
    );
  }, [records, contractorRecords, tonnageReport, currentScanDateFormatted, allScanPresets, contractorRecordsByDate, employeeMapping, dailyAdjustments]);

  const handleExportExcel = () => {
    if (!tonnageReport) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: OPAH KPI Summary (Daily & MTD)
    const summaryData = [
      { 'หัวข้อ (KPI)': 'วันที่ผลิต (Production Day)', 'ค่า': ohpaSummary.productionDay + ` (${ohpaSummary.monthlyStaff.dayName})` },
      { 'หัวข้อ (KPI)': 'พนักงานรวมทั้งโรงงาน (GY + Contractor + Monthly)', 'ค่า': ohpaSummary.totalEmployeesCount + ' คน' },
      { 'หัวข้อ (KPI)': '- พนักงานประจำ Goodyear (ไม่รวมแผนก 6320)', 'ค่า': ohpaSummary.gyEmployeesCount + ' คน (' + ohpaSummary.gyTotalHours.toLocaleString() + ' ชม.)' },
      { 'หัวข้อ (KPI)': '- พนักงานผู้รับเหมา Contractor WAS (ไม่รวมแผนก 6320)', 'ค่า': ohpaSummary.contractorEmployeesCount + ' คน (' + ohpaSummary.contractorTotalHours.toLocaleString() + ' ชม.)' },
      { 'หัวข้อ (KPI)': '- พนักงานรายเดือน (Monthly Staff 62 คน)', 'ค่า': `${ohpaSummary.monthlyStaff.count} คน (${ohpaSummary.monthlyStaff.totalHours} ชม. @ ${ohpaSummary.monthlyStaff.hoursPerPerson} ชม./คน)` },
      { 'หัวข้อ (KPI)': '🚫 พนักงานแผนก 6320 ที่ตัดออก (GY + Cont)', 'ค่า': `${ohpaSummary.excluded6320GyCount + ohpaSummary.excluded6320ContCount} คน (${(ohpaSummary.excluded6320GyHours + ohpaSummary.excluded6320ContHours).toFixed(1)} ชม.)` },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงานปกติรวมทั้งสิ้น (รวมรายเดือน)', 'ค่า': ohpaSummary.totalNormalHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงาน OT รวมทั้งสิ้น', 'ค่า': ohpaSummary.totalOtHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงานรวมทั้งโรงงานประจำวัน (Total Working Hours)', 'ค่า': ohpaSummary.totalWorkingHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': 'ยอด Stocking รวมประจำวัน (kg)', 'ค่า': ohpaSummary.totalTonnageKg.toLocaleString() + ' kg' },
      { 'หัวข้อ (KPI)': 'ยอด Stocking รวมประจำวัน (lbs = kg x 2.2046)', 'ค่า': ohpaSummary.totalTonnageLbs.toLocaleString() + ' lbs' },
      { 'หัวข้อ (KPI)': 'ยอดตันประจำวัน (Metric Tons)', 'ค่า': ohpaSummary.totalTonnageTon + ' Tons' },
      { 'หัวข้อ (KPI)': '⭐ Daily Overall Plant OPAH [(kg x 2.2046) / Total Hours]', 'ค่า': ohpaSummary.overallOpahLbsPerHour + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': '- Daily OPAH ส่วน Goodyear', 'ค่า': ohpaSummary.gyOpahLbsPerHour + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': '- Daily OPAH ส่วน Contractor', 'ค่า': ohpaSummary.contractorOpahLbsPerHour + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': '----------------------------------------', 'ค่า': '----------------------------------------' },
      { 'หัวข้อ (KPI)': `📈 MTD สะสม (วันที่ 1 ถึง ${ohpaSummary.mtd?.daysCount || 14})`, 'ค่า': `รวม ${ohpaSummary.mtd?.daysCount || 14} วัน` },
      { 'หัวข้อ (KPI)': '⭐ MTD Overall Plant OPAH', 'ค่า': (ohpaSummary.mtd?.mtdOpahLbsPerHour || 0) + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': 'MTD ชั่วโมงทำงานรวมทั้งโรงงาน (Total Hours)', 'ค่า': (ohpaSummary.mtd?.mtdTotalHours.toLocaleString() || '0') + ' ชม.' },
      { 'หัวข้อ (KPI)': '- MTD ชม. Goodyear', 'ค่า': (ohpaSummary.mtd?.mtdGyHours.toLocaleString() || '0') + ' ชม.' },
      { 'หัวข้อ (KPI)': '- MTD ชม. Contractor', 'ค่า': (ohpaSummary.mtd?.mtdContractorHours.toLocaleString() || '0') + ' ชม.' },
      { 'หัวข้อ (KPI)': '- MTD ชม. พนักงานรายเดือน', 'ค่า': (ohpaSummary.mtd?.mtdMonthlyHours.toLocaleString() || '0') + ' ชม.' },
      { 'หัวข้อ (KPI)': 'MTD ยอด Stocking รวม (kg)', 'ค่า': (ohpaSummary.mtd?.mtdStockingKg.toLocaleString() || '0') + ' kg' },
      { 'หัวข้อ (KPI)': 'MTD ยอด Stocking รวม (lbs)', 'ค่า': (ohpaSummary.mtd?.mtdStockingLbs.toLocaleString() || '0') + ' lbs' },
      { 'หัวข้อ (KPI)': 'MTD ยอด Stocking รวม (Tons)', 'ค่า': (ohpaSummary.mtd?.mtdStockingTon || 0) + ' Tons' },
    ];
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'OPAH_KPI_Summary');

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

    // Sheet 3: Shift Breakdown
    const shiftData = ohpaSummary.shifts.map(s => ({
      'กะการทำงาน': s.shiftLabel,
      'จำนวนคนรวม (คน)': s.headcount,
      'GY (คน)': s.gyHeadcount,
      'Cont (คน)': s.contractorHeadcount,
      'ชม.ปกติ (ชม.)': s.normalHours,
      'ชม. OT (ชม.)': s.otHours,
      'ชม.รวมทั้งหมด (ชม.)': s.totalHours,
      'GY ชม.รวม': s.gyTotalHours,
      'Cont ชม.รวม': s.contractorTotalHours,
      'Stocking (kg)': s.tonnageKg,
      'Stocking (lbs)': s.tonnageLbs,
      'Stocking (Tons)': s.tonnageTon,
      'OPAH (lbs/ชม.)': s.opahLbsPerHour,
    }));
    const ws3 = XLSX.utils.json_to_sheet(shiftData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Shift_Breakdown');

    // Sheet 4: Department Breakdown
    const deptData = ohpaSummary.departmentBreakdown.map(d => ({
      'แผนก / ฝ่าย': d.dept,
      'ประเภท': d.isMonthly ? 'Monthly Staff' : d.isContractor ? 'Contractor WAS' : 'Goodyear Employee',
      'จำนวนคน (คน)': d.headcount,
      'ชม.ปกติ (ชม.)': d.normalHours,
      'ชม. OT (ชม.)': d.otHours,
      'ชม.รวมทั้งหมด (ชม.)': d.totalHours,
      '% สัดส่วน': d.percentageOfTotalHours + '%'
    }));
    const ws4 = XLSX.utils.json_to_sheet(deptData);
    XLSX.utils.book_append_sheet(wb, ws4, 'Department_Breakdown');

    // Sheet 5: MTD Daily Breakdown
    if (ohpaSummary.mtd?.dailyItems && ohpaSummary.mtd.dailyItems.length > 0) {
      const mtdData = ohpaSummary.mtd.dailyItems.map(item => ({
        'วันที่ (Date)': item.dateStr,
        'วันในสัปดาห์': item.dayName,
        'GY กำลังพล (คน)': item.gyHeadcount,
        'GY ชั่วโมง (ชม.)': item.gyHours,
        'Cont กำลังพล (คน)': item.contractorHeadcount,
        'Cont ชั่วโมง (ชม.)': item.contractorHours,
        'รายเดือน (ชม.)': item.monthlyHours,
        'รวม ชม.วันนั้น (ชม.)': item.totalHours,
        'ชม.สะสม MTD (ชม.)': item.cumulativeTotalHours
      }));
      const ws5 = XLSX.utils.json_to_sheet(mtdData);
      XLSX.utils.book_append_sheet(wb, ws5, 'MTD_Daily_Breakdown');
    }

    XLSX.writeFile(wb, 'OPAH_CAL_Report_' + (ohpaSummary.productionDay || 'Date').replace(/\//g, '') + '.xlsx');
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
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                OPAH CAL & Daily Stocking Tonnage Report
              </h2>
              <span className="bg-blue-100 text-blue-700 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                55012
              </span>
              <span className="bg-purple-100 text-purple-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-purple-300/40">
                + รายเดือน 62 คน
              </span>
              <span className="bg-rose-100 text-rose-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-300/40">
                ตัดแผนก 6320 ออก
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              คำนวณ OPAH = (Stocking kg × 2.2046) ÷ Total Working Hours (ตัดแผนก 6320 ออกทั้ง GY + Cont และรวมพนักงานรายเดือน 62 คน)
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

      {/* Logic Callout Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-md border border-indigo-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-amber-300 block">เงื่อนไขการคำนวณ OPAH พิเศษ:</span>
            <span className="text-slate-300">
              1. <strong>ตัดแผนก 6320 (Retread)</strong> ออกทั้ง GY ({ohpaSummary.excluded6320GyCount} คน) และ Cont ({ohpaSummary.excluded6320ContCount} คน) &nbsp;|&nbsp;
              2. <strong>เพิ่มพนักงานรายเดือน 62 คน</strong> ({ohpaSummary.monthlyStaff.dayName} คิด {ohpaSummary.monthlyStaff.hoursPerPerson} ชม./คน = +{ohpaSummary.monthlyStaff.totalHours} ชม.)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl text-[11px] font-mono shrink-0">
          <span>ตัด 6320 ออก: <strong>-{(ohpaSummary.excluded6320GyHours + ohpaSummary.excluded6320ContHours).toFixed(1)} ชม.</strong></span>
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

      {/* Mode Switcher Tabs: Daily (ประจำวัน) vs MTD (สะสมต้นเดือนถึงปัจจุบัน) */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
          <button
            onClick={() => setViewMode('DAILY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === 'DAILY'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>ประจำวัน (Daily - {ohpaSummary.productionDay})</span>
          </button>
          <button
            onClick={() => setViewMode('MTD')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === 'MTD'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>สะสมต้นเดือนถึงปัจจุบัน (MTD วันที่ 1 - {ohpaSummary.mtd?.daysCount || 14}/09)</span>
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
              viewMode === 'MTD' ? 'bg-amber-400 text-slate-900' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {ohpaSummary.mtd?.daysCount || 14} วัน
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium px-2">
          {viewMode === 'DAILY' ? (
            <span>กำลังแสดงผล: <strong>ข้อมูลประจำวัน ({ohpaSummary.productionDay})</strong></span>
          ) : (
            <span className="text-indigo-700 font-bold">
              กำลังแสดงผล: <strong>ข้อมูลสะสม MTD (วันที่ 1 ถึง {ohpaSummary.mtd?.daysCount || 14}/09/2026 รวม {ohpaSummary.mtd?.daysCount || 14} วัน)</strong>
            </span>
          )}
        </div>
      </div>

      {/* Primary KPI Summary Cards */}
      {viewMode === 'DAILY' ? (
        /* DAILY KPI CARDS */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Daily Plant OPAH Ratio */}
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white p-6 rounded-3xl shadow-lg shadow-blue-500/15 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-15">
              <Flame className="w-32 h-32" />
            </div>
            <div className="flex items-center justify-between z-10">
              <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">
                DAILY PLANT OPAH (ประจำวัน)
              </span>
              <span className="p-2 bg-white/15 backdrop-blur-xs rounded-xl">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </span>
            </div>
            <div className="my-4 z-10">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl lg:text-5xl font-black tracking-tight">
                  {ohpaSummary.overallOpahLbsPerHour.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-blue-200">lbs / ชม.</span>
              </div>
              <p className="text-xs text-blue-100/90 mt-2 leading-relaxed">
                สูตร: ({ohpaSummary.totalTonnageKg.toLocaleString()} kg × 2.2046) ÷ {ohpaSummary.totalWorkingHours.toLocaleString()} ชม. = <strong>{ohpaSummary.totalTonnageLbs.toLocaleString()} lbs</strong> ÷ {ohpaSummary.totalWorkingHours.toLocaleString()} ชม.
              </p>
            </div>
            <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs text-blue-100 z-10">
              <span>GY: <strong>{ohpaSummary.gyOpahLbsPerHour}</strong> | Cont: <strong>{ohpaSummary.contractorOpahLbsPerHour}</strong> lbs/ชม.</span>
              <span className="font-extrabold bg-white/20 px-2 py-0.5 rounded-lg">MTD: {ohpaSummary.mtd?.mtdOpahLbsPerHour || '-'} lbs/ชม.</span>
            </div>
          </div>

          {/* Card 2: Daily Total Working Hours */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                ชม.ทำงานรวมทั้งโรงงาน (DAILY TOTAL)
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
                  {ohpaSummary.totalWorkingHours.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-slate-500">ชม.</span>
              </div>
              {/* 3 Breakdown Cards: GY, Contractor, Monthly */}
              <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-slate-100 text-xs">
                <div className="bg-blue-50/70 p-2 rounded-xl">
                  <span className="font-bold text-blue-900 flex items-center gap-1 text-[11px]">
                    <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                    GY ({ohpaSummary.gyEmployeesCount} คน):
                  </span>
                  <span className="text-slate-700 font-bold text-[11px] mt-0.5 block">
                    {ohpaSummary.gyTotalHours.toLocaleString()} ชม.
                  </span>
                </div>
                <div className="bg-teal-50/70 p-2 rounded-xl">
                  <span className="font-bold text-teal-900 flex items-center gap-1 text-[11px]">
                    <HardHat className="w-3 h-3 text-teal-600 shrink-0" />
                    Cont ({ohpaSummary.contractorEmployeesCount} คน):
                  </span>
                  <span className="text-slate-700 font-bold text-[11px] mt-0.5 block">
                    {ohpaSummary.contractorTotalHours.toLocaleString()} ชม.
                  </span>
                </div>
                <div className="bg-purple-50/70 p-2 rounded-xl">
                  <span className="font-bold text-purple-900 flex items-center gap-1 text-[11px]">
                    <Briefcase className="w-3 h-3 text-purple-600 shrink-0" />
                    รายเดือน ({ohpaSummary.monthlyStaff.count} คน):
                  </span>
                  <span className="text-slate-700 font-bold text-[11px] mt-0.5 block">
                    {ohpaSummary.monthlyStaff.totalHours.toLocaleString()} ชม.
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>กำลังพลรวม: <strong>{ohpaSummary.totalEmployeesCount.toLocaleString()} คน</strong></span>
              <span className="text-rose-600 font-semibold text-[11px]">
                (ตัด 6320 ออก {ohpaSummary.excluded6320GyCount + ohpaSummary.excluded6320ContCount} คน)
              </span>
            </div>
          </div>

          {/* Card 3: Daily Stocking Tonnage */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                ยอด Stocking รวม (DAILY TOTAL)
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
                = <span className="text-emerald-700 text-sm">{ohpaSummary.totalTonnageLbs.toLocaleString()}</span> lbs (ปอนด์) | <span className="text-slate-500">{ohpaSummary.totalTonnageTon.toLocaleString()} ตัน</span>
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>MTD สะสมทั้งเดือน:</span>
              <span className="font-extrabold text-slate-800">
                {ohpaSummary.mtd?.mtdStockingKg?.toLocaleString() || tonnageReport?.total?.mtdTonnage?.toLocaleString() || '-'} kg
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* MTD KPI CARDS */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: MTD Overall Plant OPAH */}
          <div className="bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-900 text-white p-6 rounded-3xl shadow-lg shadow-indigo-500/15 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-15">
              <TrendingUp className="w-32 h-32" />
            </div>
            <div className="flex items-center justify-between z-10">
              <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">
                OVERALL PLANT MTD OPAH (สะสม 1 - {ohpaSummary.mtd?.daysCount || 14}/09)
              </span>
              <span className="p-2 bg-white/15 backdrop-blur-xs rounded-xl">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </span>
            </div>
            <div className="my-4 z-10">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl lg:text-5xl font-black tracking-tight text-amber-300">
                  {ohpaSummary.mtd?.mtdOpahLbsPerHour || 0}
                </span>
                <span className="text-sm font-bold text-indigo-200">lbs / ชม.</span>
              </div>
              <p className="text-xs text-indigo-100/90 mt-2 leading-relaxed">
                สูตร: ({ohpaSummary.mtd?.mtdStockingKg.toLocaleString()} kg × 2.2046) ÷ {ohpaSummary.mtd?.mtdTotalHours.toLocaleString()} ชม. = <strong>{ohpaSummary.mtd?.mtdStockingLbs.toLocaleString()} lbs</strong> ÷ {ohpaSummary.mtd?.mtdTotalHours.toLocaleString()} ชม.
              </p>
            </div>
            <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs text-indigo-100 z-10">
              <span>GY MTD: <strong>{ohpaSummary.mtd?.mtdGyOpahLbsPerHour}</strong> | Cont MTD: <strong>{ohpaSummary.mtd?.mtdContractorOpahLbsPerHour}</strong> lbs/ชม.</span>
              <span className="font-extrabold bg-white/20 px-2 py-0.5 rounded-lg">รวม {ohpaSummary.mtd?.daysCount} วัน</span>
            </div>
          </div>

          {/* Card 2: MTD Total Working Hours */}
          <div className="bg-white p-6 rounded-3xl border border-indigo-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                ชั่วโมงทำงานสะสม MTD (1 - {ohpaSummary.mtd?.daysCount || 14}/09)
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl lg:text-5xl font-black text-indigo-950 tracking-tight">
                  {ohpaSummary.mtd?.mtdTotalHours.toLocaleString() || '0'}
                </span>
                <span className="text-sm font-bold text-slate-500">ชม.</span>
              </div>
              {/* 3 Breakdown Cards: GY, Contractor, Monthly */}
              <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-slate-100 text-xs">
                <div className="bg-blue-50/70 p-2 rounded-xl">
                  <span className="font-bold text-blue-900 flex items-center gap-1 text-[11px]">
                    <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                    GY สะสม:
                  </span>
                  <span className="text-slate-700 font-bold text-[11px] mt-0.5 block">
                    {ohpaSummary.mtd?.mtdGyHours.toLocaleString()} ชม.
                  </span>
                </div>
                <div className="bg-teal-50/70 p-2 rounded-xl">
                  <span className="font-bold text-teal-900 flex items-center gap-1 text-[11px]">
                    <HardHat className="w-3 h-3 text-teal-600 shrink-0" />
                    Cont สะสม:
                  </span>
                  <span className="text-slate-700 font-bold text-[11px] mt-0.5 block">
                    {ohpaSummary.mtd?.mtdContractorHours.toLocaleString()} ชม.
                  </span>
                </div>
                <div className="bg-purple-50/70 p-2 rounded-xl">
                  <span className="font-bold text-purple-900 flex items-center gap-1 text-[11px]">
                    <Briefcase className="w-3 h-3 text-purple-600 shrink-0" />
                    รายเดือน สะสม:
                  </span>
                  <span className="text-slate-700 font-bold text-[11px] mt-0.5 block">
                    {ohpaSummary.mtd?.mtdMonthlyHours.toLocaleString()} ชม.
                  </span>
                </div>
              </div>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>รวมสะสม: <strong>{ohpaSummary.mtd?.daysCount} วันทำการ</strong></span>
              <span className="text-emerald-700 font-bold text-[11px]">
                (ตัดแผนก 6320 ออกทุกวัน)
              </span>
            </div>
          </div>

          {/* Card 3: MTD Stocking Tonnage */}
          <div className="bg-white p-6 rounded-3xl border border-emerald-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                ยอด STOCKING สะสม MTD (1 - {ohpaSummary.mtd?.daysCount || 14}/09)
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Weight className="w-5 h-5" />
              </div>
            </div>
            <div className="my-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl lg:text-5xl font-black text-emerald-800 tracking-tight">
                  {ohpaSummary.mtd?.mtdStockingKg.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-emerald-600">kg</span>
              </div>
              <p className="text-xs font-bold text-slate-600 mt-2">
                = <span className="text-emerald-700 text-sm">{ohpaSummary.mtd?.mtdStockingLbs.toLocaleString()}</span> lbs (ปอนด์) | <span className="text-slate-500">{ohpaSummary.mtd?.mtdStockingTon.toLocaleString()} ตัน</span>
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>เฉลี่ยต่อวัน:</span>
              <span className="font-extrabold text-slate-800">
                {Math.round((ohpaSummary.mtd?.mtdStockingKg || 0) / (ohpaSummary.mtd?.daysCount || 1)).toLocaleString()} kg / วัน
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MTD Daily Breakdown Table (ตารางสรุปสะสมรายวัน MTD 1 - N) */}
      {ohpaSummary.mtd?.dailyItems && ohpaSummary.mtd.dailyItems.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ตารางสรุปชั่วโมงทำงานและกำลังพลสะสม MTD รายวัน (วันที่ 1 ถึง {ohpaSummary.mtd.daysCount}/09/2026)
                </h3>
                <p className="text-xs text-slate-500">
                  แจกแจงชั่วโมงทำงานของ Goodyear, Contractor และพนักงานรายเดือนในแต่ละวันตั้งแต่ต้นเดือนถึงปัจจุบัน
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 shrink-0">
              <span>รวมชั่วโมงสะสม MTD: <strong>{ohpaSummary.mtd.mtdTotalHours.toLocaleString()} ชม.</strong></span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3 text-center w-12">วัน</th>
                  <th className="py-2.5 px-4">วันที่ (Date)</th>
                  <th className="py-2.5 px-4 text-center">วันในสัปดาห์</th>
                  <th className="py-2.5 px-4 text-right bg-blue-50/60 text-blue-900">Goodyear (ชม.)</th>
                  <th className="py-2.5 px-4 text-right bg-teal-50/60 text-teal-900">Contractor (ชม.)</th>
                  <th className="py-2.5 px-4 text-right bg-purple-50/60 text-purple-900">รายเดือน (ชม.)</th>
                  <th className="py-2.5 px-4 text-right font-black bg-slate-200/70 text-slate-900">รวมชม.วันนั้น (ชม.)</th>
                  <th className="py-2.5 px-4 text-right font-black bg-indigo-600 text-white">ชม.สะสม MTD (ชม.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {ohpaSummary.mtd.dailyItems.map((item) => {
                  const isCurrentSelected = item.day === ohpaSummary.mtd?.daysCount;
                  return (
                    <tr
                      key={item.dateStr}
                      className={
                        isCurrentSelected
                          ? 'bg-blue-50/80 font-bold text-blue-950 border-y-2 border-blue-300'
                          : 'hover:bg-slate-50 transition-colors'
                      }
                    >
                      <td className="py-2.5 px-3 text-center text-slate-500 font-sans">
                        {item.day}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-semibold text-slate-900 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{item.dateStr}</span>
                        {isCurrentSelected && (
                          <span className="ml-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded font-sans">
                            วันที่เลือก
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center font-sans text-slate-600">
                        {item.dayName}
                      </td>
                      <td className="py-2.5 px-4 text-right text-blue-700 bg-blue-50/20">
                        {item.gyHours.toLocaleString()} ชม.
                        <span className="text-[10px] text-slate-400 font-sans block">({item.gyHeadcount} คน)</span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-teal-700 bg-teal-50/20">
                        {item.contractorHours.toLocaleString()} ชม.
                        <span className="text-[10px] text-slate-400 font-sans block">({item.contractorHeadcount} คน)</span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-purple-700 bg-purple-50/20">
                        {item.monthlyHours.toLocaleString()} ชม.
                        <span className="text-[10px] text-slate-400 font-sans block">(62 คน)</span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900 bg-slate-100/50">
                        {item.totalHours.toLocaleString()} ชม.
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-indigo-700 bg-indigo-50/60">
                        {item.cumulativeTotalHours.toLocaleString()} ชม.
                      </td>
                    </tr>
                  );
                })}

                {/* MTD Total Summary Row */}
                <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-800">
                  <td colSpan={3} className="py-3 px-4 font-sans text-amber-400">
                    รวมสะสม MTD ทั้งสิ้น (วันที่ 1 ถึง {ohpaSummary.mtd.daysCount}/09/2026)
                  </td>
                  <td className="py-3 px-4 text-right text-blue-300">
                    {ohpaSummary.mtd.mtdGyHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-4 text-right text-teal-300">
                    {ohpaSummary.mtd.mtdContractorHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-4 text-right text-purple-300">
                    {ohpaSummary.mtd.mtdMonthlyHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-4 text-right text-slate-300">
                    -
                  </td>
                  <td className="py-3 px-4 text-right text-amber-300 bg-slate-800 text-sm">
                    {ohpaSummary.mtd.mtdTotalHours.toLocaleString()} ชม.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shift-by-Shift Performance Matrix */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                ประสิทธิภาพแยกตามกะ (Shift Performance Breakdown - รวม GY + Contractor)
              </h3>
              <p className="text-xs text-slate-500">
                เปรียบเทียบชั่วโมงทำงาน กำลังพล ยอด Stocking และค่า OPAH แต่ละกะ
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
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    GY: {s.gyHeadcount}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                    Cont: {s.contractorHeadcount}
                  </span>
                </div>
              </div>

              <div className="py-4 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">ชั่วโมงทำงานรวม (GY+Cont):</span>
                  <strong className="text-slate-900 font-bold">{s.totalHours.toLocaleString()} ชม.</strong>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span className="pl-2">- ปกติ / OT รวม:</span>
                  <span>{s.normalHours} ชม. / <span className="text-amber-600 font-bold">+{s.otHours} ชม.</span></span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span className="pl-2">- สัดส่วนชั่วโมง (GY / Cont):</span>
                  <span><strong>{s.gyTotalHours}</strong> ชม. / <strong>{s.contractorTotalHours}</strong> ชม.</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">ยอด Stocking:</span>
                  <strong className="text-emerald-700 font-bold">{s.tonnageKg.toLocaleString()} kg ({s.tonnageLbs.toLocaleString()} lbs)</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60 bg-white -mx-5 -mb-5 p-4 rounded-b-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">OPAH ประจำกะ:</span>
                <span className="text-xl font-black text-indigo-700">
                  {s.opahLbsPerHour} <span className="text-xs font-semibold text-slate-500">lbs/ชม.</span>
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
                สัดส่วนชั่วโมงทำงานแยกตามแผนก (Department Hours Contribution - Goodyear & Contractor)
              </h3>
              <p className="text-xs text-slate-500">
                สรุปชั่วโมงทำงานและกำลังพลจริงของทุกแผนกและผู้รับเหมาที่นำมาคำนวณ OHPA
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2.5 px-4">แผนก / ฝ่าย (Department)</th>
                <th className="py-2.5 px-4 text-center">ประเภท (Type)</th>
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
                  <td className="py-2.5 px-4 font-semibold text-slate-800 flex items-center gap-2">
                    {dept.isMonthly ? (
                      <Briefcase className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    ) : dept.isContractor ? (
                      <HardHat className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                    <span>{dept.dept}</span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      dept.isMonthly
                        ? 'bg-purple-100 text-purple-800 border border-purple-300/40'
                        : dept.isContractor
                        ? 'bg-teal-100 text-teal-800 border border-teal-300/40'
                        : 'bg-blue-100 text-blue-800 border border-blue-300/40'
                    }`}>
                      {dept.isMonthly ? 'Monthly Staff' : dept.isContractor ? 'Contractor' : 'Goodyear'}
                    </span>
                  </td>
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
                          className={`h-1.5 rounded-full ${
                            dept.isMonthly ? 'bg-purple-600' : dept.isContractor ? 'bg-teal-500' : 'bg-blue-600'
                          }`}
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
