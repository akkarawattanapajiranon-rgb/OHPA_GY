import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { EmployeeDetailTable } from './components/EmployeeDetailTable';
import { ManpowerGapTable } from './components/ManpowerGapTable';
import { FileUploaderModal } from './components/FileUploaderModal';

import { SCAN_FILE_PRESETS, DEFAULT_SCAN_CONTENT, DEFAULT_FILE_NAME, ScanPreset } from './data/default_scan_record';
import defaultEmpMappingRaw from './data/default_emp_mapping.json';
import { processScanRecords, createPresetsFromScanFiles, RawScanFileItem } from './utils/parser';
import { EmployeeInfo } from './types/attendance';
import {
  TableProperties,
  UserCheck,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function App() {
  const [presets, setPresets] = useState<ScanPreset[]>(SCAN_FILE_PRESETS);
  const [scanContent, setScanContent] = useState<string>(DEFAULT_SCAN_CONTENT);
  const [selectedFileId, setSelectedFileId] = useState<string>(DEFAULT_FILE_NAME);
  const [employeeMapping, setEmployeeMapping] = useState<Record<string, EmployeeInfo>>(
    defaultEmpMappingRaw as Record<string, EmployeeInfo>
  );

  const [selectedShiftFilter, setSelectedShiftFilter] = useState<number | 'ALL'>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'PAGE_1_DETAILS' | 'PAGE_2_MANPOWER'>('PAGE_1_DETAILS');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
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

  // Core processing - 1 row per employee, 100% sync with Standard HC
  const processedData = useMemo(() => {
    return processScanRecords(scanContent, employeeMapping);
  }, [scanContent, employeeMapping]);

  const {
    records,
    manpowerComparison,
    dateStringFormatted
  } = processedData;

  const mappedEmployeeCount = useMemo(() => {
    return Object.keys(employeeMapping).length;
  }, [employeeMapping]);

  const handleSelectPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setScanContent(preset.content);
      setSelectedFileId(preset.id);
      setSelectedShiftFilter('ALL');
      setSelectedDeptFilter('ALL');
    }
  };

  const handleUploadScanContent = (content: string, name: string) => {
    setScanContent(content);
    setSelectedFileId(name);
    setSelectedShiftFilter('ALL');
    setSelectedDeptFilter('ALL');
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
      const msg = err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      setToastNotification({ type: 'error', message: `ดึงข้อมูลไม่สำเร็จ: ${msg}` });
      return { success: false, message: msg };
    } finally {
      setIsLoadingFolder(false);
    }
  };

  // Open scans/ folder in Windows Explorer
  const handleOpenFolderInExplorer = async () => {
    try {
      await fetch('/api/open-folder');
    } catch (e) {
      console.error('Cannot open explorer folder:', e);
    }
  };

  // Batch upload picked files from local folder
  const handleBatchUploadFiles = (files: { fileName: string; content: string }[]) => {
    if (files.length === 0) return;
    const newPresets = createPresetsFromScanFiles(files);
    if (newPresets.length > 0) {
      setPresets(newPresets);
      setScanContent(newPresets[0].content);
      setSelectedFileId(newPresets[0].id);
      setSelectedShiftFilter('ALL');
      setSelectedDeptFilter('ALL');
      setToastNotification({
        type: 'success',
        message: `นำเข้าข้อมูล ${files.length} ไฟล์สำเร็จ! (${newPresets.length} วัน)`
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-12">
      {/* Navbar Header */}
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
        {/* Tab Navigation (2 Pages Only) */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Page 1 Tab */}
            <button
              onClick={() => setActiveTab('PAGE_1_DETAILS')}
              className={`flex-1 sm:flex-none py-2.5 px-5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'PAGE_1_DETAILS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <TableProperties className="w-4 h-4" />
              <span>หน้า 1: ตารางรายบุคคล (ไม่ซ้ำรายชื่อ)</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'PAGE_1_DETAILS' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {records.length} คน
              </span>
            </button>

            {/* Page 2 Tab */}
            <button
              onClick={() => setActiveTab('PAGE_2_MANPOWER')}
              className={`flex-1 sm:flex-none py-2.5 px-5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'PAGE_2_MANPOWER'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>หน้า 2: ตารางเปรียบเทียบ Standard HC vs สแกนนิ้วจริง</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 px-3">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span>ข้อมูลวันที่: <strong className="text-slate-800">{dateStringFormatted}</strong></span>
          </div>
        </div>

        {/* Tab 1: Employee Detail Table */}
        {activeTab === 'PAGE_1_DETAILS' && (
          <EmployeeDetailTable
            records={records}
            selectedShiftFilter={selectedShiftFilter}
            selectedDeptFilter={selectedDeptFilter}
            onSelectShift={setSelectedShiftFilter}
            onSelectDept={setSelectedDeptFilter}
          />
        )}

        {/* Tab 2: Standard HC Comparison Table */}
        {activeTab === 'PAGE_2_MANPOWER' && (
          <ManpowerGapTable data={manpowerComparison} />
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
    </div>
  );
}
