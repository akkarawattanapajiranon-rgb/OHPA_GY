import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ParsedShiftRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { StockingTonnageReport, OhpaAreaMetrics } from '../types/ohpa';
import { PdiBeadReport, DEFAULT_PDI_BEAD_REPORT } from '../data/default_pdi_bead';
import { calculateOhpaSummary } from '../utils/ohpaCalculator';
import { buildRawEmployeeRecords, exportTeamRawDataExcel } from '../utils/rawExportHelper';
import {
  Calculator,
  RefreshCw,
  RotateCcw,
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
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [isSyncingPdi, setIsSyncingPdi] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSyncPdiBead = async () => {
    setIsSyncingPdi(true);
    setSyncStatus(null);
    try {
      const res = await fetch('/api/sync-pdi-bead');
      const data = await res.json();
      if (data.success) {
        setSyncStatus({
          type: 'success',
          message: data.message || 'ซิงค์ข้อมูล PDI & Bead & BCA สำเร็จ'
        });
      } else {
        setSyncStatus({
          type: 'error',
          message: data.message || 'เกิดข้อผิดพลาดในการซิงค์ข้อมูล PDI & Bead'
        });
      }
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'ไม่สามารถเชื่อมต่อ API ซิงค์ PDI & Bead ได้'
      });
    } finally {
      setIsSyncingPdi(false);
    }
  };

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
    const activeBcaRed = Math.round(activeAreas.reduce((s, a) => s + (a.bcaReductionHours || 0), 0) * 10) / 10;
    const activeBcaDev = Math.round(activeAreas.reduce((s, a) => s + (a.bcaDevHours || 0), 0) * 10) / 10;
    const activeNetTot = Math.round(activeAreas.reduce((s, a) => s + (a.finalOpahHours ?? (a.totalHours - (a.pdiDeductHours || 0) + (a.beadAddHours || 0))), 0) * 10) / 10;

    const retreadNorm = Math.round((retreadArea?.normalHours || 0) * 10) / 10;
    const retreadOt = Math.round((retreadArea?.otHours || 0) * 10) / 10;
    const retreadTot = Math.round((retreadArea?.totalHours || 0) * 10) / 10;
    const retreadHc = Math.round((retreadArea?.totalHeadcount || 0) * 10) / 10;
    const retreadReceived = Math.round((retreadArea?.retreadReceivedHours || 0) * 10) / 10;
    const retreadNetTot = Math.round((retreadArea?.finalOpahHours ?? (retreadTot + retreadReceived)) * 10) / 10;

    const grandNorm = Math.round((activeNorm + retreadNorm) * 10) / 10;
    const grandOt = Math.round((activeOt + retreadOt) * 10) / 10;
    const grandGrossTot = Math.round((activeGrossTot + retreadTot) * 10) / 10;
    const grandHc = Math.round((activeHc + retreadHc) * 10) / 10;
    const grandNetTot = Math.round((activeNetTot + retreadNetTot) * 10) / 10;

    return {
      activeNorm,
      activeOt,
      activeGrossTot,
      activeTot: activeGrossTot,
      activePdi,
      activeBead,
      activeBcaRed,
      activeBcaDev,
      activeNetTot,
      activeHc,
      retreadNorm,
      retreadOt,
      retreadTot,
      retreadHc,
      retreadReceived,
      retreadNetTot,
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

    // Helper to calculate Total Aviation (Bias Aero + Radial Aero) from an area breakdown list
    const calcAviationFromBreakdown = (breakdown: OhpaAreaMetrics[] = []) => {
      const bias = breakdown.find(x => x.areaKey === 'Bias Aero' || x.areaName.toLowerCase().includes('bias'));
      const radial = breakdown.find(x => x.areaKey === 'Radial Aero' || x.areaName.toLowerCase().includes('radial'));

      const gyHc = Math.round(((bias?.gyHeadcount || 0) + (radial?.gyHeadcount || 0)) * 10) / 10;
      const contHc = Math.round(((bias?.contractorHeadcount || 0) + (radial?.contractorHeadcount || 0)) * 10) / 10;
      const monthlyHc = Math.round(((bias?.monthlyHeadcount || 0) + (radial?.monthlyHeadcount || 0)) * 10) / 10;
      const totHc = Math.round(((bias?.totalHeadcount || 0) + (radial?.totalHeadcount || 0)) * 10) / 10;

      const normalH = Math.round(((bias?.normalHours || 0) + (radial?.normalHours || 0)) * 10) / 10;
      const otH = Math.round(((bias?.otHours || 0) + (radial?.otHours || 0)) * 10) / 10;
      const totH = Math.round(((bias?.totalHours || 0) + (radial?.totalHours || 0)) * 10) / 10;
      const gyTotH = Math.round(((bias?.gyTotalHours || 0) + (radial?.gyTotalHours || 0)) * 10) / 10;
      const contTotH = Math.round(((bias?.contractorTotalHours || 0) + (radial?.contractorTotalHours || 0)) * 10) / 10;
      const monthlyH = Math.round(((bias?.monthlyHours || 0) + (radial?.monthlyHours || 0)) * 10) / 10;

      const pdiH = Math.round(((bias?.pdiDeductHours || 0) + (radial?.pdiDeductHours || 0)) * 10) / 10;
      const netH = Math.round(((bias?.finalOpahHours ?? bias?.totalHours ?? 0) + (radial?.finalOpahHours ?? radial?.totalHours ?? 0)) * 10) / 10;

      const kg = Math.round(((bias?.areaTonnageKg || 0) + (radial?.areaTonnageKg || 0)) * 100) / 100;
      const lbs = Math.round(((bias?.areaTonnageLbs || 0) + (radial?.areaTonnageLbs || 0)) * 100) / 100;
      const opah = (netH > 0 && kg > 0) ? Math.round(((kg * 2.20462) / netH) * 100) / 100 : '-';
      const pct = Math.round(((bias?.percentageOfTotalHours || 0) + (radial?.percentageOfTotalHours || 0)) * 10) / 10;

      return {
        bias,
        radial,
        totHc,
        gyHc,
        contHc,
        monthlyHc,
        normalH,
        otH,
        totH,
        gyTotH,
        contTotH,
        monthlyH,
        pdiH,
        netH,
        kg,
        lbs,
        opah,
        pct
      };
    };

    const dailyAv = calcAviationFromBreakdown(ohpaSummary.areaBreakdown);
    const mtdAv = calcAviationFromBreakdown(ohpaSummary.mtd?.areaBreakdown);

    // Sheet 1: OPAH KPI Summary (Daily & MTD)
    const summaryData = [
      { 'หัวข้อ (KPI)': 'วันที่ผลิต (Production Day)', 'ค่า': ohpaSummary.productionDay + ` (${ohpaSummary.monthlyStaff.dayName})` },
      { 'หัวข้อ (KPI)': 'พนักงานรวมทั้งโรงงาน (GY + Contractor + Monthly)', 'ค่า': ohpaSummary.totalEmployeesCount + ' คน' },
      { 'หัวข้อ (KPI)': '- พนักงานประจำ Goodyear (ไม่รวมแผนก 6320)', 'ค่า': ohpaSummary.gyEmployeesCount + ' คน (' + ohpaSummary.gyTotalHours.toLocaleString() + ' ชม.)' },
      { 'หัวข้อ (KPI)': '- พนักงานผู้รับเหมา Contractor WAS (ไม่รวมแผนก 6320)', 'ค่า': ohpaSummary.contractorEmployeesCount + ' คน (' + ohpaSummary.contractorTotalHours.toLocaleString() + ' ชม.)' },
      { 'หัวข้อ (KPI)': `- พนักงานรายเดือน (Monthly Staff: GY ${ohpaSummary.monthlyStaff.count} + WAS ${ohpaSummary.monthlyStaff.wasCount || 9} = ${ohpaSummary.monthlyStaff.combinedCount || 71} คน)`, 'ค่า': `${ohpaSummary.monthlyStaff.combinedCount || 71} คน (${(ohpaSummary.monthlyStaff.combinedTotalHours || (ohpaSummary.monthlyStaff.totalHours + (ohpaSummary.monthlyStaff.wasTotalHours || 0)))} ชม. @ ${ohpaSummary.monthlyStaff.hoursPerPerson} ชม./คน)` },
      { 'หัวข้อ (KPI)': '🚫 พนักงานแผนก 6320 ที่ตัดออก (GY + Cont)', 'ค่า': `${Math.round((ohpaSummary.excluded6320GyCount + ohpaSummary.excluded6320ContCount) * 10) / 10} คน (${(ohpaSummary.excluded6320GyHours + ohpaSummary.excluded6320ContHours).toFixed(1)} ชม.)` },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงานปกติรวมทั้งสิ้น (รวมรายเดือน)', 'ค่า': ohpaSummary.totalNormalHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงาน OT รวมทั้งสิ้น', 'ค่า': ohpaSummary.totalOtHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': 'ชั่วโมงทำงานฐานรวมทั้งโรงงาน (Total Plant Hours)', 'ค่า': ohpaSummary.totalWorkingHours.toLocaleString() + ' ชม.' },
      { 'หัวข้อ (KPI)': '🔻 Development + PDI Hours (Deduct)', 'ค่า': `-${ohpaSummary.pdiDeductHours.toLocaleString()} ชม.` },
      { 'หัวข้อ (KPI)': '🟢 B-end / Bead Hours (Add)', 'ค่า': `+${ohpaSummary.beadAddHours.toLocaleString()} ชม.` },
      { 'หัวข้อ (KPI)': '🔻 BCA Reduction for Retread (Deduct from BCA, Add to Retread)', 'ค่า': `-${(ohpaSummary.bcaReductionHours || 0).toLocaleString()} ชม.` },
      { 'หัวข้อ (KPI)': '🔻 BCA DEV Compound (Deduct from BCA)', 'ค่า': `-${(ohpaSummary.bcaDevHours || 0).toLocaleString()} ชม.` },
      { 'หัวข้อ (KPI)': '⭐ ชั่วโมงทำงานสุทธิที่ใช้คิด OPAH (Net OPAH Hours)', 'ค่า': `${ohpaSummary.opahWorkingHours.toLocaleString()} ชม.` },
      { 'หัวข้อ (KPI)': 'ยอด Stocking รวมประจำวัน (kg)', 'ค่า': ohpaSummary.totalTonnageKg.toLocaleString() + ' kg' },
      { 'หัวข้อ (KPI)': 'ยอด Stocking รวมประจำวัน (lbs = kg x 2.20462)', 'ค่า': ohpaSummary.totalTonnageLbs.toLocaleString() + ' lbs' },
      { 'หัวข้อ (KPI)': 'ยอดตันประจำวัน (Metric Tons)', 'ค่า': ohpaSummary.totalTonnageTon + ' Tons' },
      { 'หัวข้อ (KPI)': '⭐ Daily Overall Plant OPAH [(kg x 2.20462) / Net OPAH Hours]', 'ค่า': ohpaSummary.overallOpahLbsPerHour + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': '- Daily OPAH ส่วน Goodyear', 'ค่า': ohpaSummary.gyOpahLbsPerHour + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': '- Daily OPAH ส่วน Contractor', 'ค่า': ohpaSummary.contractorOpahLbsPerHour + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': '⭐ Daily Total Aviation OPAH (Bias + Radial Aero)', 'ค่า': dailyAv.opah !== '-' ? `${dailyAv.opah} lbs/ชม.` : '-' },
      { 'หัวข้อ (KPI)': '- Daily Total Aviation Hours (Net OPAH)', 'ค่า': `${dailyAv.netH.toLocaleString()} ชม.` },
      { 'หัวข้อ (KPI)': '- Daily Total Aviation Stocking (CODE A+B+6)', 'ค่า': `${dailyAv.kg.toLocaleString()} kg (${dailyAv.lbs.toLocaleString()} lbs)` },
      { 'หัวข้อ (KPI)': '----------------------------------------', 'ค่า': '----------------------------------------' },
      { 'หัวข้อ (KPI)': `📈 MTD สะสม (วันที่ 1 ถึง ${ohpaSummary.mtd?.daysCount || 14})`, 'ค่า': `รวม ${ohpaSummary.mtd?.daysCount || 14} วัน` },
      { 'หัวข้อ (KPI)': '⭐ MTD Overall Plant OPAH', 'ค่า': (ohpaSummary.mtd?.mtdOpahLbsPerHour || 0) + ' lbs/ชม.' },
      { 'หัวข้อ (KPI)': '⭐ MTD Total Aviation OPAH (Bias + Radial Aero)', 'ค่า': mtdAv.opah !== '-' ? `${mtdAv.opah} lbs/ชม.` : '-' },
      { 'หัวข้อ (KPI)': '- MTD Total Aviation Hours (Net OPAH)', 'ค่า': `${mtdAv.netH.toLocaleString()} ชม.` },
      { 'หัวข้อ (KPI)': '- MTD Total Aviation Stocking (CODE A+B+6)', 'ค่า': `${mtdAv.kg.toLocaleString()} kg (${mtdAv.lbs.toLocaleString()} lbs)` },
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

    // Sheet 2: Daily Trend Plant (OPAH & Working Hours)
    const dailyItems = ohpaSummary.mtd?.dailyItems || [];
    if (dailyItems.length > 0) {
      const dailyTrendPlantData = dailyItems.map(item => ({
        'วันที่ (Date)': item.dateStr,
        'วันในสัปดาห์': item.dayName,
        'GY กำลังพล (คน)': item.gyHeadcount,
        'GY ชั่วโมงทำงาน (ชม.)': item.gyHours,
        'Cont กำลังพล (คน)': item.contractorHeadcount,
        'Cont ชั่วโมงทำงาน (ชม.)': item.contractorHours,
        'พนักงานรายเดือน (ชม.)': item.monthlyHours,
        'ชั่วโมงทำงานฐานรวมทั้งโรงงาน (Base Hours)': item.totalHours,
        '🔻 PDI Deduct (ชม.)': -item.pdiDeductHours,
        '🟢 Bead Add (ชม.)': item.beadAddHours,
        '🔻 BCA โอนให้ Retread (ชม.)': -(item.bcaReductionHours || 0),
        '🔻 BCA DEV หักออก (ชม.)': -(item.bcaDevHours || 0),
        '⭐ ชั่วโมงสุทธิคิด OPAH (Net OPAH Hours)': item.opahWorkingHours,
        'ยอด Stocking รวม (kg)': item.stockingKg || 0,
        'ยอด Stocking รวม (lbs)': item.stockingLbs || 0,
        '🚀 Daily Plant OPAH (lbs/ชม.)': item.dailyOpahLbsPerHour || ohpaSummary.overallOpahLbsPerHour,
        'ชั่วโมงสะสมสุทธิ MTD (ชม.)': item.cumulativeOpahWorkingHours || item.cumulativeTotalHours,
        '📈 MTD Cumulative Plant OPAH (lbs/ชม.)': item.cumulativeOpahLbsPerHour || (ohpaSummary.mtd?.mtdOpahLbsPerHour || 0)
      }));
      const wsTrendPlant = XLSX.utils.json_to_sheet(dailyTrendPlantData);
      XLSX.utils.book_append_sheet(wb, wsTrendPlant, 'Daily_Trend_Plant');

      // Sheet 3: Daily Trend By Team / Area (OPAH & Working Hours)
      const dailyTrendByTeamData: any[] = [];
      dailyItems.forEach(item => {
        (item.areaBreakdown || []).forEach(a => {
          dailyTrendByTeamData.push({
            'วันที่ (Date)': item.dateStr,
            'วันในสัปดาห์': item.dayName,
            'ทีม / พื้นที่การผลิต (Team / Area)': a.areaName,
            'สถานะการคิด OPAH': a.isExcluded6320 ? 'ตัดออกจากการคำนวณ OPAH (6320)' : 'รวมใน OPAH (4 พื้นที่หลัก)',
            'เป้าหมาย Master (คน)': a.headcountStandard || '-',
            'สแกนนิ้วรวม (คน)': a.totalHeadcount,
            'Goodyear (คน)': a.gyHeadcount,
            'Contractor (คน)': a.contractorHeadcount,
            'พนักงานรายเดือน (คน)': a.monthlyHeadcount || 0,
            'ชม. ปกติ (ชม.)': a.normalHours,
            'ชม. OT (ชม.)': a.otHours,
            'ชม. ทำงานฐานรวม (ชม.)': a.totalHours,
            'Goodyear ชม.รวม (ชม.)': a.gyTotalHours,
            'Contractor ชม.รวม (ชม.)': a.contractorTotalHours,
            'พนักงานรายเดือน ชม.รวม (ชม.)': a.monthlyHours || 0,
            '🔻 PDI Deduct (ชม.)': a.pdiDeductHours ? `-${a.pdiDeductHours}` : 0,
            '🟢 Bead Add (ชม.)': a.beadAddHours ? `+${a.beadAddHours}` : 0,
            '🔄 BCA หักโอนสะสม (ชม.)': a.bcaReductionHours ? `-${a.bcaReductionHours}` : 0,
            '🧪 BCA DEV หักออก (ชม.)': a.bcaDevHours ? `-${a.bcaDevHours}` : 0,
            '📥 Retread รับโอน (ชม.)': a.retreadReceivedHours ? `+${a.retreadReceivedHours}` : 0,
            '⭐ ชม. สุทธิคิด OPAH (Net OPAH Hours)': a.finalOpahHours ?? a.totalHours,
            'รหัส Stocking 55012': a.areaTonnageCodes || '-',
            'ยอด Stocking (kg)': a.areaTonnageKg || 0,
            'ยอด Stocking (lbs)': a.areaTonnageLbs || 0,
            '🚀 Team OPAH (lbs/ชม.)': a.areaOpahLbsPerHour ?? '-'
          });
        });

        // Add summary row for Total Aviation (Bias Aero + Radial Aero) for this day
        const dayAv = calcAviationFromBreakdown(item.areaBreakdown);
        dailyTrendByTeamData.push({
          'วันที่ (Date)': item.dateStr,
          'วันในสัปดาห์': item.dayName,
          'ทีม / พื้นที่การผลิต (Team / Area)': '⭐ Total Aviation (Bias + Radial Aero)',
          'สถานะการคิด OPAH': 'รวมใน OPAH (Aero Combined)',
          'เป้าหมาย Master (คน)': (typeof dayAv.bias?.headcountStandard === 'number' && typeof dayAv.radial?.headcountStandard === 'number') ? (dayAv.bias.headcountStandard + dayAv.radial.headcountStandard) : '-',
          'สแกนนิ้วรวม (คน)': dayAv.totHc,
          'Goodyear (คน)': dayAv.gyHc,
          'Contractor (คน)': dayAv.contHc,
          'พนักงานรายเดือน (คน)': dayAv.monthlyHc || 0,
          'ชม. ปกติ (ชม.)': dayAv.normalH,
          'ชม. OT (ชม.)': dayAv.otH,
          'ชม. ทำงานฐานรวม (ชม.)': dayAv.totH,
          'Goodyear ชม.รวม (ชม.)': dayAv.gyTotH,
          'Contractor ชม.รวม (ชม.)': dayAv.contTotH,
          'พนักงานรายเดือน ชม.รวม (ชม.)': dayAv.monthlyH || 0,
          '🔻 PDI Deduct (ชม.)': dayAv.pdiH ? `-${dayAv.pdiH}` : 0,
          '🟢 Bead Add (ชม.)': 0,
          '🔄 BCA หักโอนสะสม (ชม.)': 0,
          '🧪 BCA DEV หักออก (ชม.)': 0,
          '📥 Retread รับโอน (ชม.)': 0,
          '⭐ ชม. สุทธิคิด OPAH (Net OPAH Hours)': dayAv.netH,
          'รหัส Stocking 55012': 'CODE A + B + 6',
          'ยอด Stocking (kg)': dayAv.kg,
          'ยอด Stocking (lbs)': dayAv.lbs,
          '🚀 Team OPAH (lbs/ชม.)': dayAv.opah
        });
      });
      const wsTrendTeam = XLSX.utils.json_to_sheet(dailyTrendByTeamData);
      XLSX.utils.book_append_sheet(wb, wsTrendTeam, 'Daily_Trend_By_Team');

      // Sheet 4: Daily Trend Matrix - Working Hours (Pivot format)
      const matrixHoursData = dailyItems.map(item => {
        const getAreaH = (key: string) => {
          const a = (item.areaBreakdown || []).find(x => x.areaKey === key || x.areaName.toLowerCase().includes(key.toLowerCase()));
          return a ? (a.finalOpahHours ?? a.totalHours) : 0;
        };
        const getAreaBaseH = (key: string) => {
          const a = (item.areaBreakdown || []).find(x => x.areaKey === key || x.areaName.toLowerCase().includes(key.toLowerCase()));
          return a ? a.totalHours : 0;
        };
        const dayAv = calcAviationFromBreakdown(item.areaBreakdown);
        return {
          'วันที่ (Date)': item.dateStr,
          'วันในสัปดาห์': item.dayName,
          'BCA (ชม.)': getAreaH('BCA'),
          'Consumer (ชม.)': getAreaH('Consumer'),
          '⭐ Total Aviation (ชม.)': dayAv.netH,
          'Bias Aero (ชม.)': getAreaH('Bias Aero'),
          'Radial Aero (ชม.)': getAreaH('Radial Aero'),
          'Retread (ชม.)': getAreaH('Retread'),
          'Non-MFG 6320 (ชม.)': getAreaBaseH('Non-MFG'),
          'ชั่วโมงฐานรวมทั้งโรงงาน (Base Hours)': item.totalHours,
          '🔻 PDI Deduct (ชม.)': -item.pdiDeductHours,
          '🟢 Bead Add (ชม.)': item.beadAddHours,
          '🔻 BCA โอนให้ Retread (ชม.)': -(item.bcaReductionHours || 0),
          '🔻 BCA DEV (ชม.)': -(item.bcaDevHours || 0),
          '⭐ ชั่วโมงสุทธิคิด OPAH โรงงาน (Net OPAH Hours)': item.opahWorkingHours,
          'ชม. สะสมสุทธิ MTD (ชม.)': item.cumulativeOpahWorkingHours || item.cumulativeTotalHours
        };
      });
      const wsMatrixHours = XLSX.utils.json_to_sheet(matrixHoursData);
      XLSX.utils.book_append_sheet(wb, wsMatrixHours, 'Daily_Trend_Matrix_Hours');

      // Sheet 5: Daily Trend Matrix - OPAH (Pivot format)
      const matrixOpahData = dailyItems.map(item => {
        const getAreaOpah = (key: string) => {
          const a = (item.areaBreakdown || []).find(x => x.areaKey === key || x.areaName.toLowerCase().includes(key.toLowerCase()));
          return a?.areaOpahLbsPerHour ?? '-';
        };
        const dayAv = calcAviationFromBreakdown(item.areaBreakdown);
        return {
          'วันที่ (Date)': item.dateStr,
          'วันในสัปดาห์': item.dayName,
          'BCA OPAH (lbs/ชม.)': getAreaOpah('BCA'),
          'Consumer OPAH (lbs/ชม.)': getAreaOpah('Consumer'),
          '⭐ Total Aviation OPAH (lbs/ชม.)': dayAv.opah,
          'Bias Aero OPAH (lbs/ชม.)': getAreaOpah('Bias Aero'),
          'Radial Aero OPAH (lbs/ชม.)': getAreaOpah('Radial Aero'),
          'Retread OPAH (lbs/ชม.)': getAreaOpah('Retread'),
          'ยอด Stocking รวมโรงงาน (kg)': item.stockingKg || 0,
          'ยอด Stocking รวมโรงงาน (lbs)': item.stockingLbs || 0,
          '🚀 Daily Plant OPAH (lbs/ชม.)': item.dailyOpahLbsPerHour || (ohpaSummary.overallOpahLbsPerHour),
          '📈 MTD Cumulative Plant OPAH (lbs/ชม.)': item.cumulativeOpahLbsPerHour || (ohpaSummary.mtd?.mtdOpahLbsPerHour || 0)
        };
      });
      const wsMatrixOpah = XLSX.utils.json_to_sheet(matrixOpahData);
      XLSX.utils.book_append_sheet(wb, wsMatrixOpah, 'Daily_Trend_Matrix_OPAH');
    }

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
      '🔄 BCA หักโอนให้ Retread (ชม.)': a.bcaReductionHours ? `-${a.bcaReductionHours}` : 0,
      '🧪 BCA DEV หักออก (ชม.)': a.bcaDevHours ? `-${a.bcaDevHours}` : 0,
      '📥 Retread รับโอนจาก BCA (ชม.)': a.retreadReceivedHours ? `+${a.retreadReceivedHours}` : 0,
      '⭐ ชม.สุทธิคิด OPAH (ชม.)': a.finalOpahHours || a.totalHours,
      'รหัส Stocking 55012': a.areaTonnageCodes || '-',
      'ยอด Stocking (kg)': a.areaTonnageKg || 0,
      'ยอด Stocking (lbs)': a.areaTonnageLbs || 0,
      '🚀 Area OPAH (lbs/ชม.)': a.areaOpahLbsPerHour || '-',
      'สถานะ OPAH': a.isExcluded6320 ? 'ตัดออกจากการคำนวณ OPAH (6320)' : 'รวมใน OPAH (4 พื้นที่)',
      '% สัดส่วน OPAH': a.isExcluded6320 ? 'ตัดออกจาก OPAH' : a.percentageOfTotalHours + '%'
    }));

    // Add Total Aviation summary row to Area Breakdown Daily
    areaDataDaily.push({
      'พื้นที่ / กลุ่มโรงงาน (5 Areas)': '⭐ Total Aviation (Bias + Radial Aero)',
      'เป้าหมายกำลังพล Master (คน)': (typeof dailyAv.bias?.headcountStandard === 'number' && typeof dailyAv.radial?.headcountStandard === 'number') ? (dailyAv.bias.headcountStandard + dailyAv.radial.headcountStandard) : '-',
      'สแกนนิ้วจริงรวม (คน)': dailyAv.totHc,
      'Goodyear (คน)': dailyAv.gyHc,
      'Contractor (คน)': dailyAv.contHc,
      'พนักงานรายเดือน (คน)': dailyAv.monthlyHc || 0,
      'ชม.ปกติ (ชม.)': dailyAv.normalH,
      'ชม. OT (ชม.)': dailyAv.otH,
      'ชม.ฐานรวม (ชม.)': dailyAv.totH,
      '🔻 PDI Deduct (ชม.)': dailyAv.pdiH ? `-${dailyAv.pdiH}` : 0,
      '🟢 Bead Add (ชม.)': 0,
      '🔄 BCA หักโอนให้ Retread (ชม.)': 0,
      '🧪 BCA DEV หักออก (ชม.)': 0,
      '📥 Retread รับโอนจาก BCA (ชม.)': 0,
      '⭐ ชม.สุทธิคิด OPAH (ชม.)': dailyAv.netH,
      'รหัส Stocking 55012': 'CODE A + B + 6',
      'ยอด Stocking (kg)': dailyAv.kg,
      'ยอด Stocking (lbs)': dailyAv.lbs,
      '🚀 Area OPAH (lbs/ชม.)': dailyAv.opah,
      'สถานะ OPAH': 'รวมใน OPAH (Aero Combined)',
      '% สัดส่วน OPAH': dailyAv.pct + '%'
    });

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
        '🔄 BCA หักโอนสะสม MTD (ชม.)': a.bcaReductionHours ? `-${a.bcaReductionHours}` : 0,
        '🧪 BCA DEV สะสม MTD (ชม.)': a.bcaDevHours ? `-${a.bcaDevHours}` : 0,
        '📥 Retread รับโอนสะสม MTD (ชม.)': a.retreadReceivedHours ? `+${a.retreadReceivedHours}` : 0,
        '⭐ ชม.สุทธิ MTD (ชม.)': a.finalOpahHours || a.totalHours,
        'รหัส Stocking 55012': a.areaTonnageCodes || '-',
        'ยอด Stocking สะสม MTD (kg)': a.areaTonnageKg || 0,
        'ยอด Stocking สะสม MTD (lbs)': a.areaTonnageLbs || 0,
        '🚀 Area OPAH MTD (lbs/ชม.)': a.areaOpahLbsPerHour || '-',
        'สถานะ OPAH': a.isExcluded6320 ? 'ตัดออกจากการคำนวณ OPAH (6320)' : 'รวมใน OPAH (4 พื้นที่)',
        '% สัดส่วน MTD': a.isExcluded6320 ? 'ตัดออกจาก OPAH' : a.percentageOfTotalHours + '%'
      }));

      // Add Total Aviation summary row to Area Breakdown MTD
      areaDataMtd.push({
        'พื้นที่ / กลุ่มโรงงาน (5 Areas)': '⭐ Total Aviation (Bias + Radial Aero)',
        'เป้าหมายกำลังพล Master (คน)': (typeof mtdAv.bias?.headcountStandard === 'number' && typeof mtdAv.radial?.headcountStandard === 'number') ? (mtdAv.bias.headcountStandard + mtdAv.radial.headcountStandard) : '-',
        'สแกนเฉลี่ย/วัน (คน)': mtdAv.totHc,
        'Goodyear เฉลี่ย (คน)': mtdAv.gyHc,
        'Contractor เฉลี่ย (คน)': mtdAv.contHc,
        'พนักงานรายเดือน เฉลี่ย (คน)': mtdAv.monthlyHc || 0,
        'ชม.ปกติสะสม MTD (ชม.)': mtdAv.normalH,
        'ชม. OT สะสม MTD (ชม.)': mtdAv.otH,
        'ชม.ฐานรวมสะสม MTD (ชม.)': mtdAv.totH,
        '🔻 PDI Deduct MTD (ชม.)': mtdAv.pdiH ? `-${mtdAv.pdiH}` : 0,
        '🟢 Bead Add MTD (ชม.)': 0,
        '🔄 BCA หักโอนสะสม MTD (ชม.)': 0,
        '🧪 BCA DEV สะสม MTD (ชม.)': 0,
        '📥 Retread รับโอนสะสม MTD (ชม.)': 0,
        '⭐ ชม.สุทธิ MTD (ชม.)': mtdAv.netH,
        'รหัส Stocking 55012': 'CODE A + B + 6',
        'ยอด Stocking สะสม MTD (kg)': mtdAv.kg,
        'ยอด Stocking สะสม MTD (lbs)': mtdAv.lbs,
        '🚀 Area OPAH MTD (lbs/ชม.)': mtdAv.opah,
        'สถานะ OPAH': 'รวมใน OPAH (Aero Combined)',
        '% สัดส่วน MTD': mtdAv.pct + '%'
      });

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
        'BCA โอนให้ Retread (ชม.)': -(item.bcaReductionHours || 0),
        'BCA DEV (ชม.)': -(item.bcaDevHours || 0),
        'ชม. สุทธิคิด OPAH (ชม.)': item.opahWorkingHours,
        'ชม. สะสมสุทธิ MTD (ชม.)': item.cumulativeOpahWorkingHours || item.cumulativeTotalHours
      }));
      const ws5 = XLSX.utils.json_to_sheet(mtdData);
      XLSX.utils.book_append_sheet(wb, ws5, 'MTD_Daily_Breakdown');
    }

    // Sheet 6: PDI & B-end Breakdown
    if (pdiBeadReport) {
      const pdiSheetData = (pdiBeadReport.pdiPersons || []).map(p => {
        const rowObj: Record<string, any> = {
          'รายการ / พนักงาน': p.name,
          'กลุ่ม / ฝ่าย': p.group,
          'ตำแหน่ง / หน้าที่': p.desc,
        };
        for (let d = 1; d <= 31; d++) {
          rowObj[`วันที่ ${d}`] = p.dailyHours[d] || 0;
        }
        return rowObj;
      });

      // Add BCA Reduction row
      if (pdiBeadReport.bcaReductionDailyHours) {
        const bcaRow: Record<string, any> = {
          'รายการ / พนักงาน': 'Total (Reduction for BCA)',
          'กลุ่ม / ฝ่าย': 'BCA -> Retread (โอนชั่วโมง)',
          'ตำแหน่ง / หน้าที่': 'Compound + Cement + Kamol RT27',
        };
        for (let d = 1; d <= 31; d++) {
          bcaRow[`วันที่ ${d}`] = pdiBeadReport.bcaReductionDailyHours[d] || 0;
        }
        pdiSheetData.push(bcaRow);
      }

      // Add BCA DEV row
      if (pdiBeadReport.bcaDevDailyHours) {
        const devRow: Record<string, any> = {
          'รายการ / พนักงาน': 'DEV (For BCA)',
          'กลุ่ม / ฝ่าย': 'BCA Development (หักออก)',
          'ตำแหน่ง / หน้าที่': 'KANT Compound DEV',
        };
        for (let d = 1; d <= 31; d++) {
          devRow[`วันที่ ${d}`] = pdiBeadReport.bcaDevDailyHours[d] || 0;
        }
        pdiSheetData.push(devRow);
      }

      const ws6 = XLSX.utils.json_to_sheet(pdiSheetData);
      XLSX.utils.book_append_sheet(wb, ws6, 'PDI_Bead_BCA_Adjustments');
    }

    // Sheet 7: Team Summary Matrix & Raw Employee Attendance Data
    const { rows: rawRows, teamSummary } = buildRawEmployeeRecords(
      records,
      contractorRecords,
      employeeMapping,
      ohpaSummary.productionDay
    );

    const formatRow = (r: any, index: number) => ({
      'ลำดับ': index + 1,
      'รหัสพนักงาน': r.empId,
      'ชื่อ-นามสกุล (ไทย)': r.nameTH,
      'ชื่อภาษาอังกฤษ (EN)': r.nameEN,
      'ประเภทพนักงาน': r.empType,
      'พื้นที่หลัก (5 Production Areas)': r.areaKey,
      'ชื่อพื้นที่ / กลุ่มโรงงาน': r.areaName,
      'รหัสปิดรอบ (Closing / CC)': r.closingCode,
      'แผนก / Cost Center': r.department,
      'ตำแหน่งงาน (Position)': r.position,
      'เครื่องจักร (Machine)': r.machine,
      'กะการทำงาน (Shift)': r.shift,
      'เวลาสแกนเข้า (IN)': r.inTime,
      'เวลาสแกนออก (OUT)': r.outTime,
      'ชม. ปกติ (Normal Hours)': r.normalHours,
      'ชม. OT (OT Hours)': r.otHours,
      'ชม. ทำงานรวม (Total Hours)': r.totalHours,
      'ชม. สุทธิคิด OPAH': r.netOpahHours,
      'นับใน OPAH โรงงาน': r.isIncludedInPlantOpah,
      'สถานะการสแกน': r.scanStatus,
      'หมายเหตุ OT / อื่นๆ': r.otNote,
    });

    // Sheet 7: Team Summary Matrix
    const wsSummaryMatrix = XLSX.utils.json_to_sheet(teamSummary.map((s, idx) => ({
      'ลำดับ': idx + 1,
      'พื้นที่ (5 Production Areas)': s.areaKey,
      'ชื่อกลุ่มโรงงาน': s.areaName,
      'เป้าหมาย Master (คน)': s.targetHc,
      'สแกนจริงรวม (คน)': s.actualTotalHc,
      'Goodyear (คน)': s.gyHc,
      'Contractor (คน)': s.contHc,
      'ชม. ปกติรวม (ชม.)': s.normalHours,
      'ชม. OT รวม (ชม.)': s.otHours,
      'ชม. ทำงานรวมทั้งหมด (ชม.)': s.totalHours,
      'ชม. สุทธิคิด OPAH (ชม.)': s.netOpahHours,
      'สถานะการคิด OPAH': s.isExcluded,
    })));
    XLSX.utils.book_append_sheet(wb, wsSummaryMatrix, 'Team_Summary_Matrix');

    // Sheet 8: Raw All Employees (Every single person)
    const wsRawAll = XLSX.utils.json_to_sheet(rawRows.map(formatRow));
    XLSX.utils.book_append_sheet(wb, wsRawAll, 'Raw_All_Employees');

    // Sub-sheets 9-13: Per-team individual sheets
    const areaKeys = ['BCA', 'Consumer', 'Bias Aero', 'Radial Aero', 'Retread'];
    areaKeys.forEach(key => {
      const teamRecords = rawRows.filter(r => r.areaKey === key);
      if (teamRecords.length > 0) {
        const wsTeam = XLSX.utils.json_to_sheet(teamRecords.map(formatRow));
        const safeName = `Team_${key.replace(/\s+/g, '_')}`;
        XLSX.utils.book_append_sheet(wb, wsTeam, safeName);
      }
    });

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
                + รายเดือน {ohpaSummary.monthlyStaff.combinedCount || 71} คน
              </span>
              <span className="bg-rose-100 text-rose-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-rose-300/40">
                ตัดแผนก 6320 ออก
              </span>
              <span className="bg-amber-100 text-amber-900 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300/40">
                🔻 PDI (-{ohpaSummary.pdiDeductHours}h) &nbsp; 🟢 Bead (+{ohpaSummary.beadAddHours}h)
                {ohpaSummary.bcaReductionHours ? ` | 🔄 โอน BCA→Retread (-${ohpaSummary.bcaReductionHours}h)` : ''}
                {ohpaSummary.bcaDevHours ? ` | 🧪 BCA DEV (-${ohpaSummary.bcaDevHours}h)` : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              คำนวณ OPAH = (Stocking kg × 2.20462) ÷ Net Working Hours [ฐานรวม - PDI ({ohpaSummary.pdiDeductHours} ชม.) + Bead ({ohpaSummary.beadAddHours} ชม.){ohpaSummary.bcaReductionHours ? ` - BCA โอน (${ohpaSummary.bcaReductionHours} ชม.)` : ''}{ohpaSummary.bcaDevHours ? ` - BCA DEV (${ohpaSummary.bcaDevHours} ชม.)` : ''} = {ohpaSummary.opahWorkingHours} ชม.]
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
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ตามไฟล์สแกน</span>
          </button>

          {/* Sync PDI & Bead Button */}
          <button
            onClick={handleSyncPdiBead}
            disabled={isSyncingPdi}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="อ่านไฟล์ OPAH hour PDI& B-ead.xlsx และอัปเดตชั่วโมงหัก/บวก และ BCA Reduction อัตโนมัติ"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isSyncingPdi ? 'animate-spin' : ''}`} />
            <span>{isSyncingPdi ? 'กำลังซิงค์...' : 'ซิงค์ PDI / Bead / BCA'}</span>
          </button>

          {/* Toggle PDI / Bead Table */}
          <button
            onClick={() => setShowPdiDetail(!showPdiDetail)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              showPdiDetail
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white hover:bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{showPdiDetail ? 'ซ่อนตาราง PDI/BCA' : 'ดูตาราง PDI/Bead/BCA'}</span>
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

          {/* Export Group */}
          <div className="relative inline-block text-left">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="ส่งออกรายงานสรุป OPAH พร้อม Raw Data ครบทุกชีท"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ส่งออก Excel ทั้งหมด</span>
              </button>

              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-2.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="เลือกส่งออก Raw Data รายคน & แยกทีม"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dropdown Menu for Team Raw Data */}
            {showExportMenu && (
              <div
                className="origin-top-right absolute right-0 mt-2 w-64 rounded-2xl shadow-xl bg-white ring-1 ring-black/5 divide-y divide-slate-100 z-50 animate-fadeIn"
                onClick={() => setShowExportMenu(false)}
              >
                <div className="p-2">
                  <div className="text-[11px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                    ส่งออก Raw Data & Team Allocation
                  </div>
                  <button
                    onClick={() =>
                      exportTeamRawDataExcel(
                        records,
                        contractorRecords,
                        employeeMapping,
                        ohpaSummary.productionDay,
                        'ALL'
                      )
                    }
                    className="w-full text-left px-2.5 py-2 text-xs font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>📥 ครบทุกทีม (All Teams แยกแท็บ)</span>
                  </button>
                </div>

                <div className="p-2 space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-0.5">
                    เลือกเฉพาะทีม (Specific Team):
                  </div>
                  {[
                    { key: 'BCA', label: '🏭 ทีม BCA (287 คน)' },
                    { key: 'Consumer', label: '🚗 ทีม Consumer (232 คน)' },
                    { key: 'Bias Aero', label: '✈️ ทีม Bias Aero (172 คน)' },
                    { key: 'Radial Aero', label: '🛫 ทีม Radial Aero (104 คน)' },
                    { key: 'Retread', label: '🔄 ทีม Retread (108 คน - 6320)' },
                  ].map((team) => (
                    <button
                      key={team.key}
                      onClick={() =>
                        exportTeamRawDataExcel(
                          records,
                          contractorRecords,
                          employeeMapping,
                          ohpaSummary.productionDay,
                          team.key
                        )
                      }
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>{team.label}</span>
                      <Download className="w-3 h-3 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className={`p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 border animate-fadeIn ${
          syncStatus.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-2">
            {syncStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{syncStatus.message}</span>
          </div>
          <button
            onClick={() => setSyncStatus(null)}
            className="text-[11px] font-bold underline cursor-pointer hover:opacity-80"
          >
            ปิด
          </button>
        </div>
      )}

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
                2. <strong>รวมพนักงานรายเดือน {ohpaSummary.monthlyStaff.combinedCount || 71} คน</strong> ({ohpaSummary.monthlyStaff.dayName} คิด {ohpaSummary.monthlyStaff.hoursPerPerson} ชม./คน = +{ohpaSummary.monthlyStaff.combinedTotalHours || ohpaSummary.monthlyStaff.totalHours} ชม.)
              </span>
              <span className="block text-slate-200">
                3. <strong className="text-rose-400">🔻 หัก Development + PDI Hour (Deduct):</strong> -{ohpaSummary.pdiDeductHours} ชม. &nbsp;|&nbsp;
                4. <strong className="text-emerald-400">🟢 รวม B-end / Bead (Include):</strong> +{ohpaSummary.beadAddHours} ชม. &nbsp;|&nbsp;
                5. <strong className="text-amber-400">🔄 หัก BCA โอนให้ Retread:</strong> -{ohpaSummary.bcaReductionHours || 0} ชม. (และไปบวกใน Retread) &nbsp;|&nbsp;
                6. <strong className="text-purple-400">🧪 หัก BCA DEV:</strong> -{ohpaSummary.bcaDevHours || 0} ชม.
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 bg-white/10 p-2.5 px-3.5 rounded-xl text-[11px] font-mono shrink-0 border border-white/10">
          <div className="text-slate-300">
            ฐานรวม: <strong>{ohpaSummary.totalWorkingHours} ชม.</strong> - PDI <strong>({ohpaSummary.pdiDeductHours})</strong> + Bead <strong>(+{ohpaSummary.beadAddHours})</strong> - BCAโอน <strong>(-{ohpaSummary.bcaReductionHours || 0})</strong> - BCA Dev <strong>(-{ohpaSummary.bcaDevHours || 0})</strong>
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
                  รายละเอียดชั่วโมง PDI Deduct & B-end Bead & BCA Adjustments ประจำเดือน ({pdiBeadReport.monthYear || '09/2026'})
                </h3>
                <p className="text-[11px] text-amber-800">
                  ไฟล์ต้นฉบับ: <code>OPAH hour PDI& B-ead.xlsx</code> (Development + PDI หักออก / B-end นำมาบวกเพิ่ม / BCA โอนให้ Retread & Dev หักออก)
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
                  <th className="py-2 px-3 font-sans min-w-[140px]">รายการ / วิศวกร / กลุ่ม</th>
                  <th className="py-2 px-2 font-sans min-w-[130px]">กลุ่ม / สังกัด / การทำงาน</th>
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

                {/* Total BCA Reduction (Transfer to Retread) Row */}
                <tr className="bg-amber-50 text-amber-950 font-bold border-t border-amber-200">
                  <td className="py-2 px-3 font-bold text-amber-900" colSpan={2}>
                    🔄 รวม Total (Reduction for BCA) โอนให้ Retread (ชม.)
                  </td>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                    const total = pdiBeadReport.bcaReductionDailyHours ? pdiBeadReport.bcaReductionDailyHours[day] || 0 : 0;
                    return (
                      <td
                        key={day}
                        className={`py-2 px-1 text-center font-mono font-black ${
                          day === (ohpaSummary.mtd?.daysCount || 14) ? 'bg-amber-200 text-amber-950 text-sm' : ''
                        } ${total > 0 ? 'text-amber-800' : 'text-slate-300'}`}
                        title={pdiBeadReport.bcaReductionDailyMinutes ? `${pdiBeadReport.bcaReductionDailyMinutes[day] || 0} นาที` : ''}
                      >
                        {total > 0 ? `-${total}` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* DEV for BCA Row */}
                <tr className="bg-purple-50 text-purple-950 font-bold border-t border-purple-200">
                  <td className="py-2 px-3 font-bold text-purple-900" colSpan={2}>
                    🧪 รวม DEV (For BCA) หักออกจาก BCA (ชม.)
                  </td>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                    const total = pdiBeadReport.bcaDevDailyHours ? pdiBeadReport.bcaDevDailyHours[day] || 0 : 0;
                    return (
                      <td
                        key={day}
                        className={`py-2 px-1 text-center font-mono font-black ${
                          day === (ohpaSummary.mtd?.daysCount || 14) ? 'bg-purple-200 text-purple-950 text-sm' : ''
                        } ${total > 0 ? 'text-purple-800' : 'text-slate-300'}`}
                        title={pdiBeadReport.bcaDevDailyMinutes ? `${pdiBeadReport.bcaDevDailyMinutes[day] || 0} นาที` : ''}
                      >
                        {total > 0 ? `-${total}` : '-'}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2.5 pt-2 border-t border-slate-100 text-xs">
                <div className="bg-rose-50 p-1.5 px-2 rounded-lg flex items-center justify-between">
                  <span className="text-rose-700 font-bold text-[11px]">🔻 PDI:</span>
                  <span className="font-mono font-black text-rose-800">-{ohpaSummary.pdiDeductHours}h</span>
                </div>
                <div className="bg-emerald-50 p-1.5 px-2 rounded-lg flex items-center justify-between">
                  <span className="text-emerald-700 font-bold text-[11px]">🟢 Bead:</span>
                  <span className="font-mono font-black text-emerald-800">+{ohpaSummary.beadAddHours}h</span>
                </div>
                <div className="bg-amber-50 p-1.5 px-2 rounded-lg flex items-center justify-between">
                  <span className="text-amber-800 font-bold text-[11px]" title="โอน Compound/Cement/RT27 ไป Retread">🔄 BCA โอน:</span>
                  <span className="font-mono font-black text-amber-900">-{ohpaSummary.bcaReductionHours || 0}h</span>
                </div>
                <div className="bg-purple-50 p-1.5 px-2 rounded-lg flex items-center justify-between">
                  <span className="text-purple-800 font-bold text-[11px]" title="Development Compound ของ BCA">🧪 DEV:</span>
                  <span className="font-mono font-black text-purple-900">-{ohpaSummary.bcaDevHours || 0}h</span>
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
                (ตัด 6320 ออก {Math.round((ohpaSummary.excluded6320GyCount + ohpaSummary.excluded6320ContCount) * 10) / 10} คน)
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
              onClick={() =>
                exportTeamRawDataExcel(
                  records,
                  contractorRecords,
                  employeeMapping,
                  ohpaSummary.productionDay,
                  'ALL'
                )
              }
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ส่งออก Raw Data รายคนครบทั้ง 5 ทีม (แยกแท็บตามทีม)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Export Raw Data (5 ทีม)</span>
            </button>

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
                    (ฐาน: {area.totalHours.toLocaleString()} ชม.{area.beadAddHours ? ` +Bead ${area.beadAddHours}h` : ''}{area.pdiDeductHours ? ` -PDI ${area.pdiDeductHours}h` : ''}{area.bcaReductionHours ? ` -โอนRetread ${area.bcaReductionHours}h` : ''}{area.bcaDevHours ? ` -DEV ${area.bcaDevHours}h` : ''}{area.retreadReceivedHours ? ` +รับโอนBCA ${area.retreadReceivedHours}h` : ''})
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
                  <div className="mt-1.5 pt-1 border-t border-slate-200/40 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportTeamRawDataExcel(
                          records,
                          contractorRecords,
                          employeeMapping,
                          ohpaSummary.productionDay,
                          area.areaKey
                        );
                      }}
                      className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                      title={`ส่งออก Raw Data รายคนเฉพาะทีม ${area.areaKey}`}
                    >
                      <Download className="w-3 h-3 text-indigo-600" />
                      <span>Export Raw Data ({area.areaKey})</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Area Table (5 Production Areas) */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
          <table className="w-full text-left border-collapse min-w-[920px]">
            <thead>
              <tr className="bg-slate-900 text-white font-bold text-xs">
                <th className="py-2.5 px-3 min-w-[150px] whitespace-nowrap">
                  พื้นที่ (5 Areas)
                </th>
                <th className="py-2.5 px-1.5 text-center w-12 whitespace-nowrap" title="เป้าหมายกำลังพล Master">เป้า</th>
                <th className="py-2.5 px-2 text-center w-20 whitespace-nowrap" title="จำนวนคนสแกนจริง / เฉลี่ยต่อวัน">
                  {viewMode === 'MTD' ? 'เฉลี่ย/วัน' : 'สแกนจริง'}
                </th>
                <th className="py-2.5 px-2 text-right w-16 whitespace-nowrap bg-slate-800/80">
                  {viewMode === 'MTD' ? 'ปกติสะสม' : 'ปกติ'}
                </th>
                <th className="py-2.5 px-1.5 text-right w-14 whitespace-nowrap bg-amber-950/60 text-amber-300">
                  {viewMode === 'MTD' ? 'OT สะสม' : 'OT'}
                </th>
                <th className="py-2.5 px-2 text-right w-16 whitespace-nowrap bg-slate-800/90 text-slate-200">
                  ฐานรวม
                </th>
                <th className="py-2.5 px-1.5 text-right w-14 whitespace-nowrap bg-rose-950/60 text-rose-300">
                  🔻 PDI
                </th>
                <th className="py-2.5 px-1.5 text-right w-14 whitespace-nowrap bg-emerald-950/60 text-emerald-300">
                  🟢 Bead
                </th>
                <th className="py-2.5 px-1.5 text-right w-16 whitespace-nowrap bg-amber-950/60 text-amber-300" title="BCA โอนให้ Retread & DEV หักออก / Retread รับโอน">
                  🔄 หัก/โอน
                </th>
                <th className="py-2.5 px-2 text-right w-16 whitespace-nowrap bg-indigo-950/80 text-indigo-200 font-black">
                  ⭐ สุทธิ
                </th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap bg-emerald-950/80 text-emerald-200 font-bold min-w-[105px]">
                  📦 Stocking
                </th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap bg-purple-950/80 text-purple-200 font-black min-w-[95px]">
                  🚀 OPAH
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {activeAreaBreakdown.map((area) => {
                const isExpanded = Boolean(expandedAreas[area.areaKey]);
                const isBCA = area.areaKey === 'BCA';
                const isConsumer = area.areaKey === 'Consumer';
                const isBiasAero = area.areaKey === 'Bias Aero';
                const isRadialAero = area.areaKey === 'Radial Aero';
                const isRetread = area.areaKey === 'Retread' || area.isExcluded6320;

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
                  <Factory className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                ) : isConsumer ? (
                  <Car className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                ) : isBiasAero ? (
                  <Plane className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                ) : isRadialAero ? (
                  <Plane className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                );

                return (
                  <React.Fragment key={area.areaKey}>
                    {/* Area Primary Row */}
                    <tr
                      onClick={() => toggleArea(area.areaKey)}
                      className={`transition-colors cursor-pointer ${rowBg}`}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="p-0.5 rounded text-slate-400 hover:text-slate-700 transition-colors"
                            title={isExpanded ? 'ย่อรายละเอียด' : 'คลิกเพื่อดูรายละเอียดแผนกย่อย'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <div className="p-1 rounded-lg bg-white shadow-2xs border border-slate-200 shrink-0">
                            {iconElem}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900">{area.areaKey}</span>
                              {area.isExcluded6320 && (
                                <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1 py-0.2 rounded border border-rose-200 whitespace-nowrap">
                                  ตัด 6320
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal truncate max-w-[150px]" title={area.areaName}>
                              {area.areaName}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Standard Master Headcount */}
                      <td className="py-2.5 px-1.5 text-center font-bold text-slate-700 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-xs">
                          {area.headcountStandard ? `${area.headcountStandard}` : '-'}
                        </span>
                      </td>

                      {/* Actual Scanned Headcount */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center">
                          <span className={`px-2 py-0.5 rounded-full text-white font-black text-xs leading-none ${
                            area.isExcluded6320 ? 'bg-rose-700' : 'bg-slate-900'
                          }`}>
                            {area.totalHeadcount} คน
                          </span>
                          <span className="text-[9px] text-slate-400 mt-0.5 font-mono">
                            GY {area.gyHeadcount} | Cont {area.contractorHeadcount}
                          </span>
                        </div>
                      </td>

                      {/* Normal Hours */}
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-slate-700 bg-slate-50/50 whitespace-nowrap text-xs">
                        {area.normalHours.toLocaleString()}
                      </td>

                      {/* OT Hours */}
                      <td className="py-2.5 px-1.5 text-right font-mono font-bold text-amber-700 bg-amber-50/40 whitespace-nowrap text-xs">
                        {area.otHours > 0 ? `+${area.otHours.toLocaleString()}` : '-'}
                      </td>

                      {/* Gross Base Hours */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 bg-slate-100/50 whitespace-nowrap text-xs">
                        {area.totalHours.toLocaleString()}
                      </td>

                      {/* PDI Deduct */}
                      <td className="py-2.5 px-1.5 text-right font-mono font-bold text-rose-700 bg-rose-50/30 whitespace-nowrap text-xs">
                        {area.pdiDeductHours && area.pdiDeductHours > 0 ? `-${area.pdiDeductHours.toLocaleString()}` : '-'}
                      </td>

                      {/* Bead Add */}
                      <td className="py-2.5 px-1.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30 whitespace-nowrap text-xs">
                        {area.beadAddHours && area.beadAddHours > 0 ? `+${area.beadAddHours.toFixed(1)}` : '-'}
                      </td>

                      {/* BCA / Retread Adjustments */}
                      <td className="py-2.5 px-1.5 text-right font-mono text-xs whitespace-nowrap bg-amber-50/30">
                        {isBCA && ((area.bcaReductionHours || 0) + (area.bcaDevHours || 0)) > 0 ? (
                          <span
                            className="font-bold text-amber-800"
                            title={`โอนให้ Retread: -${area.bcaReductionHours || 0} ชม. | DEV: -${area.bcaDevHours || 0} ชม.`}
                          >
                            -{(((area.bcaReductionHours || 0) + (area.bcaDevHours || 0))).toFixed(1)}
                          </span>
                        ) : isRetread && (area.retreadReceivedHours || 0) > 0 ? (
                          <span
                            className="font-bold text-emerald-700"
                            title={`รับโอนจาก BCA: +${area.retreadReceivedHours} ชม.`}
                          >
                            +{area.retreadReceivedHours?.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Final Net OPAH Hours */}
                      <td className="py-2.5 px-2 text-right font-mono font-black text-xs text-indigo-950 bg-indigo-50/40 whitespace-nowrap">
                        {(area.finalOpahHours || area.totalHours).toLocaleString()}
                      </td>

                      {/* Stocking Tonnage 55012 */}
                      <td className="py-2.5 px-2.5 text-right font-mono bg-emerald-50/40 whitespace-nowrap">
                        {area.isExcluded6320 ? (
                          <span className="text-slate-400 text-xs">-</span>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-900 text-xs leading-tight">
                              {area.areaTonnageKg?.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">kg</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-normal flex items-center justify-end gap-1 mt-0.5">
                              <span>{area.areaTonnageLbs?.toLocaleString()} lbs</span>
                              <span className="text-[9px] bg-emerald-200/80 text-emerald-950 px-1 py-0.2 rounded font-bold">{area.areaTonnageCodes}</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Area OPAH (lbs/ชม.) */}
                      <td className="py-2.5 px-2.5 text-right font-mono bg-purple-50/50 whitespace-nowrap">
                        {area.isExcluded6320 ? (
                          <span className="text-slate-400 text-xs">-</span>
                        ) : (
                          <div>
                            <div className="font-black text-purple-900 text-sm leading-tight">
                              {area.areaOpahLbsPerHour ? area.areaOpahLbsPerHour.toLocaleString() : '-'}
                            </div>
                            <div className="text-[10px] text-purple-700 font-sans font-semibold">lbs/ชม.</div>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Sub-departments table */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-y border-slate-200">
                        <td colSpan={12} className="py-2.5 px-4 sm:px-6">
                          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-100 pb-1.5">
                              <span>รายละเอียดหน่วยงานย่อยในกลุ่ม: {area.areaName} ({viewMode === 'MTD' ? `สะสม ${ohpaSummary.mtd?.daysCount || 14} วัน` : 'ประจำวัน'})</span>
                              <span className="text-slate-400 font-normal">ทั้งหมด {area.departments.length} รายการ</span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="text-slate-500 font-bold border-b border-slate-100 text-[10px]">
                                    <th className="py-1 px-2.5">แผนก / Cost Center / สังกัด</th>
                                    <th className="py-1 px-2 text-center">ประเภท</th>
                                    <th className="py-1 px-2 text-center">{viewMode === 'MTD' ? 'เฉลี่ยคน' : 'คนสแกน'}</th>
                                    <th className="py-1 px-2 text-right">ชม.ปกติ</th>
                                    <th className="py-1 px-2 text-right">ชม. OT</th>
                                    <th className="py-1 px-2 text-right font-black">ชม.รวม</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-sans text-xs">
                                  {area.departments.map((sub, sIdx) => (
                                    <tr key={sub.dept + sIdx} className="hover:bg-slate-50/80">
                                      <td className="py-1.5 px-2.5 font-medium text-slate-800 flex items-center gap-1.5">
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
                                        <span className="truncate max-w-[280px] text-xs">{sub.dept}</span>
                                      </td>
                                      <td className="py-1.5 px-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                          sub.isBead
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : sub.dept.includes('PDI')
                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                            : sub.dept.includes('Non-HPT') || sub.dept.includes('1/5')
                                            ? (sub.isMonthly ? 'bg-purple-50 text-purple-700 border border-purple-200' : sub.isContractor ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-700 border border-slate-200')
                                            : sub.dept.includes('50% Con/Bias')
                                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                            : sub.isMonthly && sub.isContractor
                                            ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                            : sub.isMonthly
                                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                            : sub.isContractor
                                            ? 'bg-teal-100 text-teal-800'
                                            : 'bg-blue-100 text-blue-800'
                                        }`}>
                                          {sub.isBead
                                            ? 'Bead (+)'
                                            : sub.dept.includes('PDI')
                                            ? 'PDI (-)'
                                            : sub.dept.includes('Non-HPT') || sub.dept.includes('1/5')
                                            ? (sub.isMonthly ? 'Non-HPT (รายเดือน)' : sub.isContractor ? 'Non-HPT (Cont)' : 'Non-HPT (GY)')
                                            : sub.dept.includes('50% Con/Bias')
                                            ? (sub.isMonthly ? 'Shared (รายเดือน)' : sub.isContractor ? 'Shared (Cont)' : 'Shared (GY)')
                                            : sub.isMonthly
                                            ? (sub.isContractor ? 'WAS Mon' : 'Salaries')
                                            : sub.isContractor
                                            ? 'Contractor'
                                            : 'Goodyear'}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-2 text-center font-bold text-slate-700 text-xs">
                                        {sub.headcount > 0 ? `${sub.headcount} คน` : '-'}
                                      </td>
                                      <td className="py-1.5 px-2 text-right text-slate-600 font-mono text-xs">
                                        {sub.normalHours.toLocaleString()}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-mono font-bold text-amber-600 text-xs">
                                        {sub.otHours > 0 ? `+${sub.otHours.toLocaleString()}` : '-'}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-mono font-black text-slate-900 text-xs">
                                        {sub.totalHours.toLocaleString()}
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
              <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-xs">
                <td className="py-2.5 px-3 flex items-center gap-2 text-white whitespace-nowrap">
                  <div className="p-0.5 px-1.5 rounded bg-emerald-500 text-slate-950 font-black text-[10px]">
                    OPAH
                  </div>
                  <div>
                    <span className="text-emerald-300 font-bold text-xs">
                      {viewMode === 'MTD'
                        ? `รวม 4 พื้นที่ (MTD ${ohpaSummary.mtd?.daysCount || 14} วัน)`
                        : 'รวม 4 พื้นที่คิด OPAH (Active 4 Areas)'}
                    </span>
                    <span className="text-[10px] font-normal text-slate-400 block">
                      (BCA, Consumer, Bias, Radial | ตัด 6320)
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-1.5 text-center text-slate-300 font-mono text-xs whitespace-nowrap">
                  793
                </td>
                <td className="py-2.5 px-2 text-center text-white font-mono font-bold whitespace-nowrap text-xs">
                  {areaActiveStats.activeHc} คน
                </td>
                <td className="py-2.5 px-2 text-right text-slate-200 font-mono bg-slate-800/80 whitespace-nowrap text-xs">
                  {areaActiveStats.activeNorm.toLocaleString()}
                </td>
                <td className="py-2.5 px-1.5 text-right text-amber-300 font-mono bg-amber-950/80 whitespace-nowrap text-xs">
                  +{areaActiveStats.activeOt.toLocaleString()}
                </td>
                <td className="py-2.5 px-2 text-right text-slate-200 font-mono bg-slate-800 whitespace-nowrap text-xs">
                  {areaActiveStats.activeGrossTot.toLocaleString()}
                </td>
                <td className="py-2.5 px-1.5 text-right text-rose-300 font-mono bg-rose-950 whitespace-nowrap text-xs">
                  {areaActiveStats.activePdi > 0 ? `-${areaActiveStats.activePdi.toLocaleString()}` : '-'}
                </td>
                <td className="py-2.5 px-1.5 text-right text-emerald-300 font-mono bg-emerald-950 whitespace-nowrap text-xs">
                  {areaActiveStats.activeBead > 0 ? `+${areaActiveStats.activeBead.toLocaleString()}` : '-'}
                </td>
                <td className="py-2.5 px-1.5 text-right text-amber-300 font-mono bg-amber-950 whitespace-nowrap text-xs">
                  {((areaActiveStats.activeBcaRed || 0) + (areaActiveStats.activeBcaDev || 0)) > 0 ? `-${(((areaActiveStats.activeBcaRed || 0) + (areaActiveStats.activeBcaDev || 0))).toFixed(1)}` : '-'}
                </td>
                <td className="py-2.5 px-2 text-right text-emerald-300 font-mono bg-emerald-950/80 font-black whitespace-nowrap text-xs">
                  {areaActiveStats.activeNetTot.toLocaleString()}
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono bg-emerald-950/90 text-emerald-200 font-bold whitespace-nowrap">
                  <div className="text-xs leading-tight">
                    {viewMode === 'MTD' ? (ohpaSummary.mtd?.mtdStockingKg.toLocaleString() || '0') : ohpaSummary.totalTonnageKg.toLocaleString()} kg
                  </div>
                  <div className="text-[10px] text-emerald-400 font-normal">
                    ({viewMode === 'MTD' ? (ohpaSummary.mtd?.mtdStockingLbs.toLocaleString() || '0') : ohpaSummary.totalTonnageLbs.toLocaleString()} lbs)
                  </div>
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono bg-purple-950/90 text-purple-200 font-black whitespace-nowrap">
                  <div className="text-sm leading-tight">
                    {viewMode === 'MTD' ? (ohpaSummary.mtd?.mtdOpahLbsPerHour || '-') : ohpaSummary.overallOpahLbsPerHour}
                  </div>
                  <div className="text-[10px] text-purple-300/80 font-sans">lbs/ชม.</div>
                </td>
              </tr>

              {/* Row 2: Retread 6320 Excluded Stats */}
              {(areaActiveStats.retreadHc > 0 || areaActiveStats.retreadTot > 0) && (
                <tr className="bg-rose-950/80 text-rose-200 font-bold border-t border-rose-800/50 text-xs">
                  <td className="py-2.5 px-3 flex items-center gap-1.5 whitespace-nowrap">
                    <div className="p-0.5 px-1 rounded bg-rose-500 text-white font-black text-[9px]">
                      EXCLUDED
                    </div>
                    <div>
                      <span className="text-xs">🚫 หล่อดอก 6320 (ตัดออก)</span>
                      <span className="text-[9px] text-rose-300/80 block">
                        (GY {areaActiveStats.retreadGyHc} คน: {areaActiveStats.retreadGyTot.toLocaleString()}h | Cont {areaActiveStats.retreadContHc} คน: {areaActiveStats.retreadContTot.toLocaleString()}h)
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-1.5 text-center text-rose-300 font-mono text-xs whitespace-nowrap">
                    108
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-xs whitespace-nowrap">
                    {areaActiveStats.retreadHc} คน
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono whitespace-nowrap text-xs">
                    {areaActiveStats.retreadNorm.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-1.5 text-right font-mono text-amber-300 whitespace-nowrap text-xs">
                    +{areaActiveStats.retreadOt.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-rose-300 font-black whitespace-nowrap text-xs">
                    {areaActiveStats.retreadTot.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-1.5 text-right font-mono text-slate-400 text-xs">-</td>
                  <td className="py-2.5 px-1.5 text-right font-mono text-slate-400 text-xs">-</td>
                  <td className="py-2.5 px-1.5 text-right font-mono text-emerald-300 bg-rose-950 whitespace-nowrap text-xs">
                    {(areaActiveStats.retreadReceived || 0) > 0 ? `+${(areaActiveStats.retreadReceived || 0).toFixed(1)}` : '-'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-rose-300 font-black whitespace-nowrap text-xs">
                    {(areaActiveStats.retreadNetTot || areaActiveStats.retreadTot).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-slate-400 text-xs whitespace-nowrap">-</td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-slate-400 text-xs whitespace-nowrap">-</td>
                </tr>
              )}

              {/* Row 3: All-Plant Grand Total (All 5 Areas, including 6320) */}
              <tr className="bg-slate-950 text-white font-black border-t-2 border-slate-800 text-xs">
                <td className="py-2.5 px-3 flex items-center gap-1.5 whitespace-nowrap">
                  <div className="p-0.5 px-1.5 rounded bg-amber-400 text-slate-950 font-black text-[9px]">
                    GRAND
                  </div>
                  <div>
                    <span className="text-xs">
                      {viewMode === 'MTD'
                        ? `รวมทั้งสิ้นทั้งโรงงาน MTD (${ohpaSummary.mtd?.daysCount || 14} วัน)`
                        : 'รวมทั้งสิ้นทั้งโรงงาน (5 พื้นที่ 100%)'}
                    </span>
                    <span className="text-[9px] font-normal text-slate-400 block">
                      (BCA + Consumer + Bias + Radial + Retread)
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-1.5 text-center text-slate-300 font-mono text-xs whitespace-nowrap">
                  901
                </td>
                <td className="py-2.5 px-2 text-center text-amber-300 font-mono font-black text-xs whitespace-nowrap">
                  {areaActiveStats.grandHc} คน
                </td>
                <td className="py-2.5 px-2 text-right text-slate-300 font-mono whitespace-nowrap text-xs">
                  {areaActiveStats.grandNorm.toLocaleString()}
                </td>
                <td className="py-2.5 px-1.5 text-right text-amber-300 font-mono whitespace-nowrap text-xs">
                  +{areaActiveStats.grandOt.toLocaleString()}
                </td>
                <td className="py-2.5 px-2 text-right text-slate-300 font-mono font-bold whitespace-nowrap text-xs">
                  {areaActiveStats.grandGrossTot.toLocaleString()}
                </td>
                <td className="py-2.5 px-1.5 text-right text-rose-300 font-mono whitespace-nowrap text-xs">
                  {areaActiveStats.activePdi > 0 ? `-${areaActiveStats.activePdi.toLocaleString()}` : '-'}
                </td>
                <td className="py-2.5 px-1.5 text-right text-emerald-300 font-mono whitespace-nowrap text-xs">
                  {areaActiveStats.activeBead > 0 ? `+${areaActiveStats.activeBead.toLocaleString()}` : '-'}
                </td>
                <td className="py-2.5 px-1.5 text-right text-amber-300 font-mono whitespace-nowrap text-xs">
                  {(areaActiveStats.activeBcaDev || 0) > 0 ? `-${(areaActiveStats.activeBcaDev || 0).toFixed(1)}` : '-'}
                </td>
                <td className="py-2.5 px-2 text-right text-amber-300 font-mono font-black whitespace-nowrap text-xs">
                  {areaActiveStats.grandNetTot.toLocaleString()}
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono text-slate-400 text-xs whitespace-nowrap">
                  -
                </td>
                <td className="py-2.5 px-2.5 text-right font-mono text-slate-400 text-xs whitespace-nowrap">
                  -
                </td>
              </tr>
            </tbody>
          </table>
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
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-700">
                    GY: {s.gyHeadcount}
                  </span>
                  <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-md bg-teal-100 text-teal-800">
                    Cont: {s.contractorHeadcount}
                  </span>
                  <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800">
                    รายเดือน: {s.monthlyHeadcount}
                  </span>
                </div>
              </div>

              <div className="py-3.5 space-y-2">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-600 font-semibold">ชม. สุทธิคิด OPAH (Net Hours):</span>
                  <strong className="text-indigo-950 font-black text-sm">{(s.opahWorkingHours || s.totalHours).toLocaleString()} ชม.</strong>
                </div>

                {/* Formula breakdown badge */}
                <div className="p-2 bg-white rounded-xl border border-slate-200/80 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-500">
                    <span>- ฐานรวม (GY + Cont + รายเดือน):</span>
                    <span className="font-mono font-bold text-slate-800">{(s.grossHours || (s.gyTotalHours + s.contractorTotalHours + (s.monthlyHours || 0))).toLocaleString()} ชม.</span>
                  </div>
                  <div className="flex justify-between text-slate-500 pl-2">
                    <span>(ปกติ {s.normalHours}h + OT +{s.otHours}h)</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      GY {s.gyTotalHours}h | Cont {s.contractorTotalHours}h | Mon {s.monthlyHours}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[10px]">
                    <span className="text-rose-600 font-bold">🔻 PDI: -{s.pdiDeductHours || 0}h</span>
                    <span className="text-emerald-600 font-bold">🟢 Bead: +{s.beadAddHours || 0}h</span>
                  </div>
                </div>

                <div className="flex justify-between text-xs pt-1">
                  <span className="text-slate-600 font-semibold">ยอด Stocking ประจำกะ:</span>
                  <strong className="text-emerald-700 font-bold">{s.tonnageKg.toLocaleString()} kg ({s.tonnageLbs.toLocaleString()} lbs)</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60 bg-white -mx-5 -mb-5 p-3.5 px-4 rounded-b-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">OPAH ประจำกะ:</span>
                  <span className="text-[10px] text-slate-400 font-mono">({s.tonnageLbs.toLocaleString()} lbs ÷ {(s.opahWorkingHours || s.totalHours).toLocaleString()} ชม.)</span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-indigo-700">
                    {s.opahLbsPerHour}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 ml-1">lbs/ชม.</span>
                </div>
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
    </div>
  );
};
