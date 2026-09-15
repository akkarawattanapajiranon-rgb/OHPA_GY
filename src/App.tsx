import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { EmployeeDetailTable } from './components/EmployeeDetailTable';
import { ManpowerGapTable } from './components/ManpowerGapTable';
import { FileUploaderModal } from './components/FileUploaderModal';
import { DailyAdjustmentModal } from './components/DailyAdjustmentModal';
import { OhpaCalculationView } from './components/OhpaCalculationView';
import { ContractorScanRecordsView } from './components/ContractorScanRecordsView';

import { SCAN_FILE_PRESETS, DEFAULT_SCAN_CONTENT, DEFAULT_FILE_NAME, ScanPreset } from './data/default_scan_record';
import defaultEmpMappingRaw from './data/default_emp_mapping.json';
import defaultAdjustmentsRaw from './data/default_adjustments.json';
import { DEFAULT_CONTRACTOR_MAPPING, DEFAULT_CONTRACTOR_RECORDS_BY_DATE } from './data/default_contractor_data';
import { processScanRecords, createPresetsFromScanFiles, normalizeDateToMMDDYYYY, RawScanFileItem } from './utils/parser';
import { EmployeeInfo, DailyAdjustmentRecord } from './types/attendance';
import { ContractorScanRecord } from './types/contractor';
import {
  TableProperties,
  UserCheck,
  Calendar,
  Shuffle,
  CheckCircle2,
  AlertCircle,
  Calculator,
  HardHat,
  Users
} from 'lucide-react';

