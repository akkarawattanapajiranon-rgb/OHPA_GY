import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Download,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { ContractorScanRecord, ContractorDaySummary } from '../types/contractor';
import { exportContractorRecordsToExcel, getContractorDaySummary, normalizeToDMY } from '../utils/contractorParser';

interface ContractorScanRecordsViewProps {
  recordsByDate: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }>;
  currentDateFormatted: string;
  onRefreshData?: () => void;
  isLoading?: boolean;
  onSelectDate?: (dateFormatted: string) => void;
}

export const ContractorScanRecordsView: React.FC<ContractorScanRecordsViewProps> = ({
  recordsByDate,
  currentDateFormatted,
  onRefreshData,
  isLoading = false,
  onSelectDate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShift, setSelectedShift] = useState<'ALL' | 1 | 2 | 3>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'IN' | 'OT' | 'ABSENT' | 'LATE'>('ALL');

  // Sort available date keys in descending order (latest date first)
  const sortedDateKeys = useMemo(() => {
    return Object.keys(recordsByDate).sort((a, b) => {
      const pA = a.split('/').map(n => parseInt(n, 10));
      const pB = b.split('/').map(n => parseInt(n, 10));
      if (pA.length === 3 && pB.length === 3) {
        const timeA = new Date(pA[2], pA[1] - 1, pA[0]).getTime();
        const timeB = new Date(pB[2], pB[1] - 1, pB[0]).getTime();
        return timeB - timeA;
      }
      return b.localeCompare(a);
    });
  }, [recordsByDate]);

  // Active date key matched directly to Navbar currentDateFormatted
  const activeDateKey = useMemo(() => {
    const targetNorm = normalizeToDMY(currentDateFormatted);
    if (recordsByDate[targetNorm]) return targetNorm;

    const match = sortedDateKeys.find(k => normalizeToDMY(k) === targetNorm);
    if (match) return match;

    return sortedDateKeys[0] || '1/9/2026';
  }, [currentDateFormatted, recordsByDate, sortedDateKeys]);

  // Current day summary
  const daySummary: ContractorDaySummary | null = useMemo(() => {
    return getContractorDaySummary(activeDateKey, recordsByDate);
  }, [activeDateKey, recordsByDate]);

  const rawRecords = useMemo(() => {
    return daySummary?.records || [];
  }, [daySummary]);

  // Unique locations / departments for filter
  const uniqueLocations = useMemo(() => {
    const locSet = new Set<string>();
    rawRecords.forEach(r => {
      const loc = r.location || r.closing || r.deptRaw;
      if (loc) locSet.add(loc);
    });
    return Array.from(locSet).sort();
  }, [rawRecords]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return rawRecords.filter(record => {
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchCode = record.empCode.toLowerCase().includes(query);
        const matchTh = record.nameTh.toLowerCase().includes(query);
        const matchEn = record.nameEn.toLowerCase().includes(query);
        const matchPos = record.position.toLowerCase().includes(query);
        const matchLoc = record.location.toLowerCase().includes(query);
        const matchClosing = record.closing.toLowerCase().includes(query);
        if (!matchCode && !matchTh && !matchEn && !matchPos && !matchLoc && !matchClosing) {
          return false;
        }
      }

      // Shift filter
      if (selectedShift !== 'ALL' && record.shiftNumber !== selectedShift) {
        return false;
      }

      // Location / Department filter
      if (selectedLocation !== 'ALL') {
        const loc = record.location || record.closing || record.deptRaw;
        if (loc !== selectedLocation) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus === 'IN' && !record.hasScannedIn) return false;
      if (selectedStatus === 'OT' && record.otHours <= 0) return false;
      if (selectedStatus === 'ABSENT' && record.hasScannedIn) return false;
      if (selectedStatus === 'LATE' && !record.late) return false;

      return true;
    });
  }, [rawRecords, searchTerm, selectedShift, selectedLocation, selectedStatus]);

  // Calculate filtered totals
  const totals = useMemo(() => {
    let normalHrs = 0;
    let otHrs = 0;
    let inCount = 0;
    let otCount = 0;
    let absentCount = 0;

    filteredRecords.forEach(r => {
      normalHrs += r.normalHours;
      otHrs += r.otHours;
      if (r.hasScannedIn) inCount++;
      else absentCount++;
      if (r.otHours > 0) otCount++;
    });

    return {
      count: filteredRecords.length,
      inCount,
      absentCount,
      otCount,
      normalHrs,
      otHrs,
      totalHrs: normalHrs + otHrs
    };
  }, [filteredRecords]);

  const handleDateChange = (newDateKey: string) => {
    if (onSelectDate) {
      onSelectDate(newDateKey);
    }
  };

  const handleExport = () => {
    exportContractorRecordsToExcel(
      filteredRecords,
      daySummary?.dateFormatted || activeDateKey,
      'Contractor_WAS_Scan_Records'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-800 to-indigo-900 rounded-2xl shadow-xl p-6 text-white border border-teal-700/40">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full border border-teal-400/30">
                WAS CONTRACTOR
              </span>
              <span className="text-xs text-slate-300 font-mono">
                Source: T:\...\SCAN นิ้ว WAS (รายงานการทำงาน Wพนักงาน.xls)
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-2 flex items-center gap-3">
              <span>ตารางบันทึกการสแกนนิ้วรายบุคคล (Contractor - WAS)</span>
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              ข้อมูลพนักงานผู้รับเหมา World Asia Solution (WAS) • ติดตามเวลาสแกนเข้า-ออก, กะการทำงาน และชั่วโมง OT รายวัน
            </p>
          </div>

          {/* Date Selector & Action Buttons - Fully synced with top Navbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-800/90 border border-teal-500/40 rounded-xl px-3 py-1.5 shadow-sm">
              <Calendar className="w-4 h-4 text-teal-400 mr-2" />
              <span className="text-xs text-slate-400 mr-2 font-medium">วันที่:</span>
              <select
                value={activeDateKey}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-transparent text-white font-semibold text-sm outline-none cursor-pointer pr-2"
                title="เปลี่ยนวันที่ (เชื่อมโยงกับวันที่ด้านบน Navbar อัตโนมัติ)"
              >
                {sortedDateKeys.map(k => (
                  <option key={k} value={k} className="bg-slate-800 text-white">
                    📅 {k}
                  </option>
                ))}
              </select>
            </div>

            {onRefreshData && (
              <button
                onClick={onRefreshData}
                disabled={isLoading}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-600 transition shadow-sm cursor-pointer"
                title="รีเฟรชข้อมูลจาก T: Drive"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
                <span>รีเฟรช</span>
              </button>
            )}

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-md transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-teal-500/20">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Users className="w-3.5 h-3.5 text-teal-400" />
              <span>พนักงานทั้งหมด</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">
              {daySummary?.totalEmployees || 0} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>สแกนเข้าทำงาน</span>
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {daySummary?.scannedInCount || 0} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>มีชั่วโมง OT</span>
            </div>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {daySummary?.otWorkersCount || 0} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>ชั่วโมง OT รวม</span>
            </div>
            <div className="text-xl font-bold text-amber-300 mt-1">
              {(daySummary?.totalOtHours || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">ชม.</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <Building2 className="w-3.5 h-3.5 text-teal-300" />
              <span>ชั่วโมงรวม (Normal+OT)</span>
            </div>
            <div className="text-xl font-bold text-teal-300 mt-1">
              {(daySummary?.totalWorkingHours || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">ชม.</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>วันหยุด/ขาดงาน</span>
            </div>
            <div className="text-xl font-bold text-rose-400 mt-1">
              {daySummary?.absentCount || 0} <span className="text-xs font-normal text-slate-400">คน</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัสพนักงาน, ชื่อ-นามสกุล, ตำแหน่ง, แผนก, Closing..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:text-white"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Shift Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium">
              <button
                onClick={() => setSelectedShift('ALL')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${selectedShift === 'ALL' ? 'bg-white dark:bg-slate-700 shadow-sm text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                ทุกกะ
              </button>
              <button
                onClick={() => setSelectedShift(1)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${selectedShift === 1 ? 'bg-white dark:bg-slate-700 shadow-sm text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                กะ 1 (เช้า)
              </button>
              <button
                onClick={() => setSelectedShift(2)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${selectedShift === 2 ? 'bg-white dark:bg-slate-700 shadow-sm text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                กะ 2 (บ่าย)
              </button>
              <button
                onClick={() => setSelectedShift(3)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${selectedShift === 3 ? 'bg-white dark:bg-slate-700 shadow-sm text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
              >
                กะ 3 (ดึก)
              </button>
            </div>

            {/* Location / Department Filter */}
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
            >
              <option value="ALL">🏢 ทุกสถานที่/แผนก ({uniqueLocations.length})</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer"
            >
              <option value="ALL">🏷️ สถานะทั้งหมด</option>
              <option value="IN">🟢 สแกนเข้าทำงาน</option>
              <option value="OT">⏰ มีชั่วโมง OT</option>
              <option value="LATE">⚠️ มาสาย</option>
              <option value="ABSENT">🏖️ วันหยุด/ขาดงาน</option>
            </select>
          </div>
        </div>

        {/* Filter Results Info Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            แสดงผล <strong className="text-teal-600 dark:text-teal-400 font-bold">{filteredRecords.length}</strong> จาก {rawRecords.length} คน
            {selectedShift !== 'ALL' && ` • กะ ${selectedShift}`}
            {selectedLocation !== 'ALL' && ` • แผนก ${selectedLocation}`}
            {selectedStatus !== 'ALL' && ` • กรองตามสถานะ`}
          </div>
          <div className="flex items-center gap-4">
            <span>ชม.ปกติ: <strong className="text-slate-700 dark:text-slate-300">{totals.normalHrs}</strong> ชม.</span>
            <span>ชม. OT: <strong className="text-amber-600 dark:text-amber-400">{totals.otHrs}</strong> ชม.</span>
            <span>รวมทั้งหมด: <strong className="text-teal-600 dark:text-teal-400">{totals.totalHrs}</strong> ชม.</span>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3 w-12 text-center">No.</th>
                <th className="py-3 px-4">รหัส</th>
                <th className="py-3 px-4">ชื่อ - นามสกุล (TH) / Name (EN)</th>
                <th className="py-3 px-4">สถานที่ / แผนก</th>
                <th className="py-3 px-4">ตำแหน่ง</th>
                <th className="py-3 px-3 text-center">กะ</th>
                <th className="py-3 px-3 text-center">สแกนเข้า</th>
                <th className="py-3 px-3 text-center">สแกนออก</th>
                <th className="py-3 px-3 text-right">ปกติ</th>
                <th className="py-3 px-3 text-right">OT</th>
                <th className="py-3 px-3 text-right">รวมชม.</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">ไม่พบข้อมูลพนักงาน Contractor ตามเงื่อนไขที่เลือก</p>
                    <p className="text-xs mt-1">ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรอง</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, index) => {
                  return (
                    <tr
                      key={`${record.empCode}-${index}`}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition ${
                        !record.hasScannedIn ? 'bg-slate-50/40 dark:bg-slate-900/20 text-slate-400' : ''
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3 px-3 text-center text-xs text-slate-400 font-mono">
                        {index + 1}
                      </td>

                      {/* Emp Code */}
                      <td className="py-3 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">
                        {record.empCode}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {record.nameTh}
                        </div>
                        {record.nameEn && (
                          <div className="text-xs text-slate-400 mt-0.5 font-normal">
                            {record.nameEn}
                          </div>
                        )}
                      </td>

                      {/* Location / Closing */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {record.location || record.deptRaw || '-'}
                          </span>
                          {record.closing && (
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-mono rounded">
                              {record.closing}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Position */}
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                        {record.position || '-'}
                      </td>

                      {/* Shift */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            record.shiftNumber === 1
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                              : record.shiftNumber === 2
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          }`}
                        >
                          กะ {record.shiftNumber}
                        </span>
                      </td>

                      {/* Scan In */}
                      <td className="py-3 px-3 text-center font-mono text-xs">
                        {record.scanIn ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {record.scanIn}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>

                      {/* Scan Out */}
                      <td className="py-3 px-3 text-center font-mono text-xs">
                        {record.scanOut ? (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {record.scanOut}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>

                      {/* Normal Hours */}
                      <td className="py-3 px-3 text-right font-mono text-xs text-slate-700 dark:text-slate-300">
                        {record.normalHours}
                      </td>

                      {/* OT Hours */}
                      <td className="py-3 px-3 text-right font-mono text-xs">
                        {record.otHours > 0 ? (
                          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold rounded">
                            +{record.otHours}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">0</span>
                        )}
                      </td>

                      {/* Total Hours */}
                      <td className="py-3 px-3 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {record.totalHours}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {record.hasScannedIn ? (
                          record.late ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                              สาย {record.late}
                            </span>
                          ) : record.otHours > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              ปกติ +OT {record.otHours}h
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              ปกติ
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-400">
                            {record.remark || 'วันหยุด'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredRecords.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 dark:bg-slate-900/90 font-bold text-xs text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                  <td colSpan={8} className="py-3 px-4 text-right">
                    รวมทั้งสิ้น ({totals.count} รายการ, สแกนเข้า {totals.inCount} คน, OT {totals.otCount} คน):
                  </td>
                  <td className="py-3 px-3 text-right font-mono">{totals.normalHrs} ชม.</td>
                  <td className="py-3 px-3 text-right font-mono text-amber-600 dark:text-amber-400">+{totals.otHrs} ชม.</td>
                  <td className="py-3 px-3 text-right font-mono text-teal-600 dark:text-teal-400">{totals.totalHrs} ชม.</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
