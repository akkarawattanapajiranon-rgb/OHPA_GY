import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ParsedShiftRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { StockingTonnageReport } from '../types/ohpa';
import { PdiBeadReport, DEFAULT_PDI_BEAD_REPORT } from '../data/default_pdi_bead';
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
  Info,
  ChevronDown,
  ChevronRight,
  PieChart,
  Factory,
  Wrench,
  Plane,
  Car,
  Package,
  FileSpreadsheet
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
  pdiBeadReport?: PdiBeadReport;
}

export const OhpaCalculationView: React.FC<OhpaCalculationViewProps> = ({
  records,
  contractorRecords = [],
  currentScanDateFormatted,
  onSelectGlobalDate,
  allScanPresets = [],
  contractorRecordsByDate = {},
  employeeMapping = {},
  dailyAdjustments = [],
  pdiBeadReport = DEFAULT_PDI_BEAD_REPORT
}) => {
  const [tonnageReport, setTonnageReport] = useState<StockingTonnageReport | null>(null);
  const [selectedPdValue, setSelectedPdValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'DAILY' | 'MTD'>('DAILY');
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const [showPdiDetail, setShowPdiDetail] = useState<boolean>(false);

  const toggleArea = (key: string) => {
    setExpandedAreas(prev => ({ ...prev, [key]: !prev[key] }));
  };

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

  // Compute Combined OPAH Summary (Goodyear + Contractor + Monthly staff, excluding 6320, plus PDI & Bead adjustments)
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
      dailyAdjustments,
      pdiBeadReport
    );
  }, [records, contractorRecords, tonnageReport, currentScanDateFormatted, allScanPresets, contractorRecordsByDate, employeeMapping, dailyAdjustments, pdiBeadReport]);

  const activeAreaBreakdown = useMemo(() => {
    if (viewMode === 'MTD' && ohpaSummary.mtd?.areaBreakdown && ohpaSummary.mtd.areaBreakdown.length > 0) {
      return ohpaSummary.mtd.areaBreakdown;
    }
    return ohpaSummary.areaBreakdown || [];
  }, [viewMode, ohpaSummary]);

  const areaActiveStats = useMemo(() => {
    const activeAreas = activeAreaBreakdown.filter(a => !a.isExcluded6320);
    const retreadArea = activeAreaBreakdown.find(a => a.isExcluded6320);

    const activeNorm = Math.round(activeAreas.reduce((s, a) => s + a.normalHours, 0) * 10) / 10;
    const activeOt = Math.round(activeAreas.reduce((s, a) => s + a.otHours, 0) * 10) / 10;
    const activeGrossTot = Math.round(activeAreas.reduce((s, a) => s + a.totalHours, 0) * 10) / 10;
    const activeHc = Math.round(activeAreas.reduce((s, a) => s + a.totalHeadcount, 0) * 10) / 10;
    const activePdi = Math.round(activeAreas.reduce((s, a) => s + (a.pdiDeductHours || 0), 0) * 10) / 10;
    const activeBead = Math.round(activeAreas.reduce((s, a) => s + (a.beadAddHours || 0), 0) * 10) / 10;
    const activeNetTot = Math.round((activeGrossTot - activePdi + activeBead) * 10) / 10;

    const retreadNorm = Math.round((retreadArea?.normalHours || 0) * 10) / 10;
    const retreadOt = Math.round((retreadArea?.otHours || 0) * 10) / 10;
    const retreadTot = Math.round((retreadArea?.totalHours || 0) * 10) / 10;
    const retreadHc = Math.round((retreadArea?.totalHeadcount || 0) * 10) / 10;

    const grandNorm = Math.round((activeNorm + retreadNorm) * 10) / 10;
    const grandOt = Math.round((activeOt + retreadOt) * 10) / 10;
    const grandGrossTot = Math.round((activeGrossTot + retreadTot) * 10) / 10;
    const grandHc = Math.round((activeHc + retreadHc) * 10) / 10;
    const grandNetTot = Math.round((activeNetTot + retreadTot) * 10) / 10;

    return {
      activeNorm,
      activeOt,
      activeGrossTot,
      activeTot: activeGrossTot,
      activePdi,
      activeBead,
      activeNetTot,
      activeHc,
      retreadNorm,
      retreadOt,
      retreadTot,
      retreadHc,
      retreadGyHc: retreadArea?.gyHeadcount || 0,
      retreadContHc: retreadArea?.contractorHeadcount || 0,
      retreadGyTot: retreadArea?.gyTotalHours || 0,
      retreadContTot: retreadArea?.contractorTotalHours || 0,
      grandNorm,
      grandOt,
      grandGrossTot,
      grandTot: grandGrossTot,
      grandNetTot,
      grandHc
    };
  }, [activeAreaBreakdown]);

  const handleExportExcel = () => {
    if (!tonnageReport) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: OPAH KPI Summary (Daily & MTD)
    const summaryData = [
      { 'หัวข้อ (KPI)': 'วันที่ผลิต (Production Day)', 'ค่า': ohpaSummary.productionDay + ` (${ohpaSummary.monthlyStaff.dayName})` },
      { 'หัวข้อ (KPI)': 'พนักงานรวมทั้งโรงงาน (GY + Contractor + Monthly)', 'ค่า': ohpaSummary.totalEmployeesCount + ' คน' },
      { 'หัวข้อ (KPI)': '- พนักงานประจำ Goodyear (ไม่รวมแผนก 6320)', 'ค่า': ohpaSummary.gyEmployeesCount + ' คน (' + ohpaSummary.gyTotalHours.toLocaleString() + ' ชม.)' },
      { 'หัวข้อ (KPI)': '- พนักงานผู้รับเหมา Contractor WAS (ไม่รวมแผนก 6320)', 'ค่า': ohpaSummary.contractorEmployeesCount + ' คน (' + ohpaSummary.contractorTotalHours.toLocaleString() + ' ชม.)' },
      { 'หัวข้อ (KPI)': `- พนักงานรายเดือน (Monthly Staff: GY ${ohpaSummary.monthlyStaff.count} + WAS ${ohpaSummary.monthlyStaff.wasCount || 9} = ${ohpaSummary.monthlyStaff.combinedCount || 70} คน)`, 'ค่า': `${ohpaSummary.monthlyStaff.combinedCount || 70} คน (${(ohpaSummary.monthlyStaff.combinedTotalHours || (ohpaSummary.monthlyStaff.totalHours + (ohpaSummary.monthlyStaff.wasTotalHours || 0)))} ชม. @ ${ohpaSummary.monthlyStaff.hoursPerPerson} ชม./คน)` },
      { 'หัวข้อ (KPI)': '🚫 พนักงานแผนก 6320 ที่ตัดออก (GY + Cont)', 'ค่า': `${ohpaSummary.excluded6320GyCount + ohpaSummary.excluded6320ContCount} คน (${(ohpaSummary.excluded6320GyHours + ohpaSummary.excluded6320ContHours).toFixed(1)} ชม.)` },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงานปกติรวมทั้งสิ้น (รวมรายเดือน)', 'ค่า': ohpaSummary.totalNormalHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงาน OT รวมทั้งสิ้น', 'ค่า': ohpaSummary.totalOtHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงานฐานรวมทั้งโรงงาน (Total Plant Hours)', 'ค่า': ohpaSummary.totalWorkingHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': '🔻 Development + PDI Hours (Deduct)', 'ค่า': `-${ohpaSummary.pdiDeductHours.toLocaleString()} ชม.` },
      { 'หัวข้อ (KPI)': '🟢 B-end / Bead Hours (Add)', 'ค่า': `+${ohpaSummary.beadAddHours.toLocaleString()} ชม.` },
      { 'หัวข้อ (KPI)': '⭐ ชั่วโมงทำงานสุทธิที่ใช้คิด OPAH (Net OPAH Hours)', 'ค่า': `${ohpaSummary.opahWorkingHours.toLocaleString()} ชม.` },
      { 'หัวข้อ (KPI)': 'ยอด Stocking รวมประจำวัน (kg)', 'ค่า': ohpaSummary.totalTonnageKg.toLocaleString() + ' kg' },
      { 'หัวข้อ (KPI)': 'ยอด Stocking รวมประจำวัน (lbs = kg x 2.20462)', 'ค่า': ohpaSummary.totalTonnageLbs.toLocaleString() + ' lbs' },
      { 'หัวข้อ (KPI)': 'ยอดตันประจำวัน (Metric Tons)', 'ค่า': ohpaSummary.totalTonnageTon + ' Tons' },
      { 'หัวข้อ (KPI)': '⭐ Daily Overall Plant OPAH [(kg x 2.20462) / Net OPAH Hours]', 'ค่า': ohpaSummary.overallOpahLbsPerHour + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': '- Daily OPAH ส่วน Goodyear', 'ค่า': ohpaSummary.gyOpahLbsPerHour + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': '- Daily OPAH ส่วน Contractor', 'ค่า': ohpaSummary.contractorOpahLbsPerHour + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': '----------------------------------------', 'ค่า': '----------------------------------------' },
      { 'หัวข้อ (KPI)': `📈 MTD สะสม (วันที่ 1 ถึง ${ohpaSummary.mtd?.daysCount || 14})`, 'ค่า': `รวม ${ohpaSummary.mtd?.daysCount || 14} วัน` },
      { 'หัวข้อ (KPI)': '⭐ MTD Overall Plant OPAH', 'ค่า': (ohpaSummary.mtd?.mtdOpahLbsPerHour || 0) + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': 'MTD ชั่วโมงทำงานฐานรวมทั้งโรงงาน (Base Hours)', 'ค่า': (ohpaSummary.mtd?.mtdTotalHours.toLocaleString() || '0') + ' ชม.' },
      { 'หัวข้อ (KPI)': 'MTD 🔻 PDI Deduct สะสม', 'ค่า': `-${ohpaSummary.mtd?.mtdPdiDeductHours.toLocaleString() || '0'} ชม.` },
      { 'หัวข้อ (KPI)': 'MTD 🟢 B-end Bead Add สะสม', 'ค่า': `+${ohpaSummary.mtd?.mtdBeadAddHours.toLocaleString() || '0'} ชม.` },
      { 'หัวข้อ (KPI)': '⭐ MTD ชั่วโมงทำงานสุทธิคิด OPAH (Net OPAH Hours)', 'ค่า': `${ohpaSummary.mtd?.mtdOpahWorkingHours.toLocaleString() || '0'} ชม.` },
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

    // Sheet 4: Area Breakdown Daily (5 Production Areas)
    const areaDataDaily = (ohpaSummary.areaBreakdown || []).map(a => ({
      'พื้นที่ / กลุ่มโรงงาน (5 Areas)': a.areaName,
      'เป้าหมายกำลังพล Master (คน)': a.headcountStandard || '-',
      'สแกนนิ้วจริงรวม (คน)': a.totalHeadcount,
      'Goodyear (คน)': a.gyHeadcount,
      'Contractor (คน)': a.contractorHeadcount,
      'พนักงานรายเดือน (คน)': a.monthlyHeadcount || 0,
      'ชม.ปกติ (ชม.)': a.normalHours,
      'ชม. OT (ชม.)': a.otHours,
      'ชม.ฐานรวม (ชม.)': a.totalHours,
      '🔻 PDI Deduct (ชม.)': a.pdiDeductHours ? `-${a.pdiDeductHours}` : 0,
      '🟢 Bead Add (ชม.)': a.beadAddHours ? `+${a.beadAddHours}` : 0,
      '⭐ ชม.สุทธิคิด OPAH (ชม.)': a.finalOpahHours || a.totalHours,
      'รหัส Stocking 55012': a.areaTonnageCodes || '-',
      'ยอด Stocking (kg)': a.areaTonnageKg || 0,
      'ยอด Stocking (lbs)': a.areaTonnageLbs || 0,
      '🚀 Area OPAH (lbs/ชม.)': a.areaOpahLbsPerHour || '-',
      'สถานะ OPAH': a.isExcluded6320 ? 'ตัดออกจากการคำนวณ OPAH (6320)' : 'รวมใน OPAH (4 พื้นที่)',
      '% สัดส่วน OPAH': a.isExcluded6320 ? 'ตัดออกจาก OPAH' : a.percentageOfTotalHours + '%'
    }));
    const ws4 = XLSX.utils.json_to_sheet(areaDataDaily);
    XLSX.utils.book_append_sheet(wb, ws4, 'Area_Daily_5Areas');

    // Sheet 4.1: Area Breakdown MTD (5 Production Areas)
    if (ohpaSummary.mtd?.areaBreakdown && ohpaSummary.mtd.areaBreakdown.length > 0) {
      const areaDataMtd = ohpaSummary.mtd.areaBreakdown.map(a => ({
        'พื้นที่ / กลุ่มโรงงาน (5 Areas)': a.areaName,
        'เป้าหมายกำลังพล Master (คน)': a.headcountStandard || '-',
        'สแกนเฉลี่ย/วัน (คน)': a.totalHeadcount,
        'Goodyear เฉลี่ย (คน)': a.gyHeadcount,
        'Contractor เฉลี่ย (คน)': a.contractorHeadcount,
        'พนักงานรายเดือน เฉลี่ย (คน)': a.monthlyHeadcount || 0,
        'ชม.ปกติสะสม MTD (ชม.)': a.normalHours,
        'ชม. OT สะสม MTD (ชม.)': a.otHours,
        'ชม.ฐานรวมสะสม MTD (ชม.)': a.totalHours,
        '🔻 PDI Deduct MTD (ชม.)': a.pdiDeductHours ? `-${a.pdiDeductHours}` : 0,
        '🟢 Bead Add MTD (ชม.)': a.beadAddHours ? `+${a.beadAddHours}` : 0,
        '⭐ ชม.สุทธิ MTD (ชม.)': a.finalOpahHours || a.totalHours,
        'รหัส Stocking 55012': a.areaTonnageCodes || '-',
        'ยอด Stocking สะสม MTD (kg)': a.areaTonnageKg || 0,
        'ยอด Stocking สะสม MTD (lbs)': a.areaTonnageLbs || 0,
        '🚀 Area OPAH MTD (lbs/ชม.)': a.areaOpahLbsPerHour || '-',
        'สถานะ OPAH': a.isExcluded6320 ? 'ตัดออกจากการคำนวณ OPAH (6320)' : 'รวมใน OPAH (4 พื้นที่)',
        '% สัดส่วน MTD': a.isExcluded6320 ? 'ตัดออกจาก OPAH' : a.percentageOfTotalHours + '%'
      }));
      const ws4Mtd = XLSX.utils.json_to_sheet(areaDataMtd);
      XLSX.utils.book_append_sheet(wb, ws4Mtd, 'Area_MTD_5Areas');
    }

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
        'ชม. รวมฐานโรงงาน (ชม.)': item.totalHours,
        'PDI Deduct (ชม.)': -item.pdiDeductHours,
        'B-end Bead Add (ชม.)': item.beadAddHours,
        'ชม. สุทธิคิด OPAH (ชม.)': item.opahWorkingHours,
        'ชม. สะสมสุทธิ MTD (ชม.)': item.cumulativeOpahWorkingHours || item.cumulativeTotalHours
      }));
      const ws5 = XLSX.utils.json_to_sheet(mtdData);
      XLSX.utils.book_append_sheet(wb, ws5, 'MTD_Daily_Breakdown');
    }

    // Sheet 6: PDI & B-end Breakdown
    if (pdiBeadReport && pdiBeadReport.pdiPersons) {
      const pdiSheetData = pdiBeadReport.pdiPersons.map(p => {
        const rowObj: Record<string, any> = {
          'ชื่อพนักงาน': p.name,
          'กลุ่ม / ฝ่าย': p.group,
          'ตำแหน่ง / หน้าที่': p.desc,
        };
        for (let d = 1; d <= 31; d++) {
          rowObj[`วันที่ ${d}`] = p.dailyHours[d] || 0;
        }
        return rowObj;
      });
      const ws6 = XLSX.utils.json_to_sheet(pdiSheetData);
      XLSX.utils.book_append_sheet(wb, ws6, 'PDI_Deduct_Persons');
    }

    XLSX.writeFile(wb, 'OPAH_CAL_5Areas_Report_' + (ohpaSummary.productionDay || 'Date').replace(/\//g, '') + '.xlsx');
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
                + รายเดือน {ohpaSummary.monthlyStaff.combinedCount || 70} คน
              </span>
              <span className="bg-rose-100 text-rose-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-300/40">
                ตัดแผนก 6320 ออก
              </span>
              <span className="bg-amber-100 text-amber-900 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300/40">
                🔻 PDI (-{ohpaSummary.pdiDeductHours}h) &nbsp; 🟢 Bead (+{ohpaSummary.beadAddHours}h)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              คำนวณ OPAH = (Stocking kg × 2.20462) ÷ Net Working Hours [ฐานรวม - PDI ({ohpaSummary.pdiDeductHours} ชม.) + Bead ({ohpaSummary.beadAddHours} ชม.) = {ohpaSummary.opahWorkingHours} ชม.]
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

          <button
            onClick={() => setShowPdiDetail(!showPdiDetail)}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-amber-200"
            title="ดูรายละเอียด PDI Deduct & B-end Bead"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />
            <span>{showPdiDetail ? 'ซ่อนตาราง PDI/Bead' : 'ดูตาราง PDI/Bead'}</span>
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
          <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-amber-300 block mb-0.5">สูตรและเงื่อนไขการคำนวณ OPAH:</span>
            <div className="text-slate-300 space-y-0.5">
              <span>
                1. <strong>ตัดแผนก 6320 (Retread)</strong> ออกทั้ง GY ({ohpaSummary.excluded6320GyCount} คน) และ Cont ({ohpaSummary.excluded6320ContCount} คน) &nbsp;|&nbsp;
                2. <strong>รวมพนักงานรายเดือน {ohpaSummary.monthlyStaff.combinedCount || 70} คน</strong> ({ohpaSummary.monthlyStaff.dayName} คิด {ohpaSummary.monthlyStaff.hoursPerPerson} ชม./คน = +{ohpaSummary.monthlyStaff.combinedTotalHours || ohpaSummary.monthlyStaff.totalHours} ชม.)
              </span>
              <span className="block text-slate-200">
                3. <strong className="text-rose-400">🔻 หัก Development + PDI Hour (Deduct):</strong> -{ohpaSummary.pdiDeductHours} ชม. &nbsp;|&nbsp;
                4. <strong className="text-emerald-400">🟢 รวม B-end / Bead (Include):</strong> +{ohpaSummary.beadAddHours} ชม.
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 bg-white/10 p-2.5 px-3.5 rounded-xl text-[11px] font-mono shrink-0 border border-white/10">
          <div className="text-slate-300">
            ฐานรวม: <strong>{ohpaSummary.totalWorkingHours} ชม.</strong> - PDI <strong>({ohpaSummary.pdiDeductHours})</strong> + Bead <strong>(+{ohpaSummary.beadAddHours})</strong>
          </div>
          <div className="text-emerald-300 font-bold text-xs">
            = ชม. สุทธิคิด OPAH: <span className="text-amber-300 text-sm">{ohpaSummary.opahWorkingHours}</span> ชม.
          </div>
        </div>
      </div>

      {/* Collapsible PDI & B-end Bead Inspection Card */}
      {showPdiDetail && pdiBeadReport && (
        <div className="bg-amber-50/50 rounded-3xl p-5 border border-amber-200/80 shadow-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-700" />
              <div>
                <h3 className="text-sm font-bold text-amber-950">
                  รายละเอียดชั่วโมง PDI Deduct & B-end Bead ประจำเดือน ({pdiBeadReport.monthYear || '09/2026'})
                </h3>
                <p className="text-[11px] text-amber-800">
                  ไฟล์ต้นฉบับ: <code>OPAH hour PDI& B-ead.xlsx</code> (Development + PDI หักออก / B-end นำมาบวกเพิ่ม)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPdiDetail(false)}
              className="text-xs text-amber-800 hover:text-amber-950 font-bold cursor-pointer underline"
            >
              ปิดตาราง
            </button>
          </div>

          {/* PDI Engineers Table */}
          <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-amber-100/80 text-amber-950 font-bold text-[11px]">
                  <th className="py-2 px-3 font-sans min-w-[120px]">วิศวกร PDI / Dev</th>
                  <th className="py-2 px-2 font-sans min-w-[120px]">กลุ่ม / สังกัด</th>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <th
                      key={day}
                      className={`py-2 px-1 text-center w-8 ${
                        day === (ohpaSummary.mtd?.daysCount || 14) ? 'bg-amber-300 text-slate-950 font-black' : ''
                      }`}
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 font-sans text-xs">
                {(pdiBeadReport.pdiPersons || []).map((person, idx) => (
                  <tr key={person.name + idx} className="hover:bg-amber-50/40">
                    <td className="py-1.5 px-3 font-bold text-slate-900">{person.name}</td>
                    <td className="py-1.5 px-2 text-[11px] text-slate-500">{person.desc || person.group}</td>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                      const h = person.dailyHours[day] || 0;
                      return (
                        <td
                          key={day}
                          className={`py-1.5 px-1 text-center font-mono ${
                            day === (ohpaSummary.mtd?.daysCount || 14) ? 'bg-amber-50 font-bold text-rose-700' : ''
                          } ${h > 0 ? 'text-rose-600 font-bold' : 'text-slate-300'}`}
                        >
                          {h > 0 ? h : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Total PDI Deduct Row */}
                <tr className="bg-rose-50 text-rose-950 font-bold border-t-2 border-rose-200">
                  <td className="py-2 px-3 font-bold text-rose-900" colSpan={2}>
                    🔻 รวม PDI Deduct ประจำวัน (ชม.)
                  </td>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                    const total = pdiBeadReport.pdiDailyTotals[day] || 0;
                    return (
                      <td
                        key={day}
                        className={`py-2 px-1 text-center font-mono font-black ${
                          day === (ohpaSummary.mtd?.daysCount || 14) ? 'bg-rose-200 text-rose-950 text-sm' : ''
                        } ${total > 0 ? 'text-rose-700' : 'text-slate-300'}`}
                      >
                        {total > 0 ? `-${total}` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* Total B-end Bead Add Row */}
                <tr className="bg-emerald-50 text-emerald-950 font-bold border-t border-emerald-200">
                  <td className="py-2 px-3 font-bold text-emerald-900" colSpan={2}>
                    🟢 รวม B-end / Bead Add ประจำวัน (ชม.)
                  </td>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                    const total = pdiBeadReport.beadDailyTotals[day] || 0;
                    return (
                      <td
                        key={day}
                        className={`py-2 px-1 text-center font-mono font-black ${
                          day === (ohpaSummary.mtd?.daysCount || 14) ? 'bg-emerald-200 text-emerald-950 text-sm' : ''
                        } ${total > 0 ? 'text-emerald-700' : 'text-slate-300'}`}
                      >
                        {total > 0 ? `+${total.toFixed(0)}` : '-'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                สูตร: ({ohpaSummary.totalTonnageKg.toLocaleString()} kg × 2.20462) ÷ {ohpaSummary.opahWorkingHours.toLocaleString()} ชม. (สุทธิ) = <strong>{ohpaSummary.totalTonnageLbs.toLocaleString()} lbs</strong> ÷ {ohpaSummary.opahWorkingHours.toLocaleString()} ชม.
              </p>
            </div>
            <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs text-blue-100 z-10">
              <span>GY: <strong>{ohpaSummary.gyOpahLbsPerHour}</strong> | Cont: <strong>{ohpaSummary.contractorOpahLbsPerHour}</strong> lbs/ชม.</span>
              <span className="font-extrabold bg-white/20 px-2 py-0.5 rounded-lg">MTD: {ohpaSummary.mtd?.mtdOpahLbsPerHour || '-'} lbs/ชม.</span>
            </div>
          </div>

          {/* Card 2: Daily Net Working Hours */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                ชม.ทำงานสุทธิคิด OPAH (NET OPAH HOURS)
              </span>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
                  {ohpaSummary.opahWorkingHours.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-slate-500">ชม.</span>
                <span className="text-xs text-slate-400">
                  (จากฐาน {ohpaSummary.totalWorkingHours.toLocaleString()} ชม.)
                </span>
              </div>
              {/* Formula calculation badge */}
              <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-slate-100 text-xs">
                <div className="bg-rose-50 p-1.5 px-2 rounded-lg flex items-center justify-between">
                  <span className="text-rose-700 font-bold text-[11px]">🔻 PDI Deduct:</span>
                  <span className="font-mono font-black text-rose-800">-{ohpaSummary.pdiDeductHours} ชม.</span>
                </div>
                <div className="bg-emerald-50 p-1.5 px-2 rounded-lg flex items-center justify-between">
                  <span className="text-emerald-700 font-bold text-[11px]">🟢 Bead Add:</span>
                  <span className="font-mono font-black text-emerald-800">+{ohpaSummary.beadAddHours} ชม.</span>
                </div>
              </div>
              {/* 3 Breakdown Cards: GY, Contractor, Monthly */}
              <div className="grid grid-cols-3 gap-1.5 mt-1.5 text-xs">
                <div className="bg-blue-50/70 p-1.5 px-2 rounded-lg">
                  <span className="font-bold text-blue-900 text-[10px] block">GY: {ohpaSummary.gyTotalHours.toLocaleString()}h</span>
                </div>
                <div className="bg-teal-50/70 p-1.5 px-2 rounded-lg">
                  <span className="font-bold text-teal-900 text-[10px] block">Cont: {ohpaSummary.contractorTotalHours.toLocaleString()}h</span>
                </div>
                <div className="bg-purple-50/70 p-1.5 px-2 rounded-lg">
                  <span className="font-bold text-purple-900 text-[10px] block">รายเดือน: {(ohpaSummary.monthlyStaff.combinedTotalHours || (ohpaSummary.monthlyStaff.totalHours + (ohpaSummary.monthlyStaff.wasTotalHours || 0))).toLocaleString()}h</span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
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
                สูตร: ({ohpaSummary.mtd?.mtdStockingKg.toLocaleString()} kg × 2.20462) ÷ {ohpaSummary.mtd?.mtdOpahWorkingHours.toLocaleString()} ชม. (สุทธิ) = <strong>{ohpaSummary.mtd?.mtdStockingLbs.toLocaleString()} lbs</strong> ÷ {ohpaSummary.mtd?.mtdOpahWorkingHours.toLocaleString()} ชม.
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
                ชม.ทำงานสุทธิสะสม MTD (NET OPAH HOURS)
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl lg:text-5xl font-black text-indigo-950 tracking-tight">
                  {ohpaSummary.mtd?.mtdOpahWorkingHours.toLocaleString() || '0'}
                </span>
                <span className="text-sm font-bold text-slate-500">ชม.</span>
                <span className="text-xs text-slate-400">
                  (จากฐาน {ohpaSummary.mtd?.mtdTotalHours.toLocaleString()} ชม.)
                </span>
              </div>
              {/* Formula calculation badge for MTD */}
              <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-slate-100 text-xs">
                <div className="bg-rose-50 p-1.5 px-2 rounded-lg flex items-center justify-between">
                  <span className="text-rose-700 font-bold text-[11px]">🔻 MTD PDI Deduct:</span>
                  <span className="font-mono font-black text-rose-800">-{ohpaSummary.mtd?.mtdPdiDeductHours.toLocaleString()} ชม.</span>
                </div>
                <div className="bg-emerald-50 p-1.5 px-2 rounded-lg flex items-center justify-between">
                  <span className="text-emerald-700 font-bold text-[11px]">🟢 MTD Bead Add:</span>
                  <span className="font-mono font-black text-emerald-800">+{ohpaSummary.mtd?.mtdBeadAddHours.toLocaleString()} ชม.</span>
                </div>
              </div>
              {/* 3 Breakdown Cards: GY, Contractor, Monthly */}
              <div className="grid grid-cols-3 gap-1.5 mt-1.5 text-xs">
                <div className="bg-blue-50/70 p-1.5 px-2 rounded-lg">
                  <span className="font-bold text-blue-900 text-[10px] block">GY: {ohpaSummary.mtd?.mtdGyHours.toLocaleString()}h</span>
                </div>
                <div className="bg-teal-50/70 p-1.5 px-2 rounded-lg">
                  <span className="font-bold text-teal-900 text-[10px] block">Cont: {ohpaSummary.mtd?.mtdContractorHours.toLocaleString()}h</span>
                </div>
                <div className="bg-purple-50/70 p-1.5 px-2 rounded-lg">
                  <span className="font-bold text-purple-900 text-[10px] block">รายเดือน: {ohpaSummary.mtd?.mtdMonthlyHours.toLocaleString()}h</span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
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

      {/* MTD Daily Breakdown Table (Visible in MTD mode) */}
      {viewMode === 'MTD' && ohpaSummary.mtd?.dailyItems && (
        <div className="bg-white rounded-3xl border border-indigo-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-50/80 to-purple-50/50 border-b border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  ตารางสรุปชั่วโมงทำงานและยอดสะสมรายวัน (MTD Daily Breakdown: วันที่ 1 ถึง {ohpaSummary.mtd.daysCount}/09/2026)
                </h3>
                <p className="text-xs text-slate-500">
                  รวม Goodyear + Contractor + รายเดือน {ohpaSummary.monthlyStaff.combinedCount || 70} คน หัก PDI (-{ohpaSummary.mtd.mtdPdiDeductHours}h) และบวก Bead (+{ohpaSummary.mtd.mtdBeadAddHours}h)
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-indigo-700 bg-white px-3 py-1 rounded-lg border border-indigo-200">
              รวมสะสม {ohpaSummary.mtd.daysCount} วัน
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-700 font-bold">
                  <th className="py-3 px-3 text-center w-12 border-r border-slate-800">วันที่</th>
                  <th className="py-3 px-3 text-center border-r border-slate-800">วันในสัปดาห์</th>
                  <th className="py-3 px-3 text-right border-r border-slate-800">GY (คน / ชม.)</th>
                  <th className="py-3 px-3 text-right border-r border-slate-800">Cont (คน / ชม.)</th>
                  <th className="py-3 px-3 text-right border-r border-slate-800">รายเดือน (ชม.)</th>
                  <th className="py-3 px-3 text-right border-r border-slate-800 bg-slate-800">ชม.ฐานรวม</th>
                  <th className="py-3 px-3 text-right border-r border-slate-800 text-rose-300 bg-rose-950/60">🔻 PDI Deduct</th>
                  <th className="py-3 px-3 text-right border-r border-slate-800 text-emerald-300 bg-emerald-950/60">🟢 Bead Add</th>
                  <th className="py-3 px-3 text-right border-r border-slate-800 text-amber-300 bg-amber-950/70 font-black">⭐ ชม.สุทธิ OPAH</th>
                  <th className="py-3 px-3 text-right bg-indigo-950 text-indigo-200 font-black">ชม.สะสม MTD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {ohpaSummary.mtd.dailyItems.map((item) => {
                  const isCurrentDay = item.day === (ohpaSummary.mtd?.daysCount || 14);
                  return (
                    <tr
                      key={item.day}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCurrentDay ? 'bg-indigo-50/40 font-bold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-100">
                        {item.day}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 border-r border-slate-100">
                        {item.dayName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 border-r border-slate-100">
                        <span className="text-[11px] text-slate-400">({item.gyHeadcount})</span> {item.gyHours.toLocaleString()} ชม.
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 border-r border-slate-100">
                        <span className="text-[11px] text-slate-400">({item.contractorHeadcount})</span> {item.contractorHours.toLocaleString()} ชม.
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-purple-700 border-r border-slate-100">
                        {item.monthlyHours.toLocaleString()} ชม.
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-100 bg-slate-50/60">
                        {item.totalHours.toLocaleString()} ชม.
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 border-r border-slate-100 bg-rose-50/30">
                        {item.pdiDeductHours > 0 ? `-${item.pdiDeductHours} ชม.` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 border-r border-slate-100 bg-emerald-50/30">
                        {item.beadAddHours > 0 ? `+${item.beadAddHours.toFixed(1)} ชม.` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-amber-900 border-r border-slate-100 bg-amber-50/50">
                        {item.opahWorkingHours.toLocaleString()} ชม.
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-indigo-900 bg-indigo-50/60">
                        {(item.cumulativeOpahWorkingHours || item.cumulativeTotalHours).toLocaleString()} ชม.
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                  <td className="py-3 px-3 text-center" colSpan={2}>
                    รวม MTD สะสม {ohpaSummary.mtd.daysCount} วัน
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-blue-300">
                    {ohpaSummary.mtd.mtdGyHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-teal-300">
                    {ohpaSummary.mtd.mtdContractorHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-purple-300">
                    {ohpaSummary.mtd.mtdMonthlyHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300 bg-slate-800">
                    {ohpaSummary.mtd.mtdTotalHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-rose-300 bg-rose-950">
                    -{ohpaSummary.mtd.mtdPdiDeductHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-300 bg-emerald-950">
                    +{ohpaSummary.mtd.mtdBeadAddHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-amber-300 bg-amber-950 font-black text-sm">
                    {ohpaSummary.mtd.mtdOpahWorkingHours.toLocaleString()} ชม.
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400 bg-indigo-950 font-black text-sm">
                    {ohpaSummary.mtd.mtdOpahWorkingHours.toLocaleString()} ชม.
                  </td>
                </tr>
              </tfoot>
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

      {/* Area Working Hours & OT Summary (5 Production Areas) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                สรุปชั่วโมงทำงานและ OT แยกตาม 5 พื้นที่หลัก (5 Production Areas Breakdown)
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  viewMode === 'MTD'
                    ? 'bg-purple-100 text-purple-800 border-purple-300/60 font-bold'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                }`}>
                  {viewMode === 'MTD'
                    ? `สะสม MTD วันที่ 1 ถึง ${ohpaSummary.mtd?.daysCount || 14}/09 รวม ${ohpaSummary.mtd?.daysCount || 14} วัน`
                    : 'ข้อมูลประจำวัน (Daily)'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {viewMode === 'MTD' ? (
                  <span>
                    ยอดชั่วโมงและ OT <strong>สะสม MTD (วันที่ 1 ถึง ${ohpaSummary.mtd?.daysCount || 14}/09)</strong> จำแนกตาม 5 พื้นที่ Master: <strong>BCA (287)</strong>, <strong>Consumer (232)</strong>, <strong>Bias Aero (172)</strong>, <strong>Radial Aero (104)</strong> และ <strong>Retread (108)</strong> [เป้ารวมทั้งโรงงาน 901 คน]
                  </span>
                ) : (
                  <span>
                    จำแนกชั่วโมงทำงานและ OT ประจำวันตาม 5 พื้นที่ Master: <strong>BCA (287)</strong>, <strong>Consumer (232)</strong>, <strong>Bias Aero (172)</strong>, <strong>Radial Aero (104)</strong> และ <strong>Retread (108)</strong> [เป้ารวมทั้งโรงงาน 901 คน]
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                const allKeys = activeAreaBreakdown.map(a => a.areaKey);
                const isAllExpanded = allKeys.every(k => expandedAreas[k]);
                const nextState: Record<string, boolean> = {};
                allKeys.forEach(k => {
                  nextState[k] = !isAllExpanded;
                });
                setExpandedAreas(nextState);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>{Object.values(expandedAreas).some(Boolean) ? 'ย่อแผนกย่อยทั้งหมด' : 'ขยายแผนกย่อยทั้งหมด'}</span>
            </button>
          </div>
        </div>

        {/* 5 Area Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {activeAreaBreakdown.map((area) => {
            const isBCA = area.areaKey === 'BCA';
            const isConsumer = area.areaKey === 'Consumer';
            const isBiasAero = area.areaKey === 'Bias Aero';
            const isRadialAero = area.areaKey === 'Radial Aero';
            const isRetread = area.areaKey === 'Retread' || area.isExcluded6320;

            const cardBorder = isBCA
              ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
              : isConsumer
              ? 'border-blue-200 bg-blue-50/40 hover:bg-blue-50/70'
              : isBiasAero
              ? 'border-sky-200 bg-sky-50/40 hover:bg-sky-50/70'
              : isRadialAero
              ? 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70'
              : 'border-rose-200 bg-rose-50/30 hover:bg-rose-50/60';

            const badgeBg = isBCA
              ? 'bg-amber-500 text-white'
              : isConsumer
              ? 'bg-blue-600 text-white'
              : isBiasAero
              ? 'bg-sky-600 text-white'
              : isRadialAero
              ? 'bg-indigo-600 text-white'
              : 'bg-rose-600 text-white';

            const opahText = area.areaOpahLbsPerHour ? `${area.areaOpahLbsPerHour.toLocaleString()} lbs/ชม.` : '-';

            return (
              <div
                key={area.areaKey}
                onClick={() => toggleArea(area.areaKey)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs flex flex-col justify-between ${cardBorder}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1 gap-1">
                    <span className={`text-xs font-extrabold px-2 py-0.5 rounded-md truncate ${badgeBg}`} title={area.areaKey}>
                      {area.areaLabel}
                    </span>
                    {area.isExcluded6320 ? (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200">
                        ตัด 6320
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-slate-900 text-white truncate max-w-[110px]" title={area.areaTonnageCodes}>
                        {area.areaTonnageCodes || area.areaKey}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium">
                    เป้า Master: <strong className="text-slate-800">{area.headcountStandard || '-'} คน</strong>
                  </div>

                  {!area.isExcluded6320 ? (
                    <div className="my-2 p-2 bg-white/90 rounded-xl border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                        <span>OPAH ประจำพื้นที่:</span>
                        <span className="text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded">
                          {area.percentageOfTotalHours}%
                        </span>
                      </div>
                      <div className="text-xl font-black text-indigo-900 font-mono leading-tight mt-0.5">
                        {opahText}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-semibold truncate mt-1" title={`${area.areaTonnageKg?.toLocaleString()} kg (${area.areaTonnageLbs?.toLocaleString()} lbs)`}>
                        📦 {area.areaTonnageKg?.toLocaleString()} kg ({area.areaTonnageLbs?.toLocaleString()} lbs)
                      </div>
                    </div>
                  ) : (
                    <div className="my-2 p-2 bg-rose-50/80 rounded-xl border border-rose-200/80 text-[11px] text-rose-700 font-semibold">
                      🚫 ตัดออกจาก OPAH โรงงาน (แผนก 6320 หล่อดอก)
                    </div>
                  )}

                  <div className="text-sm font-black text-slate-900 font-mono leading-tight">
                    {(area.finalOpahHours || area.totalHours).toLocaleString()} <span className="text-xs font-sans font-normal text-slate-500">ชม.สุทธิ</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    (ฐาน: {area.totalHours.toLocaleString()} ชม.{area.beadAddHours ? ` +Bead ${area.beadAddHours}h` : ''}{area.pdiDeductHours ? ` -PDI ${area.pdiDeductHours}h` : ''})
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-xs">
                  <div className="flex items-center justify-between text-slate-600 font-mono">
                    <span>ปกติ: {area.normalHours.toLocaleString()}</span>
                    <span className="text-amber-700 font-bold">+{area.otHours.toLocaleString()}</span>
                  </div>
                  <div className="text-slate-500 mt-1 text-[11px] truncate" title={`GY ${area.gyHeadcount} | Cont ${area.contractorHeadcount}${area.monthlyHeadcount ? ` | รายเดือน ${area.monthlyHeadcount}` : ''}`}>
                    {viewMode === 'MTD' ? 'เฉลี่ย: ' : 'สแกน: '}<strong>{area.totalHeadcount} คน</strong> (GY {area.gyHeadcount} / Cont {area.contractorHeadcount})
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Area Table (5 Production Areas) */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                <th className="py-3 px-4 min-w-[240px]">
                  พื้นที่ / กลุ่มโรงงาน (5 Production Areas) - {viewMode === 'MTD' ? `สะสม MTD (${ohpaSummary.mtd?.daysCount || 14} วัน)` : 'ประจำวัน'}
                </th>
                <th className="py-3 px-2.5 text-center w-20">เป้า Master</th>
                <th className="py-3 px-3 text-center">
                  {viewMode === 'MTD' ? 'สแกนเฉลี่ย/วัน (Headcount)' : 'สแกนจริงรวม (Headcount)'}
                </th>
                <th className="py-3 px-2.5 text-right bg-slate-800/80">
                  {viewMode === 'MTD' ? 'ชม.ปกติสะสม' : 'ชม.ปกติ'}
                </th>
                <th className="py-3 px-2.5 text-right bg-amber-950/60 text-amber-300">
                  {viewMode === 'MTD' ? 'ชม. OT สะสม' : 'ชม. OT'}
                </th>
                <th className="py-3 px-2.5 text-right bg-slate-800/90 text-slate-200">
                  {viewMode === 'MTD' ? 'ชม.ฐานรวม' : 'ชม.ฐานรวม'}
                </th>
                <th className="py-3 px-2.5 text-right bg-rose-950/60 text-rose-300">
                  🔻 PDI หัก
                </th>
                <th className="py-3 px-2.5 text-right bg-emerald-950/60 text-emerald-300">
                  🟢 Bead บวก
                </th>
                <th className="py-3 px-3 text-right bg-indigo-950/80 text-indigo-200 font-black">
                  ⭐ ชม.สุทธิ
                </th>
                <th className="py-3 px-3 text-right bg-emerald-950/80 text-emerald-200 font-bold min-w-[150px]">
                  📦 Stocking 55012
                </th>
                <th className="py-3 px-3 text-right bg-purple-950/80 text-purple-200 font-black min-w-[120px]">
                  🚀 Area OPAH
                </th>
                <th className="py-3 px-3 text-right min-w-[100px]">% สัดส่วน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeAreaBreakdown.map((area) => {
                const isExpanded = Boolean(expandedAreas[area.areaKey]);
                const isBCA = area.areaKey === 'BCA';
                const isConsumer = area.areaKey === 'Consumer';
                const isBiasAero = area.areaKey === 'Bias Aero';
                const isRadialAero = area.areaKey === 'Radial Aero';
                const isRetread = area.areaKey === 'Retread' || area.isExcluded6320;

                const progressColor = isBCA
                  ? 'bg-amber-500'
                  : isConsumer
                  ? 'bg-blue-600'
                  : isBiasAero
                  ? 'bg-sky-500'
                  : isRadialAero
                  ? 'bg-indigo-600'
                  : 'bg-rose-500';

                const rowBg = isExpanded
                  ? 'bg-slate-50/80'
                  : isBCA
                  ? 'hover:bg-amber-50/30'
                  : isConsumer
                  ? 'hover:bg-blue-50/30'
                  : isBiasAero
                  ? 'hover:bg-sky-50/30'
                  : isRadialAero
                  ? 'hover:bg-indigo-50/30'
                  : 'hover:bg-rose-50/30 bg-rose-50/15';

                const iconElem = isBCA ? (
                  <Factory className="w-4 h-4 text-amber-600 shrink-0" />
                ) : isConsumer ? (
                  <Car className="w-4 h-4 text-blue-600 shrink-0" />
                ) : isBiasAero ? (
                  <Plane className="w-4 h-4 text-sky-600 shrink-0" />
                ) : isRadialAero ? (
                  <Plane className="w-4 h-4 text-indigo-600 shrink-0" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-rose-600 shrink-0" />
                );

                return (
                  <React.Fragment key={area.areaKey}>
                    {/* Area Primary Row */}
                    <tr
                      onClick={() => toggleArea(area.areaKey)}
                      className={`transition-colors cursor-pointer ${rowBg}`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                            title={isExpanded ? 'ย่อรายละเอียด' : 'คลิกเพื่อดูรายละเอียดแผนกย่อย'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <div className="p-1.5 rounded-lg bg-white shadow-2xs border border-slate-200">
                            {iconElem}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900">{area.areaKey}</span>
                              {area.isExcluded6320 && (
                                <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.2 rounded border border-rose-200">
                                  ตัดออกจาก OPAH (6320)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-normal">
                              {area.areaName}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Standard Master Headcount */}
                      <td className="py-3 px-2.5 text-center font-bold text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold text-xs">
                          {area.headcountStandard ? `${area.headcountStandard} คน` : '-'}
                        </span>
                      </td>

                      {/* Actual Scanned Headcount */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-white font-black text-xs ${
                            area.isExcluded6320 ? 'bg-rose-700' : 'bg-slate-900'
                          }`}>
                            {area.totalHeadcount} คน
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            GY {area.gyHeadcount} | Cont {area.contractorHeadcount}
                            {area.monthlyHeadcount ? ` | รายเดือน ${area.monthlyHeadcount}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Normal Hours */}
                      <td className="py-3 px-2.5 text-right font-mono font-semibold text-slate-700 bg-slate-50/50">
                        {area.normalHours.toLocaleString()} ชม.
                      </td>

                      {/* OT Hours */}
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-amber-700 bg-amber-50/40">
                        +{area.otHours.toLocaleString()} ชม.
                      </td>

                      {/* Gross Base Hours */}
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-slate-900 bg-slate-100/50">
                        {area.totalHours.toLocaleString()} ชม.
                      </td>

                      {/* PDI Deduct */}
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-rose-700 bg-rose-50/30">
                        {area.pdiDeductHours && area.pdiDeductHours > 0 ? `-${area.pdiDeductHours} ชม.` : '-'}
                      </td>

                      {/* Bead Add */}
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                        {area.beadAddHours && area.beadAddHours > 0 ? `+${area.beadAddHours.toFixed(1)} ชม.` : '-'}
                      </td>

                      {/* Final Net OPAH Hours */}
                      <td className="py-3 px-3 text-right font-mono font-black text-sm text-indigo-950 bg-indigo-50/40">
                        {(area.finalOpahHours || area.totalHours).toLocaleString()} ชม.
                      </td>

                      {/* Stocking Tonnage 55012 */}
                      <td className="py-3 px-3 text-right font-mono bg-emerald-50/40">
                        {area.isExcluded6320 ? (
                          <span className="text-slate-400 text-[11px]">-</span>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {area.areaTonnageKg?.toLocaleString()} kg
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal">
                              {area.areaTonnageLbs?.toLocaleString()} lbs <span className="text-[9px] bg-emerald-200/70 text-emerald-950 px-1 py-0.2 rounded font-bold">{area.areaTonnageCodes}</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Area OPAH (lbs/ชม.) */}
                      <td className="py-3 px-3 text-right font-mono bg-purple-50/50">
                        {area.isExcluded6320 ? (
                          <span className="text-slate-400 text-[11px]">-</span>
                        ) : (
                          <div>
                            <span className="font-black text-purple-900 text-sm">
                              {area.areaOpahLbsPerHour ? area.areaOpahLbsPerHour.toLocaleString() : '-'}
                            </span>
                            <span className="text-[10px] text-slate-400 block">lbs/ชม.</span>
                          </div>
                        )}
                      </td>

                      {/* % Contribution */}
                      <td className="py-3 px-3 text-right">
                        {area.isExcluded6320 ? (
                          <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            ไม่นับใน OPAH
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 bg-slate-200 rounded-full h-2 overflow-hidden shadow-2xs">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${progressColor}`}
                                style={{ width: `${Math.min(100, area.percentageOfTotalHours)}%` }}
                              ></div>
                            </div>
                            <span className="font-mono font-black text-slate-900 text-xs w-10 text-right">
                              {area.percentageOfTotalHours}%
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Sub-departments table */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-y border-slate-200">
                        <td colSpan={12} className="py-3 px-6 sm:px-10">
                          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">
                              <span>รายละเอียดหน่วยงานย่อยในกลุ่ม: {area.areaName} ({viewMode === 'MTD' ? `สะสม ${ohpaSummary.mtd?.daysCount || 14} วัน` : 'ประจำวัน'})</span>
                              <span className="text-slate-400 font-normal">ทั้งหมด {area.departments.length} รายการ</span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="text-slate-500 font-bold border-b border-slate-100 text-[11px]">
                                    <th className="py-1.5 px-3">แผนก / Cost Center / สังกัด / การจัดสรร</th>
                                    <th className="py-1.5 px-3 text-center">ประเภท</th>
                                    <th className="py-1.5 px-3 text-center">{viewMode === 'MTD' ? 'เฉลี่ยคน/วัน' : 'จำนวนคนสแกน'}</th>
                                    <th className="py-1.5 px-3 text-right">ชม.ปกติ</th>
                                    <th className="py-1.5 px-3 text-right">ชม. OT</th>
                                    <th className="py-1.5 px-3 text-right font-black">ชม.รวม</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-sans">
                                  {area.departments.map((sub, sIdx) => (
                                    <tr key={sub.dept + sIdx} className="hover:bg-slate-50/80">
                                      <td className="py-1.5 px-3 font-medium text-slate-800 flex items-center gap-2">
                                        {sub.isBead ? (
                                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        ) : sub.dept.includes('PDI') ? (
                                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        ) : sub.isMonthly ? (
                                          <Briefcase className={`w-3.5 h-3.5 ${sub.isContractor ? 'text-teal-600' : 'text-purple-600'} shrink-0`} />
                                        ) : sub.isContractor ? (
                                          <HardHat className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                        ) : (
                                          <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        )}
                                        <span>{sub.dept}</span>
                                      </td>
                                      <td className="py-1.5 px-3 text-center">
                                        <span className={`px-2 py-0.2 rounded-full font-bold text-[10px] ${
                                          sub.isBead
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : sub.dept.includes('PDI')
                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                            : sub.isMonthly && sub.isContractor
                                            ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                            : sub.isMonthly
                                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                            : sub.isContractor
                                            ? 'bg-teal-100 text-teal-800'
                                            : 'bg-blue-100 text-blue-800'
                                        }`}>
                                          {sub.isBead ? 'Bead (+)' : sub.dept.includes('PDI') ? 'PDI (-)' : sub.isMonthly ? (sub.isContractor ? 'WAS Monthly' : 'Salaries Monthly') : sub.isContractor ? 'Contractor' : 'Goodyear'}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-3 text-center font-bold text-slate-700">
                                        {sub.headcount > 0 ? `${sub.headcount} คน` : '-'}
                                      </td>
                                      <td className="py-1.5 px-3 text-right text-slate-600 font-mono">
                                        {sub.normalHours.toLocaleString()}
                                      </td>
                                      <td className="py-1.5 px-3 text-right font-mono font-bold text-amber-600">
                                        {sub.otHours > 0 ? `+${sub.otHours.toLocaleString()}` : '-'}
                                      </td>
                                      <td className="py-1.5 px-3 text-right font-mono font-black text-slate-900">
                                        {sub.totalHours.toLocaleString()} ชม.
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Row 1: OPAH Active Total (4 Production Areas: BCA, Consumer, Bias Aero, Radial Aero) */}
              <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-sm">
                <td className="py-3 px-4 flex items-center gap-2 text-white">
                  <div className="p-1 rounded-md bg-emerald-500 text-slate-950 font-black text-xs">
                    OPAH
                  </div>
                  <div>
                    <span className="text-emerald-300 font-bold">
                      {viewMode === 'MTD'
                        ? `ยอดรวม 4 พื้นที่การผลิตคิด OPAH (MTD สะสม ${ohpaSummary.mtd?.daysCount || 14} วัน)`
                        : 'ยอดรวม 4 พื้นที่การผลิตคิด OPAH (Active 4 Areas: BCA, Consumer, Bias, Radial)'}
                    </span>
                    <span className="text-[11px] font-normal text-slate-400 block">
                      {viewMode === 'MTD'
                        ? `(รวม 4 พื้นที่หลัก MTD สะสม ${ohpaSummary.mtd?.daysCount || 14} วัน GY + Cont + รายเดือน โดยตัดแผนก 6320 ออก)`
                        : '(รวม 4 พื้นที่หลัก GY + Cont + รายเดือน โดยตัดแผนก 6320 ออก พร้อมปรับยอด PDI/Bead)'}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-2.5 text-center text-slate-300 font-mono text-xs">
                  793 คน
                </td>
                <td className="py-3 px-3 text-center text-white font-mono font-bold">
                  {areaActiveStats.activeHc} คน
                </td>
                <td className="py-3 px-2.5 text-right text-slate-200 font-mono bg-slate-800/80">
                  {areaActiveStats.activeNorm.toLocaleString()} ชม.
                </td>
                <td className="py-3 px-2.5 text-right text-amber-300 font-mono bg-amber-950/80">
                  +{areaActiveStats.activeOt.toLocaleString()} ชม.
                </td>
                <td className="py-3 px-2.5 text-right text-slate-200 font-mono bg-slate-800">
                  {areaActiveStats.activeGrossTot.toLocaleString()} ชม.
                </td>
                <td className="py-3 px-2.5 text-right text-rose-300 font-mono bg-rose-950">
                  {areaActiveStats.activePdi > 0 ? `-${areaActiveStats.activePdi.toLocaleString()} ชม.` : '-'}
                </td>
                <td className="py-3 px-2.5 text-right text-emerald-300 font-mono bg-emerald-950">
                  {areaActiveStats.activeBead > 0 ? `+${areaActiveStats.activeBead.toLocaleString()} ชม.` : '-'}
                </td>
                <td className="py-3 px-3 text-right text-emerald-300 font-mono bg-emerald-950/80 text-base">
                  {areaActiveStats.activeNetTot.toLocaleString()} ชม.
                </td>
                <td className="py-3 px-3 text-right font-mono bg-emerald-950/90 text-emerald-200 font-bold">
                  {viewMode === 'MTD' ? (ohpaSummary.mtd?.mtdStockingKg.toLocaleString() || '0') : ohpaSummary.totalTonnageKg.toLocaleString()} kg
                  <span className="block text-[10px] text-emerald-400 font-normal">
                    ({viewMode === 'MTD' ? (ohpaSummary.mtd?.mtdStockingLbs.toLocaleString() || '0') : ohpaSummary.totalTonnageLbs.toLocaleString()} lbs)
                  </span>
                </td>
                <td className="py-3 px-3 text-right font-mono bg-purple-950/90 text-purple-200 font-black text-sm">
                  {viewMode === 'MTD' ? (ohpaSummary.mtd?.mtdOpahLbsPerHour || '-') : ohpaSummary.overallOpahLbsPerHour}
                  <span className="block text-[10px] text-purple-300/80 font-normal">lbs/ชม.</span>
                </td>
                <td className="py-3 px-3 text-right text-emerald-400 font-mono text-xs font-black">
                  100.0%
                </td>
              </tr>

              {/* Row 2: Retread 6320 Excluded Stats */}
              {(areaActiveStats.retreadHc > 0 || areaActiveStats.retreadTot > 0) && (
                <tr className="bg-rose-950/80 text-rose-200 font-bold border-t border-rose-800/50 text-xs">
                  <td className="py-2.5 px-4 flex items-center gap-2">
                    <div className="p-0.5 px-1.5 rounded bg-rose-500 text-white font-black text-[10px]">
                      EXCLUDED
                    </div>
                    <div>
                      <span>🚫 ส่วนงานหล่อดอกยาง แผนก 6320 (ตัดออกจาก OPAH โรงงาน)</span>
                      <span className="text-[10px] text-rose-300/80 block">
                        (GY {areaActiveStats.retreadGyHc} คน: {areaActiveStats.retreadGyTot.toLocaleString()} ชม. | Cont {areaActiveStats.retreadContHc} คน: {areaActiveStats.retreadContTot.toLocaleString()} ชม.)
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 text-center text-rose-300 font-mono">
                    108 คน
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    {areaActiveStats.retreadHc} คน
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono">
                    {areaActiveStats.retreadNorm.toLocaleString()} ชม.
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-amber-300">
                    +{areaActiveStats.retreadOt.toLocaleString()} ชม.
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-rose-300 font-black">
                    {areaActiveStats.retreadTot.toLocaleString()} ชม.
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-right font-mono text-rose-300 font-black">
                    {areaActiveStats.retreadTot.toLocaleString()} ชม.
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-3 text-right text-rose-400 font-mono text-[11px]">
                    (ไม่นับใน OPAH)
                  </td>
                </tr>
              )}

              {/* Row 3: All-Plant Grand Total (All 5 Areas, including 6320) */}
              <tr className="bg-slate-950 text-white font-black border-t-2 border-slate-800 text-xs">
                <td className="py-3 px-4 flex items-center gap-2">
                  <div className="p-1 rounded-md bg-amber-400 text-slate-950 font-black text-xs">
                    GRAND TOTAL
                  </div>
                  <div>
                    <span>
                      {viewMode === 'MTD'
                        ? `ยอดรวมทั้งสิ้นทั้งโรงงาน MTD สะสม (${ohpaSummary.mtd?.daysCount || 14} วัน)`
                        : 'ยอดรวมทั้งสิ้นทั้งโรงงาน (รวม 5 พื้นที่ Master 100%)'}
                    </span>
                    <span className="text-[10px] font-normal text-slate-400 block">
                      (รวม 5 พื้นที่: BCA + Consumer + Bias Aero + Radial Aero + Retread)
                    </span>
                  </div>
                </td>
                <td className="py-3 px-2.5 text-center text-slate-300 font-mono">
                  901 คน
                </td>
                <td className="py-3 px-3 text-center text-amber-300 font-mono font-black">
                  {areaActiveStats.grandHc} คน
                </td>
                <td className="py-3 px-2.5 text-right text-slate-300 font-mono">
                  {areaActiveStats.grandNorm.toLocaleString()} ชม.
                </td>
                <td className="py-3 px-2.5 text-right text-amber-300 font-mono">
                  +{areaActiveStats.grandOt.toLocaleString()} ชม.
                </td>
                <td className="py-3 px-2.5 text-right text-slate-300 font-mono font-bold">
                  {areaActiveStats.grandGrossTot.toLocaleString()} ชม.
                </td>
                <td className="py-3 px-2.5 text-right text-rose-300 font-mono">
                  {areaActiveStats.activePdi > 0 ? `-${areaActiveStats.activePdi.toLocaleString()} ชม.` : '-'}
                </td>
                <td className="py-3 px-2.5 text-right text-emerald-300 font-mono">
                  {areaActiveStats.activeBead > 0 ? `+${areaActiveStats.activeBead.toLocaleString()} ชม.` : '-'}
                </td>
                <td className="py-3 px-3 text-right text-amber-300 font-mono font-black text-sm">
                  {areaActiveStats.grandNetTot.toLocaleString()} ชม.
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-400">
                  -
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-400">
                  -
                </td>
                <td className="py-3 px-3 text-right text-slate-400 font-mono">
                  -
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
