import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { EmployeeDetailTable } from './components/EmployeeDetailTable';
import { ManpowerGapTable } from './components/ManpowerGapTable';
import { FileUploaderModal } from './components/FileUploaderModal';
import { DailyAdjustmentModal } from './components/DailyAdjustmentModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminSettingsModal } from './components/AdminSettingsModal';
import { OhpaCalculationView } from './components/OhpaCalculationView';
import { ContractorScanRecordsView } from './components/ContractorScanRecordsView';
import { DashboardView } from './components/DashboardView';

import { SCAN_FILE_PRESETS, DEFAULT_SCAN_CONTENT, DEFAULT_FILE_NAME, ScanPreset } from './data/default_scan_record';
import defaultEmpMappingRaw from './data/default_emp_mapping.json';
import defaultAdjustmentsRaw from './data/default_adjustments.json';
import { DEFAULT_CONTRACTOR_MAPPING, DEFAULT_CONTRACTOR_RECORDS_BY_DATE } from './data/default_contractor_data';
import { DEFAULT_PDI_BEAD_REPORT, PdiBeadReport } from './data/default_pdi_bead';
import { DEFAULT_RETREAD_TONNAGE, RetreadTonnageData } from './data/default_retread_tonnage';
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
  Users,
  LayoutDashboard
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

  // PDI Deduct & B-end (Bead) state
  const [pdiBeadReport, setPdiBeadReport] = useState<PdiBeadReport>(() => {
    try {
      const saved = localStorage.getItem('ohpa_pdi_bead_report');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.pdiDailyTotals) return parsed;
      }
      return DEFAULT_PDI_BEAD_REPORT;
    } catch {
      return DEFAULT_PDI_BEAD_REPORT;
    }
  });

  // Retread SAP Tonnage state
  const [retreadTonnage, setRetreadTonnage] = useState<RetreadTonnageData>(() => {
    try {
      const saved = localStorage.getItem('ohpa_retread_tonnage');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.dailyKgByDate && Object.keys(parsed.dailyKgByDate).length > 0) return parsed;
      }
      return DEFAULT_RETREAD_TONNAGE;
    } catch {
      return DEFAULT_RETREAD_TONNAGE;
    }
  });

  const [dailyAdjustments, setDailyAdjustments] = useState<DailyAdjustmentRecord[]>(() => {
    try {
      const defaults = (defaultAdjustmentsRaw as DailyAdjustmentRecord[]) || [];
      const saved = localStorage.getItem('ohpa_daily_adjustments');
      if (saved) {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sanitize any legacy cached entries where แทน WAS was stored under regularMachineOverride
          parsed = parsed.map((a: DailyAdjustmentRecord) => {
            if (a.regularMachineOverride && a.regularMachineOverride.includes('แทน WAS')) {
              return {
                ...a,
                otMachineOverride: 'แทน WAS',
                regularMachineOverride: undefined
              };
            }
            return a;
          });
          const existingKeys = new Set(parsed.map((a: DailyAdjustmentRecord) => `${a.dateStr}_${(a.empId || '').replace(/\D/g, '').padStart(5, '0')}`));
          const defaultsToAdd = defaults.filter(
            d => !existingKeys.has(`${d.dateStr}_${(d.empId || '').replace(/\D/g, '').padStart(5, '0')}`)
          );
          return [...parsed, ...defaultsToAdd];
        }
      }
      return defaults;
    } catch {
      return (defaultAdjustmentsRaw as DailyAdjustmentRecord[]) || [];
    }
  });

  const [selectedShiftFilter, setSelectedShiftFilter] = useState<number | 'ALL'>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'PAGE_1_DETAILS' | 'PAGE_2_CONTRACTOR' | 'PAGE_3_MANPOWER' | 'PAGE_4_OHPA' | 'PAGE_5_DASHBOARD'>('PAGE_1_DETAILS');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false);
  const [toastNotification, setToastNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Admin Security & Authentication State
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('ohpa_is_admin') === 'true';
    } catch {
      return false;
    }
  });
  const [adminPasswordHash, setAdminPasswordHash] = useState<string>(() => {
    try {
      return localStorage.getItem('ohpa_admin_password') || '1234';
    } catch {
      return '1234';
    }
  });
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState<boolean>(false);
  const [isAdminSettingsModalOpen, setIsAdminSettingsModalOpen] = useState<boolean>(false);
  const [pendingAdminAction, setPendingAdminAction] = useState<(() => void) | null>(null);

  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    try {
      sessionStorage.setItem('ohpa_is_admin', 'true');
    } catch {}
    setToastNotification({
      type: 'success',
      message: '👑 เข้าสู่ระบบผู้ดูแลระบบ (Admin Mode) สำเร็จ'
    });
    if (pendingAdminAction) {
      pendingAdminAction();
      setPendingAdminAction(null);
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    try {
      sessionStorage.removeItem('ohpa_is_admin');
    } catch {}
    setToastNotification({
      type: 'success',
      message: '🔒 ออกจากระบบ Admin เรียบร้อยแล้ว (โหมดอ่านอย่างเดียว)'
    });
  };

  const handleUpdateAdminPassword = (newPass: string) => {
    setAdminPasswordHash(newPass);
    try {
      localStorage.setItem('ohpa_admin_password', newPass);
    } catch {}
    setToastNotification({
      type: 'success',
      message: 'เปลี่ยนรหัสผ่าน Admin เรียบร้อยแล้ว'
    });
  };

  const handleUpdatePdiBeadReport = (newReport: PdiBeadReport) => {
    setPdiBeadReport(newReport);
    try {
      localStorage.setItem('ohpa_pdi_bead_report', JSON.stringify(newReport));
    } catch {}
    setToastNotification({
      type: 'success',
      message: '✅ อัปเดตข้อมูล OPAH Hour (PDI Deduct & B-end Bead) สำเร็จแล้ว'
    });
  };

  const handleOpenUploadProtected = () => {
    if (isAdmin) {
      setIsUploadModalOpen(true);
    } else {
      setPendingAdminAction(() => () => setIsUploadModalOpen(true));
      setIsAdminLoginModalOpen(true);
    }
  };

  const handleOpenAdjustmentProtected = () => {
    if (isAdmin) {
      handleSyncAdjustments(true);
    } else {
      setPendingAdminAction(() => () => handleSyncAdjustments(true));
      setIsAdminLoginModalOpen(true);
    }
  };

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
    handleFetchFolderScans(false);
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

  // Fetch ALL data from network/local folders (GY Scans, Cont Hourly+Monthly, PDI/NPI & B-end Bead, Adjustments)
  const handleFetchFolderScans = async (isManual = true): Promise<{ success: boolean; message: string; fileCount?: number }> => {
    setIsLoadingFolder(true);
    const syncSummary: string[] = [];

    try {
      // 1. Fetch GY Scans from /api/scan-folder
      let gyFilesCount = 0;
      try {
        const scanRes = await fetch('/api/scan-folder');
        if (scanRes.ok) {
          const scanData = await scanRes.json();
          const files: RawScanFileItem[] = scanData.files || [];
          if (files.length > 0) {
            const newPresets = createPresetsFromScanFiles(files);
            if (newPresets.length > 0) {
              setPresets(newPresets);
              setScanContent(newPresets[0].content);
              setSelectedFileId(newPresets[0].id);
              setSelectedShiftFilter('ALL');
              setSelectedDeptFilter('ALL');
              gyFilesCount = files.length;
              syncSummary.push(`สแกนนิ้ว GY (${newPresets.length} วัน)`);
            }
          }
        }
      } catch (e: any) {
        console.warn('Sync GY scans error:', e);
      }

      // 2. Fetch Contractor WAS (Hourly + Monthly 9 staff) from /api/contractor-data
      try {
        const contRes = await fetch('/api/contractor-data');
        if (contRes.ok) {
          const contData = await contRes.json();
          if (contData.success && contData.recordsByDate && Object.keys(contData.recordsByDate).length > 0) {
            setContractorRecordsByDate(contData.recordsByDate);
            syncSummary.push(`Contractor WAS (${contData.employeeCount || 84} คน, ${contData.datesCount} วัน)`);
          }
        }
      } catch (e: any) {
        console.warn('Sync contractor data error:', e);
      }

      // 3. Fetch PDI/NPI (E-end) & B-end Bead from /api/sync-pdi-bead
      try {
        const pdiRes = await fetch('/api/sync-pdi-bead');
        if (pdiRes.ok) {
          const pdiData = await pdiRes.json();
          if (pdiData.success && pdiData.report) {
            setPdiBeadReport(pdiData.report);
            try {
              localStorage.setItem('ohpa_pdi_bead_report', JSON.stringify(pdiData.report));
            } catch (e) {}
            syncSummary.push('PDI/NPI & B-end Bead');
          }
        }
      } catch (e: any) {
        console.warn('Sync PDI/Bead error:', e);
      }

      // 4. Fetch Daily Adjustments from /api/sync-adjustments
      try {
        const adjRes = await fetch('/api/sync-adjustments');
        if (adjRes.ok) {
          const adjData = await adjRes.json();
          if (adjData.success && Array.isArray(adjData.adjustments)) {
            setDailyAdjustments(adjData.adjustments);
            try {
              localStorage.setItem('ohpa_daily_adjustments', JSON.stringify(adjData.adjustments));
            } catch (e) {}
            syncSummary.push(`ปรับตำแหน่ง/OT (${adjData.adjustments.length} รายการ)`);
          }
        }
      } catch (e: any) {
        console.warn('Sync adjustments error:', e);
      }

      // 5. Fetch Retread Tonnage from /api/sync-retread-tonnage
      try {
        const retreadRes = await fetch('/api/sync-retread-tonnage');
        if (retreadRes.ok) {
          const retreadData = await retreadRes.json();
          if (retreadData.success && retreadData.data) {
            setRetreadTonnage(retreadData.data);
            try {
              localStorage.setItem('ohpa_retread_tonnage', JSON.stringify(retreadData.data));
            } catch (e) {}
            syncSummary.push('Retread Tonnage SAP');
          }
        }
      } catch (e: any) {
        console.warn('Sync retread tonnage error:', e);
      }

      if (syncSummary.length > 0) {
        const successMsg = `ดึงข้อมูลครบทุกส่วนสำเร็จ! (${syncSummary.join(' | ')})`;
        if (isManual) {
          setToastNotification({ type: 'success', message: successMsg });
        }
        return {
          success: true,
          message: successMsg,
          fileCount: gyFilesCount
        };
      } else {
        const msg = 'ไม่สามารถดึงข้อมูลจากโฟลเดอร์หรือ API ได้ (โปรดตรวจสอบการเชื่อมต่อไดรฟ์ T:)';
        if (isManual) {
          setToastNotification({ type: 'error', message: msg });
        }
        return { success: false, message: msg };
      }
    } catch (err: any) {
      const errMsg = err.message || 'ไม่สามารถเชื่อมต่อ Local API ได้';
      if (isManual) {
        setToastNotification({ type: 'error', message: `เกิดข้อผิดพลาด: ${errMsg}` });
      }
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

  const [isSyncingAdjustments, setIsSyncingAdjustments] = useState<boolean>(false);

  const handleSyncAdjustments = async (openModal = false) => {
    setIsSyncingAdjustments(true);
    try {
      const response = await fetch('/api/sync-adjustments');
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.adjustments)) {
          setDailyAdjustments(data.adjustments);
          try {
            localStorage.setItem('ohpa_daily_adjustments', JSON.stringify(data.adjustments));
          } catch (e) {}
          setToastNotification({
            type: 'success',
            message: `🔄 ซิงค์ข้อมูลการย้ายเครื่อง/OT จาก Excel สำเร็จ (${data.adjustments.length} รายการ)`
          });
        } else if (data.message) {
          setToastNotification({
            type: 'error',
            message: data.message
          });
        }
      }
    } catch (err: any) {
      console.warn('Sync adjustments API error:', err);
    } finally {
      setIsSyncingAdjustments(false);
      if (openModal) {
        setIsAdjustmentModalOpen(true);
      }
    }
  };

  // Count adjustments for current date
  const currentDateAdjustmentsCount = useMemo(() => {
    const cleanCurrentDate = dateStringFormatted.trim();
    const normCur = normalizeDateToMMDDYYYY(cleanCurrentDate);
    return dailyAdjustments.filter(a => {
      const adjDate = (a.dateStr || '').trim();
      if (!adjDate || adjDate === 'ALL') return true;
      const normAdj = normalizeDateToMMDDYYYY(adjDate);
      if (normAdj === normCur) return true;
      if (normAdj.length === 8 && normCur.length === 8 && normAdj.slice(0, 4) === normCur.slice(0, 4)) return true;
      return adjDate === cleanCurrentDate;
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
        isAdmin={isAdmin}
        onSelectPreset={handleSelectPreset}
        onFetchFolderScans={() => {
          handleFetchFolderScans();
          handleFetchContractorData();
        }}
        onOpenFolderInExplorer={handleOpenFolderInExplorer}
        onOpenUploadModal={handleOpenUploadProtected}
        onResetToDefault={handleResetToDefault}
        onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
        onOpenAdminSettings={() => setIsAdminSettingsModalOpen(true)}
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
        {/* Tab Navigation (5 Pages) */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
          {/* Page 1 Tab: GY Scans */}
          <button
            onClick={() => setActiveTab('PAGE_1_DETAILS')}
            className={`py-3 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'PAGE_1_DETAILS'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck className="w-4.5 h-4.5 shrink-0" />
            <span className="truncate">ตารางสแกนนิ้ว (GY)</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold shrink-0 ${
              activeTab === 'PAGE_1_DETAILS' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {records.length} คน
            </span>
          </button>

          {/* Page 2 Tab: Contractor WAS Scans */}
          <button
            onClick={() => setActiveTab('PAGE_2_CONTRACTOR')}
            className={`py-3 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'PAGE_2_CONTRACTOR'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HardHat className="w-4.5 h-4.5 shrink-0" />
            <span className="truncate">ตารางสแกนนิ้ว (Cont)</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold shrink-0 ${
              activeTab === 'PAGE_2_CONTRACTOR' ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-800'
            }`}>
              {currentContractorCount} คน
            </span>
          </button>

          {/* Page 3 Tab: Standard Manpower Comparison */}
          <button
            onClick={() => setActiveTab('PAGE_3_MANPOWER')}
            className={`py-3 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'PAGE_3_MANPOWER'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TableProperties className="w-4.5 h-4.5 shrink-0" />
            <span className="truncate">ตาราง Standard HC</span>
          </button>

          {/* Page 4 Tab: OPAH CAL */}
          <button
            onClick={() => setActiveTab('PAGE_4_OHPA')}
            className={`py-3 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'PAGE_4_OHPA'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-4.5 h-4.5 shrink-0" />
            <span className="truncate">OPAH CAL</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold shrink-0 ${
              activeTab === 'PAGE_4_OHPA' ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700'
            }`}>
              55012
            </span>
          </button>

          {/* Page 5 Tab: Dashboard */}
          <button
            onClick={() => setActiveTab('PAGE_5_DASHBOARD')}
            className={`py-3 px-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer col-span-2 md:col-span-1 xl:col-span-1 ${
              activeTab === 'PAGE_5_DASHBOARD'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-4.5 h-4.5 shrink-0" />
            <span className="truncate">หน้า 5: แดชบอร์ด</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold shrink-0 ${
              activeTab === 'PAGE_5_DASHBOARD' ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-800'
            }`}>
              ชม. & OT
            </span>
          </button>
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
            allScanPresets={presets}
            contractorRecordsByDate={contractorRecordsByDate}
            employeeMapping={employeeMapping}
            dailyAdjustments={dailyAdjustments}
            pdiBeadReport={pdiBeadReport}
            retreadTonnage={retreadTonnage}
          />
        )}

        {/* Tab 5: Executive Dashboard View (Page 5) */}
        {activeTab === 'PAGE_5_DASHBOARD' && (
          <DashboardView
            gyRecords={records}
            contractorRecords={currentContractorRecords}
            employeeMapping={employeeMapping}
            currentScanDateFormatted={dateStringFormatted}
            allScanPresets={presets}
            contractorRecordsByDate={contractorRecordsByDate}
            onSelectDate={handleSelectDateFromOhpa}
            dailyAdjustments={dailyAdjustments}
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
        onSyncFromExcel={() => handleSyncAdjustments(false)}
        isSyncing={isSyncingAdjustments}
      />

      {/* Admin Authentication Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => {
          setIsAdminLoginModalOpen(false);
          setPendingAdminAction(null);
        }}
        onLoginSuccess={handleAdminLoginSuccess}
        adminPasswordHash={adminPasswordHash}
      />

      {/* Admin Control / Settings Modal */}
      <AdminSettingsModal
        isOpen={isAdminSettingsModalOpen}
        onClose={() => setIsAdminSettingsModalOpen(false)}
        onLogout={handleAdminLogout}
        currentPasswordHash={adminPasswordHash}
        onUpdatePassword={handleUpdateAdminPassword}
        pdiBeadReport={pdiBeadReport}
        onUpdatePdiBeadReport={handleUpdatePdiBeadReport}
      />
    </div>
  );
}