export default function App() {
  const [presets, setPresets] = useState<ScanPreset[]>(SCAN_FILE_PRESETS);
  const [scanContent, setScanContent] = useState<string>(DEFAULT_SCAN_CONTENT);
  const [selectedFileId, setSelectedFileId] = useState<string>(DEFAULT_FILE_NAME);
  const [employeeMapping, setEmployeeMapping] = useState<Record<string, EmployeeInfo>>(
    defaultEmpMappingRaw as Record<string, EmployeeInfo>
  );

  // Contractor (WAS) state
  const [contractorRecordsByDate, setContractorRecordsByDate] = useState<
    Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }>
  >(DEFAULT_CONTRACTOR_RECORDS_BY_DATE);
  const [isContractorLoading, setIsContractorLoading] = useState<boolean>(false);

  const [dailyAdjustments, setDailyAdjustments] = useState<DailyAdjustmentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ohpa_daily_adjustments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return (defaultAdjustmentsRaw as DailyAdjustmentRecord[]) || [];
    } catch {
      return (defaultAdjustmentsRaw as DailyAdjustmentRecord[]) || [];
    }
  });

  const [selectedShiftFilter, setSelectedShiftFilter] = useState<number | 'ALL'>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'PAGE_1_DETAILS' | 'PAGE_2_CONTRACTOR' | 'PAGE_3_MANPOWER' | 'PAGE_4_OHPA'>('PAGE_1_DETAILS');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false);
  const [toastNotification, setToastNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto clear toast after 4s
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Initial auto-fetch from scans folder & contractor data on load
  useEffect(() => {
    handleFetchFolderScans();
    handleFetchContractorData();
  }, []);

  // Core processing - 1 row per employee, 100% sync with Standard HC
  const processedData = useMemo(() => {
    return processScanRecords(scanContent, employeeMapping, dailyAdjustments);
  }, [scanContent, employeeMapping, dailyAdjustments]);

  const {
    records,
    manpowerComparison,
    dateStringFormatted
  } = processedData;

  const mappedEmployeeCount = useMemo(() => {
    return Object.keys(employeeMapping).length;
  }, [employeeMapping]);

  const handleSelectPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId || p.dateFormatted === presetId || p.name === presetId);
    if (preset) {
      setScanContent(preset.content);
      setSelectedFileId(preset.id);
      setSelectedShiftFilter('ALL');
      setSelectedDeptFilter('ALL');
      setSelectedCategoryFilter('ALL');
    }
  };

  const handleSelectDateFromOhpa = (dateFormatted: string) => {
    const cleanDate = dateFormatted.replace(/^[📅📄\s]*วันที่\s*/, '').trim();
    const matchingPreset = presets.find(p => {
      if (p.dateFormatted && p.dateFormatted.trim() === cleanDate) return true;
      if (p.name && (p.name.includes(cleanDate) || cleanDate.includes(p.name))) return true;
      const normP = normalizeDateToMMDDYYYY(p.dateFormatted || p.name || p.id);
      const normInput = normalizeDateToMMDDYYYY(cleanDate);
      return Boolean(normP && normInput && normP === normInput);
    });

    if (matchingPreset) {
      setScanContent(matchingPreset.content);
      setSelectedFileId(matchingPreset.id);
      setSelectedShiftFilter('ALL');
      setSelectedDeptFilter('ALL');
      setSelectedCategoryFilter('ALL');
    }
  };

  const handleUploadScanContent = (content: string, name: string) => {
    setScanContent(content);
    setSelectedFileId(name);
    setSelectedShiftFilter('ALL');
    setSelectedDeptFilter('ALL');
    setSelectedCategoryFilter('ALL');
  };

  const handleUpdateEmployeeMapping = (newMapping: Record<string, EmployeeInfo>) => {
    setEmployeeMapping(prev => ({
      ...prev,
      ...newMapping
    }));
  };

  const handleResetToDefault = () => {
    setPresets(SCAN_FILE_PRESETS);
    setScanContent(DEFAULT_SCAN_CONTENT);
    setSelectedFileId(DEFAULT_FILE_NAME);
    setEmployeeMapping(defaultEmpMappingRaw as Record<string, EmployeeInfo>);
    setSelectedShiftFilter('ALL');
    setSelectedDeptFilter('ALL');
    setSelectedCategoryFilter('ALL');
  };

  // Fetch scans directly from scans/ folder
  const handleFetchFolderScans = async (): Promise<{ success: boolean; message: string; fileCount?: number }> => {
    setIsLoadingFolder(true);
    try {
      const response = await fetch('/api/scan-folder');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error || `HTTP error ${response.status}`;
        setToastNotification({ type: 'error', message: `ดึงข้อมูลไม่สำเร็จ: ${errMsg}` });
        return { success: false, message: errMsg };
      }

      const data = await response.json();
      const files: RawScanFileItem[] = data.files || [];

      if (files.length === 0) {
        const msg = 'ไม่พบไฟล์สแกนในโฟลเดอร์ scans (กรุณาวางไฟล์ .txt ในโฟลเดอร์ scans แล้วกดใหม่อีกครั้ง)';
        setToastNotification({ type: 'error', message: msg });
        return { success: false, message: msg };
      }

      const newPresets = createPresetsFromScanFiles(files);
      if (newPresets.length > 0) {
        setPresets(newPresets);
        // Automatically switch to the latest date
        setScanContent(newPresets[0].content);
        setSelectedFileId(newPresets[0].id);
        setSelectedShiftFilter('ALL');
        setSelectedDeptFilter('ALL');

        const successMsg = `ดึงข้อมูลจากโฟลเดอร์สำเร็จ! (${files.length} ไฟล์, ประมวลผลได้ ${newPresets.length} วัน)`;
        setToastNotification({ type: 'success', message: successMsg });
        return {
          success: true,
          message: successMsg,
          fileCount: files.length
        };
      } else {
        const msg = 'อ่านไฟล์สำเร็จ แต่ไม่พบรูปแบบบันทึกเวลาที่ถูกต้องในไฟล์';
        setToastNotification({ type: 'error', message: msg });
        return { success: false, message: msg };
      }
    } catch (err: any) {
      const errMsg = err.message || 'ไม่สามารถเชื่อมต่อ Local API ได้';
      setToastNotification({ type: 'error', message: `เกิดข้อผิดพลาด: ${errMsg}` });
      return { success: false, message: errMsg };
    } finally {
      setIsLoadingFolder(false);
    }
  };

  // Fetch Contractor data from /api/contractor-data
  const handleFetchContractorData = async () => {
    setIsContractorLoading(true);
    try {
      const response = await fetch('/api/contractor-data');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.recordsByDate && Object.keys(data.recordsByDate).length > 0) {
          setContractorRecordsByDate(data.recordsByDate);
          setToastNotification({
            type: 'success',
            message: `ดึงข้อมูล Contractor สำเร็จ! (${data.employeeCount} คน, ${data.datesCount} วัน)`
          });
        }
      }
    } catch (e) {
      console.warn('Could not fetch live contractor data, using bundled cache.', e);
    } finally {
      setIsContractorLoading(false);
    }
  };

  const handleOpenFolderInExplorer = async () => {
    try {
      await fetch('/api/open-folder');
    } catch (e) {
      console.warn('Could not open folder via API');
    }
  };

  const handleBatchUploadFiles = (files: RawScanFileItem[]) => {
    const newPresets = createPresetsFromScanFiles(files);
    if (newPresets.length > 0) {
      setPresets(newPresets);
      setScanContent(newPresets[0].content);
      setSelectedFileId(newPresets[0].id);
      setSelectedShiftFilter('ALL');
      setSelectedDeptFilter('ALL');
      setToastNotification({
        type: 'success',
        message: `นำเข้าสำเร็จ ${files.length} ไฟล์ (ตรวจพบ ${newPresets.length} วัน)`
      });
    }
  };

  const handleSaveAdjustments = (newAdjustments: DailyAdjustmentRecord[]) => {
    setDailyAdjustments(newAdjustments);
    try {
      localStorage.setItem('ohpa_daily_adjustments', JSON.stringify(newAdjustments));
      setToastNotification({
        type: 'success',
        message: 'บันทึกการปรับปรุงข้อมูลตำแหน่ง/OT สำเร็จ'
      });
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
    }
  };

  // Count adjustments for current date
  const currentDateAdjustmentsCount = useMemo(() => {
    const cleanCurrentDate = dateStringFormatted.trim();
    return dailyAdjustments.filter(a => {
      const adjDate = (a.dateStr || '').trim();
      return adjDate === cleanCurrentDate || adjDate === '' || adjDate === 'ALL';
    }).length;
  }, [dailyAdjustments, dateStringFormatted]);

  // Contractor records for current selected date
  const currentContractorDay = useMemo(() => {
    const clean = dateStringFormatted.replace(/^[📅📄\s]*วันที่\s*/, '').trim();
    let entry = contractorRecordsByDate[clean];
    if (!entry) {
      const matchKey = Object.keys(contractorRecordsByDate).find(k => {
        return normalizeDateToMMDDYYYY(k) === normalizeDateToMMDDYYYY(clean);
      });
      if (matchKey) entry = contractorRecordsByDate[matchKey];
    }
    return entry;
  }, [contractorRecordsByDate, dateStringFormatted]);

  const currentContractorCount = useMemo(() => {
    return currentContractorDay?.records?.length || 75;
  }, [currentContractorDay]);

  const currentContractorRecords = useMemo(() => {
    return currentContractorDay?.records || [];
  }, [currentContractorDay]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-12">
      {/* Top Navigation */}
      <Navbar
        fileName={selectedFileId}
        scanDate={dateStringFormatted}
        mappedEmployeesCount={mappedEmployeeCount}
        totalRecords={records.length}
        presets={presets}
        isLoadingFolder={isLoadingFolder}
        onSelectPreset={handleSelectPreset}
        onFetchFolderScans={() => {
          handleFetchFolderScans();
          handleFetchContractorData();
        }}
        onOpenFolderInExplorer={handleOpenFolderInExplorer}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onResetToDefault={handleResetToDefault}
      />

      {/* Floating Toast Notification */}
      {toastNotification && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium ${
              toastNotification.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/40 backdrop-blur-md'
                : 'bg-rose-950/90 text-rose-100 border-rose-500/40 backdrop-blur-md'
            }`}
          >
            {toastNotification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{toastNotification.message}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Tab Navigation (4 Pages) */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            {/* Page 1 Tab: GY Scans */}
            <button
              onClick={() => setActiveTab('PAGE_1_DETAILS')}
              className={`flex-1 sm:flex-none py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'PAGE_1_DETAILS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <TableProperties className="w-4 h-4" />
              <span>ตารางบันทึกการสแกนนิ้วรายบุคคล (GY)</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'PAGE_1_DETAILS' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {records.length} คน
              </span>
            </button>

            {/* Page 2 Tab: Contractor WAS Scans */}
            <button
              onClick={() => setActiveTab('PAGE_2_CONTRACTOR')}
              className={`flex-1 sm:flex-none py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'PAGE_2_CONTRACTOR'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HardHat className="w-4 h-4" />
              <span>ตารางบันทึกการสแกนนิ้วรายบุคคล (Cont)</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'PAGE_2_CONTRACTOR' ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-800'
              }`}>
                {currentContractorCount} คน
              </span>
            </button>

            {/* Page 3 Tab: Standard Manpower Comparison */}
            <button
              onClick={() => setActiveTab('PAGE_3_MANPOWER')}
              className={`flex-1 sm:flex-none py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'PAGE_3_MANPOWER'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>หน้า 3: ตารางเปรียบเทียบ Standard HC</span>
            </button>

            {/* Page 4 Tab: OPAH CAL */}
            <button
              onClick={() => setActiveTab('PAGE_4_OHPA')}
              className={`flex-1 sm:flex-none py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'PAGE_4_OHPA'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>หน้า 4: OPAH CAL</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'PAGE_4_OHPA' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700'
              }`}>
                55012
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
            {/* Daily Adjustment Trigger Button */}
            <button
              onClick={() => setIsAdjustmentModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
              title="บันทึกย้ายเครื่องกะปกติ, ทำ OT ข้ามเครื่อง หรือเวลาพิเศษตามที่หัวหน้างานสั่ง"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>ย้ายเครื่อง / OT / เวลาพิเศษ</span>
              {currentDateAdjustmentsCount > 0 && (
                <span className="bg-white text-blue-700 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold shadow-xs">
                  {currentDateAdjustmentsCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>วันที่: <strong className="text-slate-800">{dateStringFormatted}</strong></span>
            </div>
          </div>
        </div>

        {/* Tab 1: GY Employee Detail Table */}
        {activeTab === 'PAGE_1_DETAILS' && (
          <EmployeeDetailTable
            records={records}
            selectedShiftFilter={selectedShiftFilter}
            selectedDeptFilter={selectedDeptFilter}
            selectedCategoryFilter={selectedCategoryFilter}
            onSelectShift={setSelectedShiftFilter}
            onSelectDept={setSelectedDeptFilter}
            onSelectCategory={setSelectedCategoryFilter}
          />
        )}

        {/* Tab 2: Contractor (WAS) Detail Table */}
        {activeTab === 'PAGE_2_CONTRACTOR' && (
          <ContractorScanRecordsView
            recordsByDate={contractorRecordsByDate}
            currentDateFormatted={dateStringFormatted}
            onRefreshData={handleFetchContractorData}
            isLoading={isContractorLoading}
            onSelectDate={handleSelectDateFromOhpa}
          />
        )}

        {/* Tab 3: Standard HC Comparison Table */}
        {activeTab === 'PAGE_3_MANPOWER' && (
          <ManpowerGapTable data={manpowerComparison} />
        )}

        {/* Tab 4: OHPA Calculation View */}
        {activeTab === 'PAGE_4_OHPA' && (
          <OhpaCalculationView
            records={records}
            contractorRecords={currentContractorRecords}
            currentScanDateFormatted={dateStringFormatted}
            onSelectGlobalDate={handleSelectDateFromOhpa}
          />
        )}
      </main>

      {/* File Upload Modal */}
      <FileUploaderModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadScanContent={handleUploadScanContent}
        onUpdateEmployeeMapping={handleUpdateEmployeeMapping}
        onFetchFolderScans={handleFetchFolderScans}
        onOpenFolderInExplorer={handleOpenFolderInExplorer}
        onBatchUploadFiles={handleBatchUploadFiles}
      />

      {/* Daily Adjustment Modal */}
      <DailyAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        currentDateFormatted={dateStringFormatted}
        adjustments={dailyAdjustments}
        onSaveAdjustments={handleSaveAdjustments}
        employeeMap={employeeMapping}
      />
    </div>
  );
}
