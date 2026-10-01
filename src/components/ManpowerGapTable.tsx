import React, { useState, useMemo } from 'react';
import { ManpowerComparisonRow } from '../types/attendance';
import {
  Users,
  Search,
  AlertCircle,
  CheckCircle2,
  Download,
  Building2,
  Flame,
  Eye,
  Activity,
  Layers,
  Calendar,
  Filter,
  Check
} from 'lucide-react';

interface ManpowerGapTableProps {
  data: ManpowerComparisonRow[];
  consumerData?: ManpowerComparisonRow[];
  teamAData?: ManpowerComparisonRow[];
  scanDate?: string;
}

export const ManpowerGapTable: React.FC<ManpowerGapTableProps> = ({
  data,
  consumerData = [],
  teamAData = [],
  scanDate = '-'
}) => {
  const [selectedUnit, setSelectedUnit] = useState<'Consumer' | 'Team A'>('Consumer');
  const [selectedSubDept, setSelectedSubDept] = useState<'ALL' | 'Building' | 'Curing' | 'Final Finishing'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVER_ONLY' | 'UNDER_ONLY' | 'EXACT_ONLY'>('ALL');

  // Choose the active dataset based on selected unit
  const activeDataset = useMemo(() => {
    if (selectedUnit === 'Consumer') {
      return consumerData.length > 0
        ? consumerData
        : data.filter(r => r.unit === 'Consumer' || r.costCenter.startsWith('51') || r.costCenter.startsWith('4140'));
    } else {
      return teamAData.length > 0
        ? teamAData
        : data.filter(r => r.unit === 'Team A' || !r.costCenter.startsWith('51'));
    }
  }, [selectedUnit, consumerData, teamAData, data]);

  // Filter dataset by subdepartment, search, and status
  const filteredData = useMemo(() => {
    return activeDataset.filter(row => {
      // Sub-department filter (for Consumer)
      if (selectedUnit === 'Consumer' && selectedSubDept !== 'ALL') {
        if (row.subDepartment !== selectedSubDept) return false;
      }

      // Status filter across any shift
      if (statusFilter === 'OVER_ONLY' && !(row.shift1Status === 'OVER' || row.shift2Status === 'OVER' || row.shift3Status === 'OVER')) return false;
      if (statusFilter === 'UNDER_ONLY' && !(row.shift1Status === 'UNDER' || row.shift2Status === 'UNDER' || row.shift3Status === 'UNDER')) return false;
      if (statusFilter === 'EXACT_ONLY' && !(row.shift1Status === 'EXACT' && row.shift2Status === 'EXACT' && row.shift3Status === 'EXACT')) return false;

      // Search term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        row.positionName.toLowerCase().includes(q) ||
        row.costCenter.toLowerCase().includes(q) ||
        (row.subDepartment && row.subDepartment.toLowerCase().includes(q))
      );
    });
  }, [activeDataset, selectedUnit, selectedSubDept, statusFilter, searchTerm]);

  // Overall KPI Metrics for active unit
  const metrics = useMemo(() => {
    const s1Target = activeDataset.reduce((a, b) => a + b.shift1Target, 0);
    const s1Actual = activeDataset.reduce((a, b) => a + b.shift1Actual, 0);
    const s1Reg = activeDataset.reduce((a, b) => a + (b.shift1Regular || 0), 0);
    const s1Ot = activeDataset.reduce((a, b) => a + (b.shift1OtHC || 0), 0);

    const s2Target = activeDataset.reduce((a, b) => a + b.shift2Target, 0);
    const s2Actual = activeDataset.reduce((a, b) => a + b.shift2Actual, 0);
    const s2Reg = activeDataset.reduce((a, b) => a + (b.shift2Regular || 0), 0);
    const s2Ot = activeDataset.reduce((a, b) => a + (b.shift2OtHC || 0), 0);

    const s3Target = activeDataset.reduce((a, b) => a + b.shift3Target, 0);
    const s3Actual = activeDataset.reduce((a, b) => a + b.shift3Actual, 0);
    const s3Reg = activeDataset.reduce((a, b) => a + (b.shift3Regular || 0), 0);
    const s3Ot = activeDataset.reduce((a, b) => a + (b.shift3OtHC || 0), 0);

    const totalTarget = s1Target + s2Target + s3Target;
    const totalActual = s1Actual + s2Actual + s3Actual;
    const totalReg = s1Reg + s2Reg + s3Reg;
    const totalOt = s1Ot + s2Ot + s3Ot;
    const totalGap = totalActual - totalTarget;
    const fulfillmentPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 100;

    // Shortages list for alert box
    const shortages: { position: string; shift: number; target: number; actual: number; gap: number; subDept?: string }[] = [];
    activeDataset.forEach(r => {
      if (r.shift1Status === 'UNDER') {
        shortages.push({ position: r.positionName, shift: 1, target: r.shift1Target, actual: r.shift1Actual, gap: r.shift1Gap, subDept: r.subDepartment });
      }
      if (r.shift2Status === 'UNDER') {
        shortages.push({ position: r.positionName, shift: 2, target: r.shift2Target, actual: r.shift2Actual, gap: r.shift2Gap, subDept: r.subDepartment });
      }
      if (r.shift3Status === 'UNDER') {
        shortages.push({ position: r.positionName, shift: 3, target: r.shift3Target, actual: r.shift3Actual, gap: r.shift3Gap, subDept: r.subDepartment });
      }
    });

    return {
      s1Target,
      s1Actual,
      s1Reg,
      s1Ot,
      s2Target,
      s2Actual,
      s2Reg,
      s2Ot,
      s3Target,
      s3Actual,
      s3Reg,
      s3Ot,
      totalTarget,
      totalActual,
      totalReg,
      totalOt,
      totalGap,
      fulfillmentPct,
      shortages
    };
  }, [activeDataset]);

  // Sub-Department breakdown metrics (for Consumer)
  const subDeptMetrics = useMemo(() => {
    if (selectedUnit !== 'Consumer') return [];

    const depts: Array<{
      key: 'Building' | 'Curing' | 'Final Finishing';
      name: string;
      costCenter: string;
      icon: any;
      color: string;
      bg: string;
      border: string;
    }> = [
      {
        key: 'Building',
        name: 'Building (ประกอบยาง)',
        costCenter: '5110 / 4140',
        icon: Building2,
        color: 'text-blue-600',
        bg: 'bg-blue-50/70',
        border: 'border-blue-200'
      },
      {
        key: 'Curing',
        name: 'Curing (นึ่งยาง)',
        costCenter: '5120',
        icon: Flame,
        color: 'text-amber-600',
        bg: 'bg-amber-50/70',
        border: 'border-amber-200'
      },
      {
        key: 'Final Finishing',
        name: 'Final Finishing (ตรวจสอบ)',
        costCenter: '5130',
        icon: Eye,
        color: 'text-purple-600',
        bg: 'bg-purple-50/70',
        border: 'border-purple-200'
      }
    ];

    return depts.map(d => {
      const rows = activeDataset.filter(r => r.subDepartment === d.key);
      const s1T = rows.reduce((a, b) => a + b.shift1Target, 0);
      const s1A = rows.reduce((a, b) => a + b.shift1Actual, 0);
      const s2T = rows.reduce((a, b) => a + b.shift2Target, 0);
      const s2A = rows.reduce((a, b) => a + b.shift2Actual, 0);
      const s3T = rows.reduce((a, b) => a + b.shift3Target, 0);
      const s3A = rows.reduce((a, b) => a + b.shift3Actual, 0);

      const totT = s1T + s2T + s3T;
      const totA = s1A + s2A + s3A;
      const gap = totA - totT;
      const pct = totT > 0 ? (totA / totT) * 100 : 100;

      return {
        ...d,
        s1T,
        s1A,
        s2T,
        s2A,
        s3T,
        s3A,
        totT,
        totA,
        gap,
        pct,
        count: rows.length
      };
    });
  }, [activeDataset, selectedUnit]);

  // Group filtered data by sub-department for Consumer
  const groupedData = useMemo(() => {
    if (selectedUnit !== 'Consumer') {
      return [{ groupName: 'ทีม A (Stock Prep / Bias Aero)', items: filteredData }];
    }

    const groups: { [key: string]: ManpowerComparisonRow[] } = {};
    filteredData.forEach(r => {
      const g = r.subDepartment || 'Building';
      if (!groups[g]) groups[g] = [];
      groups[g].push(r);
    });

    const order = ['Building', 'Curing', 'Final Finishing'];
    return order
      .filter(k => groups[k] && groups[k].length > 0)
      .map(k => ({
        groupName:
          k === 'Building'
            ? '1. Building (แผนกประกอบยาง - 5110 / 4140)'
            : k === 'Curing'
            ? '2. Curing (แผนกนึ่งยาง - 5120)'
            : '3. Final Finishing (แผนกตรวจสอบขั้นสุดท้าย - 5130)',
        subDeptKey: k,
        items: groups[k]
      }));
  }, [filteredData, selectedUnit]);

  // Export to CSV function
  const handleExportCSV = () => {
    const headers = [
      'ลำดับ',
      'กลุ่มแผนก',
      'ตำแหน่ง/เครื่องจักร',
      'Cost Center',
      'กะ 1 เป้าหมาย',
      'กะ 1 สแกนจริง',
      'กะ 1 สแกนปกติ',
      'กะ 1 OT ช่วย',
      'กะ 1 สถานะ',
      'กะ 2 เป้าหมาย',
      'กะ 2 สแกนจริง',
      'กะ 2 สแกนปกติ',
      'กะ 2 OT ช่วย',
      'กะ 2 สถานะ',
      'กะ 3 เป้าหมาย',
      'กะ 3 สแกนจริง',
      'กะ 3 สแกนปกติ',
      'กะ 3 OT ช่วย',
      'กะ 3 สถานะ',
      'รวมเป้าหมาย',
      'รวมสแกนจริง',
      'ผลต่าง (Gap)'
    ];

    const rows = filteredData.map((r, idx) => [
      idx + 1,
      r.subDepartment || '-',
      r.positionName,
      r.costCenter,
      r.shift1Target,
      r.shift1Actual,
      r.shift1Regular || 0,
      r.shift1OtHC || 0,
      r.shift1Status === 'EXACT' ? 'พอดี' : r.shift1Status === 'OVER' ? `เกิน +${r.shift1Gap}` : `ขาด ${r.shift1Gap}`,
      r.shift2Target,
      r.shift2Actual,
      r.shift2Regular || 0,
      r.shift2OtHC || 0,
      r.shift2Status === 'EXACT' ? 'พอดี' : r.shift2Status === 'OVER' ? `เกิน +${r.shift2Gap}` : `ขาด ${r.shift2Gap}`,
      r.shift3Target,
      r.shift3Actual,
      r.shift3Regular || 0,
      r.shift3OtHC || 0,
      r.shift3Status === 'EXACT' ? 'พอดี' : r.shift3Status === 'OVER' ? `เกิน +${r.shift3Gap}` : `ขาด ${r.shift3Gap}`,
      r.totalTarget || (r.shift1Target + r.shift2Target + r.shift3Target),
      r.totalActual || (r.shift1Actual + r.shift2Actual + r.shift3Actual),
      (r.totalActual || (r.shift1Actual + r.shift2Actual + r.shift3Actual)) -
        (r.totalTarget || (r.shift1Target + r.shift2Target + r.shift3Target))
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Standard_HC_${selectedUnit}_${scanDate.replace(/[\/\s:]/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

    // Special Case: แทน WAS
    if (isWasReplacement) {
      const count = displayOtPeople || actual;
      if (count <= 0) return <span className="text-slate-400 font-mono text-[11px]">-</span>;
      return (
        <span className="inline-flex items-center font-semibold px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200">
          {count} คน
        </span>
      );
    }

    // Machines with target = 0 but have OT workers
    if (target === 0 && hasOtSupport) {
      return (
        <div className="inline-flex flex-col items-center justify-center">
          <span
            className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[11px] border border-blue-200 shadow-xs"
            title={`กะนี้ไม่มีเป้าหมายปกติ มีพนักงานทำ OT มาช่วย ${displayOtPeople} คน (รวม ${otHours} ชม.)`}
          >
            ⚡ OT {displayOtPeople} คน ({otHours} ชม.)
          </span>
          {regular !== undefined && regular > 0 && (
            <span className="text-[10px] text-slate-500 font-medium mt-0.5">(สแกนปกติ {regular} คน)</span>
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
    <div className="space-y-6">
      {/* 1. Header & Navigation Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl shadow-sm">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  แดชบอร์ด & ตารางเปรียบเทียบ Standard HC
                </h2>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  <Calendar className="w-3 h-3" />
                  {scanDate}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                วิเคราะห์ความพร้อมกำลังคนตามเป้าหมาย Standard HC รายกะ (กะ 1, กะ 2, กะ 3) เทียบยอดสแกนจริง
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Unit Selector Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => {
                  setSelectedUnit('Consumer');
                  setSelectedSubDept('ALL');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedUnit === 'Consumer'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🟢 ทีม Consumer</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedUnit === 'Consumer' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {selectedUnit === 'Consumer' ? `${metrics.totalTarget} คน` : '148 คน'}
                </span>
              </button>

              <button
                onClick={() => {
                  setSelectedUnit('Team A');
                  setSelectedSubDept('ALL');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedUnit === 'Team A'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🔵 ทีม A (Prep)</span>
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="ส่งออกรายงาน Standard HC ประจำวันเป็น CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออก CSV</span>
            </button>
          </div>
        </div>

        {/* Sub-Department Pills (for Consumer) */}
        {selectedUnit === 'Consumer' && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" />
              เลือกแผนก:
            </span>
            <button
              onClick={() => setSelectedSubDept('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedSubDept === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด (Consumer 3 แผนก)
            </button>
            <button
              onClick={() => setSelectedSubDept('Building')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedSubDept === 'Building'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Building (5110 / 4140)</span>
              <span className="text-[10px] opacity-80">(เป้า 31/กะ)</span>
            </button>
            <button
              onClick={() => setSelectedSubDept('Curing')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedSubDept === 'Curing'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Curing (5120)</span>
              <span className="text-[10px] opacity-80">(เป้า 8/กะ)</span>
            </button>
            <button
              onClick={() => setSelectedSubDept('Final Finishing')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedSubDept === 'Final Finishing'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Final Finishing (5130)</span>
              <span className="text-[10px] opacity-80">(เป้า 11/10/10)</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Top Executive KPI Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Fulfillment */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              อัตราความพร้อมกำลังคนรวม
            </span>
            <div
              className={`p-2 rounded-xl ${
                metrics.fulfillmentPct >= 100
                  ? 'bg-emerald-50 text-emerald-600'
                  : metrics.fulfillmentPct >= 90
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              <Activity className="w-4.5 h-4.5" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {metrics.fulfillmentPct.toFixed(1)}%
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  metrics.totalGap >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {metrics.totalGap >= 0 ? `+${metrics.totalGap} คน` : `${metrics.totalGap} คน`}
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-500 ${
                  metrics.fulfillmentPct >= 100
                    ? 'bg-emerald-500'
                    : metrics.fulfillmentPct >= 90
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(metrics.fulfillmentPct, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-medium">
              <span>เป้าหมาย {metrics.totalTarget} คน</span>
              <span>มาจริง {metrics.totalActual} คน</span>
            </div>
            {metrics.totalOt > 0 && (
              <div className="text-[10px] text-blue-600 font-semibold mt-1">
                (สแกนปกติ {metrics.totalReg} + OT มาช่วย {metrics.totalOt} คน)
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Shift 1 */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              กะ 1 (เช้า 07:00 - 15:00)
            </span>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              กะเช้า
            </span>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {metrics.s1Actual}
                <span className="text-xs font-normal text-slate-400 ml-1">/ {metrics.s1Target} คน</span>
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  metrics.s1Actual === metrics.s1Target
                    ? 'bg-emerald-100 text-emerald-800'
                    : metrics.s1Actual > metrics.s1Target
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {metrics.s1Actual === metrics.s1Target
                  ? 'พอดี'
                  : metrics.s1Actual > metrics.s1Target
                  ? `เกิน +${metrics.s1Actual - metrics.s1Target}`
                  : `ขาด ${metrics.s1Actual - metrics.s1Target}`}
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${metrics.s1Target > 0 ? Math.min((metrics.s1Actual / metrics.s1Target) * 100, 100) : 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-medium">
              <span>สแกนปกติ {metrics.s1Reg} คน</span>
              <span className="text-blue-600 font-bold">
                {metrics.s1Ot > 0 ? `+OT ${metrics.s1Ot} คน` : 'ไม่มี OT'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Shift 2 */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">
              กะ 2 (บ่าย 15:00 - 23:00)
            </span>
            <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
              กะบ่าย
            </span>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {metrics.s2Actual}
                <span className="text-xs font-normal text-slate-400 ml-1">/ {metrics.s2Target} คน</span>
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  metrics.s2Actual === metrics.s2Target
                    ? 'bg-emerald-100 text-emerald-800'
                    : metrics.s2Actual > metrics.s2Target
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {metrics.s2Actual === metrics.s2Target
                  ? 'พอดี'
                  : metrics.s2Actual > metrics.s2Target
                  ? `เกิน +${metrics.s2Actual - metrics.s2Target}`
                  : `ขาด ${metrics.s2Actual - metrics.s2Target}`}
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="bg-orange-500 h-full transition-all duration-500"
                style={{ width: `${metrics.s2Target > 0 ? Math.min((metrics.s2Actual / metrics.s2Target) * 100, 100) : 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-medium">
              <span>สแกนปกติ {metrics.s2Reg} คน</span>
              <span className="text-blue-600 font-bold">
                {metrics.s2Ot > 0 ? `+OT ${metrics.s2Ot} คน` : 'ไม่มี OT'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Shift 3 */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
              กะ 3 (ดึก 23:00 - 07:00)
            </span>
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
              กะดึก
            </span>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {metrics.s3Actual}
                <span className="text-xs font-normal text-slate-400 ml-1">/ {metrics.s3Target} คน</span>
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  metrics.s3Actual === metrics.s3Target
                    ? 'bg-emerald-100 text-emerald-800'
                    : metrics.s3Actual > metrics.s3Target
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {metrics.s3Actual === metrics.s3Target
                  ? 'พอดี'
                  : metrics.s3Actual > metrics.s3Target
                  ? `เกิน +${metrics.s3Actual - metrics.s3Target}`
                  : `ขาด ${metrics.s3Actual - metrics.s3Target}`}
              </span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="bg-indigo-500 h-full transition-all duration-500"
                style={{ width: `${metrics.s3Target > 0 ? Math.min((metrics.s3Actual / metrics.s3Target) * 100, 100) : 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-medium">
              <span>สแกนปกติ {metrics.s3Reg} คน</span>
              <span className="text-blue-600 font-bold">
                {metrics.s3Ot > 0 ? `+OT ${metrics.s3Ot} คน` : 'ไม่มี OT'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sub-Department Breakdown Cards (for Consumer) */}
      {selectedUnit === 'Consumer' && subDeptMetrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subDeptMetrics.map(dept => {
            const Icon = dept.icon;
            return (
              <div
                key={dept.key}
                onClick={() => setSelectedSubDept(dept.key)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedSubDept === dept.key
                    ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/20'
                    : 'bg-white hover:bg-slate-50/80 border-slate-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-xl ${dept.bg} ${dept.color}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{dept.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">Cost Center: {dept.costCenter}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                      dept.gap >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {dept.gap >= 0 ? `+${dept.gap} คน` : `${dept.gap} คน`}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-black text-slate-900">
                      {dept.totA} <span className="text-xs font-normal text-slate-400">/ {dept.totT} คน</span>
                    </span>
                    <span className="text-xs font-bold text-slate-600">{dept.pct.toFixed(0)}%</span>
                  </div>

                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full ${
                        dept.pct >= 100 ? 'bg-emerald-500' : dept.pct >= 90 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(dept.pct, 100)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1 mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-center">
                    <div className="bg-amber-50/60 p-1 rounded font-medium text-amber-800">
                      กะ 1: {dept.s1A}/{dept.s1T}
                    </div>
                    <div className="bg-orange-50/60 p-1 rounded font-medium text-orange-800">
                      กะ 2: {dept.s2A}/{dept.s2T}
                    </div>
                    <div className="bg-indigo-50/60 p-1 rounded font-medium text-indigo-800">
                      กะ 3: {dept.s3A}/{dept.s3T}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* 5. Search & Status Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">
              ตารางรายละเอียดกำลังคนรายตำแหน่ง ({filteredData.length} รายการ)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหาตำแหน่ง / Cost Center..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-52 sm:w-64"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="py-1.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-medium"
            >
              <option value="ALL">แสดงทุกสถานะ</option>
              <option value="UNDER_ONLY">⚠️ เฉพาะที่มีคนขาด</option>
              <option value="OVER_ONLY">📈 เฉพาะที่มีคนเกิน</option>
              <option value="EXACT_ONLY">✅ เฉพาะที่จัดคนพอดี</option>
            </select>
          </div>
        </div>

        {/* 6. Detailed Comparison Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 mt-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-4">ตำแหน่งงาน / เครื่องจักร (Machine / Position)</th>
                <th className="py-3 px-3 text-center">Cost Center</th>
                <th className="py-3 px-4 text-center bg-amber-50/60 border-x border-amber-100">
                  กะ 1 (07:00 - 15:00)
                </th>
                <th className="py-3 px-4 text-center bg-orange-50/60 border-r border-orange-100">
                  กะ 2 (15:00 - 23:00)
                </th>
                <th className="py-3 px-4 text-center bg-indigo-50/60 border-r border-indigo-100">
                  กะ 3 (23:00 - 07:00)
                </th>
                <th className="py-3 px-4 text-center bg-slate-100/70">
                  รวม 24 ชม. (Total)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {groupedData.map((group, gIdx) => (
                <React.Fragment key={gIdx}>
                  {/* Section Header */}
                  <tr className="bg-slate-100/80 font-bold text-slate-800">
                    <td colSpan={7} className="py-2.5 px-4">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                          {group.groupName} ({group.items.length} ตำแหน่ง)
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          เป้ารวมกลุ่ม:{' '}
                          {group.items.reduce(
                            (a, b) => a + b.shift1Target + b.shift2Target + b.shift3Target,
                            0
                          )}{' '}
                          คน | มาจริง:{' '}
                          {group.items.reduce(
                            (a, b) => a + b.shift1Actual + b.shift2Actual + b.shift3Actual,
                            0
                          )}{' '}
                          คน
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Section Rows */}
                  {group.items.map((row, idx) => {
                    const rowTotTarget = row.totalTarget || row.shift1Target + row.shift2Target + row.shift3Target;
                    const rowTotActual = row.totalActual || row.shift1Actual + row.shift2Actual + row.shift3Actual;
                    const rowGap = rowTotActual - rowTotTarget;

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          <div>{row.positionName}</div>
                          {row.positionName === 'Buffing & Repair' && (
                            <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 mt-0.5 inline-block font-normal">
                              🕒 กะเช้าเท่านั้น (กะ 2 และ 3 ไม่มีเป้า)
                            </span>
                          )}
                          {row.positionName.toLowerCase().includes('hot apexer') && (
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 mt-0.5 inline-block font-normal">
                              🔄 สลับกะยืดหยุ่น: 3-3-2 / 2-3-3 / 3-2-3 (รวม 8 คน)
                            </span>
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
                        <td className="py-2.5 px-4 text-center bg-indigo-50/20 border-r border-indigo-100/60">
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

                        {/* Daily Total */}
                        <td className="py-2.5 px-4 text-center bg-slate-50/40">
                          <div className="font-bold text-slate-900">
                            {rowTotActual} / {rowTotTarget} คน
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded mt-0.5 inline-block ${
                              rowGap === 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : rowGap > 0
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {rowGap === 0 ? 'พอดี' : rowGap > 0 ? `เกิน +${rowGap}` : `ขาด ${rowGap}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    ไม่พบข้อมูลตำแหน่งงานตามเงื่อนไขที่ค้นหา
                  </td>
                </tr>
              )}
            </tbody>

            {/* Grand Totals Footer */}
            <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 text-xs">
              <tr>
                <td className="py-3 px-4" colSpan={3}>
                  สรุปภาพรวมเป้าหมาย Standard HC vs กำลังคนจริงทั้งหมด (Grand Total)
                </td>
                <td className="py-3 px-4 text-center bg-amber-100/60 border-x border-amber-200">
                  เป้า {metrics.s1Target} | จริง {metrics.s1Actual} คน
                  {metrics.s1Actual > metrics.s1Target && (
                    <span className="text-rose-600 ml-1 font-bold">(เกิน +{metrics.s1Actual - metrics.s1Target})</span>
                  )}
                  {metrics.s1Actual < metrics.s1Target && (
                    <span className="text-amber-700 ml-1 font-bold">(ขาด {metrics.s1Actual - metrics.s1Target})</span>
                  )}
                  {metrics.s1Actual === metrics.s1Target && metrics.s1Target > 0 && (
                    <span className="text-emerald-600 ml-1 font-bold">(พอดี)</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center bg-orange-100/60 border-r border-orange-200">
                  เป้า {metrics.s2Target} | จริง {metrics.s2Actual} คน
                  {metrics.s2Actual > metrics.s2Target && (
                    <span className="text-rose-600 ml-1 font-bold">(เกิน +{metrics.s2Actual - metrics.s2Target})</span>
                  )}
                  {metrics.s2Actual < metrics.s2Target && (
                    <span className="text-amber-700 ml-1 font-bold">(ขาด {metrics.s2Actual - metrics.s2Target})</span>
                  )}
                  {metrics.s2Actual === metrics.s2Target && metrics.s2Target > 0 && (
                    <span className="text-emerald-600 ml-1 font-bold">(พอดี)</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center bg-indigo-100/60 border-r border-indigo-200">
                  เป้า {metrics.s3Target} | จริง {metrics.s3Actual} คน
                  {metrics.s3Actual > metrics.s3Target && (
                    <span className="text-rose-600 ml-1 font-bold">(เกิน +{metrics.s3Actual - metrics.s3Target})</span>
                  )}
                  {metrics.s3Actual < metrics.s3Target && (
                    <span className="text-amber-700 ml-1 font-bold">(ขาด {metrics.s3Actual - metrics.s3Target})</span>
                  )}
                  {metrics.s3Actual === metrics.s3Target && metrics.s3Target > 0 && (
                    <span className="text-emerald-600 ml-1 font-bold">(พอดี)</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center bg-slate-200/80">
                  เป้า {metrics.totalTarget} | จริง {metrics.totalActual} คน
                  <div className="text-[11px] font-extrabold text-blue-700">
                    ความพร้อม: {metrics.fulfillmentPct.toFixed(1)}%
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
