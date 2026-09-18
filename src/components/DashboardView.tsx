import React, { useState, useMemo } from 'react';
import { ParsedShiftRecord, EmployeeInfo, DailyAdjustmentRecord } from '../types/attendance';
import { ContractorScanRecord } from '../types/contractor';
import { ScanPreset } from '../data/default_scan_record';
import { getMonthlyStaffMetrics } from '../utils/ohpaCalculator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  Users,
  Clock,
  Flame,
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  Filter,
  Layers,
  Briefcase,
  HardHat,
  UserCheck,
  Calendar,
  Sparkles,
  Building2,
  ChevronUp,
  SlidersHorizontal,
  CheckCircle2,
  TrendingUp,
  LayoutDashboard
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DashboardViewProps {
  gyRecords: ParsedShiftRecord[];
  contractorRecords: ContractorScanRecord[];
  employeeMapping: Record<string, EmployeeInfo>;
  currentScanDateFormatted: string;
  allScanPresets?: ScanPreset[];
  contractorRecordsByDate?: Record<string, { dateFormatted: string; dateShort: string; isoDate: string; records: ContractorScanRecord[] }>;
  onSelectDate?: (dateFormatted: string) => void;
  dailyAdjustments?: DailyAdjustmentRecord[];
}

export type EmployeeGroupType = 'GY_HOURLY' | 'CONTRACTOR_HOURLY' | 'WAS_MONTHLY';

export interface UnifiedWorkerRecord {
  empId: string;
  name: string;
  group: EmployeeGroupType;
  groupLabel: string;
  dept: string;
  costCenter: string;
  manager: string;
  machine: string;
  position: string;
  shift: number;
  shiftLabel: string;
  normalHours: number;
  otHours: number;
  totalHours: number;
  isLate?: boolean;
}

export interface MachineAggregatedStats {
  machine: string;
  dept: string;
  manager: string;
  gyCount: number;
  gyNormalHours: number;
  gyOtHours: number;
  gyTotalHours: number;
  contractorCount: number;
  contractorNormalHours: number;
  contractorOtHours: number;
  contractorTotalHours: number;
  monthlyCount: number;
  monthlyNormalHours: number;
  monthlyTotalHours: number;
  totalCount: number;
  totalNormalHours: number;
  totalOtHours: number;
  grandTotalHours: number;
  workers: UnifiedWorkerRecord[];
}

export interface DeptAggregatedStats {
  dept: string;
  costCenter: string;
  manager: string;
  gyCount: number;
  gyNormalHours: number;
  gyOtHours: number;
  gyTotalHours: number;
  contractorCount: number;
  contractorNormalHours: number;
  contractorOtHours: number;
  contractorTotalHours: number;
  monthlyCount: number;
  monthlyNormalHours: number;
  monthlyTotalHours: number;
  totalCount: number;
  totalNormalHours: number;
  totalOtHours: number;
  grandTotalHours: number;
  machines: Record<string, MachineAggregatedStats>;
  workers: UnifiedWorkerRecord[];
}

export interface ManagerAggregatedStats {
  manager: string;
  gyCount: number;
  gyNormalHours: number;
  gyOtHours: number;
  gyTotalHours: number;
  contractorCount: number;
  contractorNormalHours: number;
  contractorOtHours: number;
  contractorTotalHours: number;
  monthlyCount: number;
  monthlyNormalHours: number;
  monthlyTotalHours: number;
  totalCount: number;
  totalNormalHours: number;
  totalOtHours: number;
  grandTotalHours: number;
  departments: Record<string, DeptAggregatedStats>;
  workers: UnifiedWorkerRecord[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  gyRecords,
  contractorRecords,
  employeeMapping,
  currentScanDateFormatted,
  allScanPresets = [],
  contractorRecordsByDate = {},
  onSelectDate,
  dailyAdjustments = []
}) => {
  const [filterGroup, setFilterGroup] = useState<'ALL' | 'GY' | 'CONTRACTOR' | 'MONTHLY'>('ALL');
  const [selectedManagerFilter, setSelectedManagerFilter] = useState<string>('ALL');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('ALL');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Expanded rows state for accordion/drilldown
  const [expandedManagers, setExpandedManagers] = useState<Record<string, boolean>>({});
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});
  const [expandedMachines, setExpandedMachines] = useState<Record<string, boolean>>({});

  // 1. Resolve Monthly Staff Metrics for the selected date (WAS only, 9 persons)
  const monthlyMetrics = useMemo(() => {
    return getMonthlyStaffMetrics(currentScanDateFormatted);
  }, [currentScanDateFormatted]);

  // 2. Build Unified Worker Records across GY, Contractor Hourly, and WAS Monthly
  const unifiedWorkers = useMemo<UnifiedWorkerRecord[]>(() => {
    const list: UnifiedWorkerRecord[] = [];

    // Group 1: GY Employees (Shift / Daily)
    gyRecords.forEach((r) => {
      const normalH = r.normalWorkHours || 0;
      const otH = r.otHours || 0;
      const totalH = normalH + otH;
      if (totalH <= 0 && !r.inTime) return; // Skip non-working records

      const empInfo = employeeMapping[r.empId];
      const dept = (empInfo?.dept || r.dept || 'ไม่ระบุแผนก').trim();
      const costCenter = (empInfo?.costCenter || r.costCenter || '').trim();
      
      let manager = (empInfo?.manager || '').trim();
      if (!manager) {
        if (dept.startsWith('3200') || dept.startsWith('4110') || dept.startsWith('4200') || dept.startsWith('4300') || dept.startsWith('4400')) {
          manager = 'Akkarawat Tanapatjiranon (BCA)';
        } else if (dept.startsWith('5110') || dept.startsWith('5130')) {
          manager = 'Thirachai Sornvichai (Consumer)';
        } else if (dept.startsWith('A5110') || dept.startsWith('A5130') || dept.startsWith('A5210') || dept.startsWith('A5230')) {
          manager = 'Kawee Tantisattayarak (Aviation)';
        } else if (dept.startsWith('6320')) {
          manager = 'Retread Operations';
        } else if (dept.startsWith('1110')) {
          manager = 'Tanu Itthirattanakomon (Engineering)';
        } else if (dept.startsWith('1040')) {
          manager = 'Vattana Waewmanee (Quality)';
        } else {
          manager = 'Goodyear Operations (Unassigned)';
        }
      }

      const machine = (
        r.regularMachineOverride ||
        r.otMachineOverride ||
        empInfo?.machine ||
        r.machine ||
        r.position ||
        'General / งานทั่วไป'
      ).trim();

      list.push({
        empId: r.empId,
        name: r.nameTH || r.nameEN || empInfo?.nameTH || empInfo?.nameEN || `พนักงาน ${r.empId}`,
        group: 'GY_HOURLY',
        groupLabel: 'พนักงาน GY',
        dept,
        costCenter,
        manager,
        machine: machine || 'General / งานทั่วไป',
        position: empInfo?.position || r.position || '-',
        shift: r.shift,
        shiftLabel: r.shiftLabel,
        normalHours: normalH,
        otHours: otH,
        totalHours: totalH,
        isLate: r.isLate
      });
    });

    // Group 2: Contractor Hourly (WAS Shift Workers)
    contractorRecords.forEach((c) => {
      const normalH = c.normalHours || 0;
      const otH = c.otHours || 0;
      const totalH = normalH + otH;
      if (totalH <= 0) return; // Skip 0-hour records completely

      const empInfo = employeeMapping[c.empCode];
      const dept = (c.department || empInfo?.dept || c.closing || 'Contractor WAS').trim();
      const costCenter = (c.closing || empInfo?.costCenter || '').trim();
      
      let manager = (empInfo?.manager || '').trim();
      if (!manager) {
        if (c.closing === '6320' || dept.includes('6320') || (c.location || '').toLowerCase().includes('retread')) {
          manager = 'Retread Operations';
        } else if (c.closing === '3200' || c.closing === '4110' || c.closing === '4200' || c.closing === '4300' || c.closing === '4400' || dept.includes('3200') || dept.includes('Banbury') || dept.includes('BCA')) {
          manager = 'Akkarawat Tanapatjiranon (BCA)';
        } else if (c.closing === '5110' || c.closing === '5130' || dept.includes('5110') || dept.includes('Consumer') || (c.location || '').toLowerCase().includes('consumer')) {
          manager = 'Thirachai Sornvichai (Consumer)';
        } else if (c.closing?.startsWith('A51') || c.closing?.startsWith('A52') || dept.includes('Aero') || (c.location || '').toLowerCase().includes('aero')) {
          manager = 'Kawee Tantisattayarak (Aviation)';
        } else if (c.closing === '1110' || dept.includes('1110') || dept.includes('Engineering')) {
          manager = 'Tanu Itthirattanakomon (Engineering)';
        } else if (c.closing === '1040' || dept.includes('1040') || dept.includes('Quality')) {
          manager = 'Vattana Waewmanee (Quality)';
        } else {
          manager = 'Goodyear Operations (Unassigned)';
        }
      }

      const machine = (
        c.position ||
        empInfo?.machine ||
        c.location ||
        'WAS Contractor General'
      ).trim();

      list.push({
        empId: c.empCode,
        name: c.nameTh || c.nameEn || empInfo?.nameTH || empInfo?.nameEN || `Contractor ${c.empCode}`,
        group: 'CONTRACTOR_HOURLY',
        groupLabel: 'Contractor รายชั่วโมง (WAS)',
        dept,
        costCenter,
        manager,
        machine: machine || 'WAS Contractor General',
        position: c.position || empInfo?.position || '-',
        shift: c.shiftNumber || 1,
        shiftLabel: c.shiftLabel || `กะ ${c.shiftNumber}`,
        normalHours: normalH,
        otHours: otH,
        totalHours: totalH
      });
    });

    // Group 3: WAS Monthly Staff (9 persons, GY Monthly excluded as per request)
    const wasMonthlyCount = monthlyMetrics.wasCount || 9;
    const wasMonthlyHoursPerPerson = monthlyMetrics.hoursPerPerson || 8;
    const wasMonthlyTotalHours = wasMonthlyCount * wasMonthlyHoursPerPerson;

    if (wasMonthlyTotalHours > 0) {
      for (let i = 1; i <= wasMonthlyCount; i++) {
        list.push({
          empId: `WAS-M${String(i).padStart(2, '0')}`,
          name: `เจ้าหน้าที่รายเดือน WAS ทีมที่ ${i}`,
          group: 'WAS_MONTHLY',
          groupLabel: 'รายเดือน (WAS)',
          dept: 'WAS Management & Supervisory',
          costCenter: 'WAS-MGMT',
          manager: 'World Asia Solution Management',
          machine: 'Supervisory & Administration',
          position: 'WAS Site Supervisor / Coordinator',
          shift: 1,
          shiftLabel: 'กะเช้า / Day Shift',
          normalHours: wasMonthlyHoursPerPerson,
          otHours: 0,
          totalHours: wasMonthlyHoursPerPerson
        });
      }
    }

    return list;
  }, [gyRecords, contractorRecords, employeeMapping, monthlyMetrics]);

  // 3. Extract unique list of Managers, Depts, Machines for filter dropdowns
  const availableManagers = useMemo(() => {
    return Array.from(new Set(unifiedWorkers.map(w => w.manager))).filter(Boolean).sort();
  }, [unifiedWorkers]);

  const availableDepts = useMemo(() => {
    return Array.from(new Set(unifiedWorkers.map(w => w.dept))).filter(Boolean).sort();
  }, [unifiedWorkers]);

  const availableMachines = useMemo(() => {
    return Array.from(new Set(unifiedWorkers.map(w => w.machine))).filter(Boolean).sort();
  }, [unifiedWorkers]);

  // 4. Apply Filters & Search to Unified Workers
  const filteredWorkers = useMemo(() => {
    return unifiedWorkers.filter(w => {
      // Group Filter
      if (filterGroup === 'GY' && w.group !== 'GY_HOURLY') return false;
      if (filterGroup === 'CONTRACTOR' && w.group !== 'CONTRACTOR_HOURLY') return false;
      if (filterGroup === 'MONTHLY' && w.group !== 'WAS_MONTHLY') return false;

      // Manager Filter
      if (selectedManagerFilter !== 'ALL' && w.manager !== selectedManagerFilter) return false;

      // Dept Filter
      if (selectedDeptFilter !== 'ALL' && w.dept !== selectedDeptFilter) return false;

      // Machine Filter
      if (selectedMachineFilter !== 'ALL' && w.machine !== selectedMachineFilter) return false;

      // Search Term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchEmpId = w.empId.toLowerCase().includes(term);
        const matchName = w.name.toLowerCase().includes(term);
        const matchManager = w.manager.toLowerCase().includes(term);
        const matchDept = w.dept.toLowerCase().includes(term);
        const matchMachine = w.machine.toLowerCase().includes(term);
        const matchPos = w.position.toLowerCase().includes(term);
        if (!matchEmpId && !matchName && !matchManager && !matchDept && !matchMachine && !matchPos) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedWorkers, filterGroup, selectedManagerFilter, selectedDeptFilter, selectedMachineFilter, searchTerm]);

  // 5. Build Aggregated Hierarchy by Manager -> Dept -> Machine
  const aggregatedByManager = useMemo<Record<string, ManagerAggregatedStats>>(() => {
    const managers: Record<string, ManagerAggregatedStats> = {};

    filteredWorkers.forEach(w => {
      if (!managers[w.manager]) {
        managers[w.manager] = {
          manager: w.manager,
          gyCount: 0,
          gyNormalHours: 0,
          gyOtHours: 0,
          gyTotalHours: 0,
          contractorCount: 0,
          contractorNormalHours: 0,
          contractorOtHours: 0,
          contractorTotalHours: 0,
          monthlyCount: 0,
          monthlyNormalHours: 0,
          monthlyTotalHours: 0,
          totalCount: 0,
          totalNormalHours: 0,
          totalOtHours: 0,
          grandTotalHours: 0,
          departments: {},
          workers: []
        };
      }

      const m = managers[w.manager];
      m.totalCount += 1;
      m.totalNormalHours += w.normalHours;
      m.totalOtHours += w.otHours;
      m.grandTotalHours += w.totalHours;
      m.workers.push(w);

      if (w.group === 'GY_HOURLY') {
        m.gyCount += 1;
        m.gyNormalHours += w.normalHours;
        m.gyOtHours += w.otHours;
        m.gyTotalHours += w.totalHours;
      } else if (w.group === 'CONTRACTOR_HOURLY') {
        m.contractorCount += 1;
        m.contractorNormalHours += w.normalHours;
        m.contractorOtHours += w.otHours;
        m.contractorTotalHours += w.totalHours;
      } else if (w.group === 'WAS_MONTHLY') {
        m.monthlyCount += 1;
        m.monthlyNormalHours += w.normalHours;
        m.monthlyTotalHours += w.totalHours;
      }

      // Department level
      if (!m.departments[w.dept]) {
        m.departments[w.dept] = {
          dept: w.dept,
          costCenter: w.costCenter,
          manager: w.manager,
          gyCount: 0,
          gyNormalHours: 0,
          gyOtHours: 0,
          gyTotalHours: 0,
          contractorCount: 0,
          contractorNormalHours: 0,
          contractorOtHours: 0,
          contractorTotalHours: 0,
          monthlyCount: 0,
          monthlyNormalHours: 0,
          monthlyTotalHours: 0,
          totalCount: 0,
          totalNormalHours: 0,
          totalOtHours: 0,
          grandTotalHours: 0,
          machines: {},
          workers: []
        };
      }

      const d = m.departments[w.dept];
      d.totalCount += 1;
      d.totalNormalHours += w.normalHours;
      d.totalOtHours += w.otHours;
      d.grandTotalHours += w.totalHours;
      d.workers.push(w);

      if (w.group === 'GY_HOURLY') {
        d.gyCount += 1;
        d.gyNormalHours += w.normalHours;
        d.gyOtHours += w.otHours;
        d.gyTotalHours += w.totalHours;
      } else if (w.group === 'CONTRACTOR_HOURLY') {
        d.contractorCount += 1;
        d.contractorNormalHours += w.normalHours;
        d.contractorOtHours += w.otHours;
        d.contractorTotalHours += w.totalHours;
      } else if (w.group === 'WAS_MONTHLY') {
        d.monthlyCount += 1;
        d.monthlyNormalHours += w.normalHours;
        d.monthlyTotalHours += w.totalHours;
      }

      // Machine level
      if (!d.machines[w.machine]) {
        d.machines[w.machine] = {
          machine: w.machine,
          dept: w.dept,
          manager: w.manager,
          gyCount: 0,
          gyNormalHours: 0,
          gyOtHours: 0,
          gyTotalHours: 0,
          contractorCount: 0,
          contractorNormalHours: 0,
          contractorOtHours: 0,
          contractorTotalHours: 0,
          monthlyCount: 0,
          monthlyNormalHours: 0,
          monthlyTotalHours: 0,
          totalCount: 0,
          totalNormalHours: 0,
          totalOtHours: 0,
          grandTotalHours: 0,
          workers: []
        };
      }

      const mc = d.machines[w.machine];
      mc.totalCount += 1;
      mc.totalNormalHours += w.normalHours;
      mc.totalOtHours += w.otHours;
      mc.grandTotalHours += w.totalHours;
      mc.workers.push(w);

      if (w.group === 'GY_HOURLY') {
        mc.gyCount += 1;
        mc.gyNormalHours += w.normalHours;
        mc.gyOtHours += w.otHours;
        mc.gyTotalHours += w.totalHours;
      } else if (w.group === 'CONTRACTOR_HOURLY') {
        mc.contractorCount += 1;
        mc.contractorNormalHours += w.normalHours;
        mc.contractorOtHours += w.otHours;
        mc.contractorTotalHours += w.totalHours;
      } else if (w.group === 'WAS_MONTHLY') {
        mc.monthlyCount += 1;
        mc.monthlyNormalHours += w.normalHours;
        mc.monthlyTotalHours += w.totalHours;
      }
    });

    return managers;
  }, [filteredWorkers]);

  // 6. Overall Grand Summary Totals
  const overallTotals = useMemo(() => {
    let gyCount = 0, gyNormal = 0, gyOt = 0, gyTotal = 0;
    let contCount = 0, contNormal = 0, contOt = 0, contTotal = 0;
    let monthlyCount = 0, monthlyNormal = 0, monthlyTotal = 0;

    Object.values(aggregatedByManager).forEach(m => {
      gyCount += m.gyCount;
      gyNormal += m.gyNormalHours;
      gyOt += m.gyOtHours;
      gyTotal += m.gyTotalHours;

      contCount += m.contractorCount;
      contNormal += m.contractorNormalHours;
      contOt += m.contractorOtHours;
      contTotal += m.contractorTotalHours;

      monthlyCount += m.monthlyCount;
      monthlyNormal += m.monthlyNormalHours;
      monthlyTotal += m.monthlyTotalHours;
    });

    const grandCount = gyCount + contCount + monthlyCount;
    const grandNormal = gyNormal + contNormal + monthlyNormal;
    const grandOt = gyOt + contOt;
    const grandTotal = grandNormal + grandOt;

    return {
      gyCount, gyNormal, gyOt, gyTotal,
      contCount, contNormal, contOt, contTotal,
      monthlyCount, monthlyNormal, monthlyTotal,
      grandCount, grandNormal, grandOt, grandTotal
    };
  }, [aggregatedByManager]);

  // 7. Chart Datasets
  // Chart 1: Manager Bar Chart (Normal Hours vs OT Hours)
  const managerChartData = useMemo(() => {
    return Object.values(aggregatedByManager)
      .map(m => {
        const shortName = m.manager.split(' ')[0] + (m.manager.includes('(') ? ' ' + m.manager.substring(m.manager.indexOf('(')) : '');
        return {
          name: shortName,
          fullName: m.manager,
          'ชม. ทำงานปกติ': m.totalNormalHours,
          'ชม. OT': m.totalOtHours,
          'ชม. รวมทั้งหมด': m.grandTotalHours,
          'จำนวนพนักงาน (คน)': m.totalCount
        };
      })
      .sort((a, b) => b['ชม. รวมทั้งหมด'] - a['ชม. รวมทั้งหมด']);
  }, [aggregatedByManager]);

  // Chart 2: Top 6 Machines with Highest OT Hours
  const topOtMachinesChartData = useMemo(() => {
    const allMachines: { name: string; dept: string; manager: string; otHours: number; normalHours: number; workers: number }[] = [];
    
    Object.values(aggregatedByManager).forEach(m => {
      Object.values(m.departments).forEach(d => {
        Object.values(d.machines).forEach(mc => {
          allMachines.push({
            name: mc.machine.length > 20 ? mc.machine.substring(0, 18) + '...' : mc.machine,
            dept: d.dept,
            manager: m.manager,
            otHours: mc.totalOtHours,
            normalHours: mc.totalNormalHours,
            workers: mc.totalCount
          });
        });
      });
    });

    return allMachines
      .filter(m => m.otHours > 0)
      .sort((a, b) => b.otHours - a.otHours)
      .slice(0, 6);
  }, [aggregatedByManager]);

  // Chart 3: Pie Chart of Total Hours by Group
  const groupPieData = useMemo(() => {
    return [
      { name: 'พนักงาน GY', value: overallTotals.gyTotal, color: '#3b82f6' },
      { name: 'Contractor รายชั่วโมง', value: overallTotals.contTotal, color: '#14b8a6' },
      { name: 'รายเดือน (WAS)', value: overallTotals.monthlyTotal, color: '#8b5cf6' }
    ].filter(d => d.value > 0);
  }, [overallTotals]);

  // Toggle expand / collapse helpers
  const toggleManager = (mgrName: string) => {
    setExpandedManagers(prev => ({ ...prev, [mgrName]: !prev[mgrName] }));
  };

  const toggleDept = (deptKey: string) => {
    setExpandedDepts(prev => ({ ...prev, [deptKey]: !prev[deptKey] }));
  };

  const toggleMachine = (machineKey: string) => {
    setExpandedMachines(prev => ({ ...prev, [machineKey]: !prev[machineKey] }));
  };

  const expandAll = () => {
    const mgrs: Record<string, boolean> = {};
    const depts: Record<string, boolean> = {};
    const machs: Record<string, boolean> = {};

    Object.values(aggregatedByManager).forEach(m => {
      mgrs[m.manager] = true;
      Object.values(m.departments).forEach(d => {
        depts[`${m.manager}_${d.dept}`] = true;
        Object.values(d.machines).forEach(mc => {
          machs[`${m.manager}_${d.dept}_${mc.machine}`] = true;
        });
      });
    });

    setExpandedManagers(mgrs);
    setExpandedDepts(depts);
    setExpandedMachines(machs);
  };

  const collapseAll = () => {
    setExpandedManagers({});
    setExpandedDepts({});
    setExpandedMachines({});
  };

  // Export Dashboard to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Manager Summary Sheet
    const managerRows: any[] = [];
    Object.values(aggregatedByManager).forEach(m => {
      managerRows.push({
        'Manager (ผู้จัดการ)': m.manager,
        'GY - จำนวนคน': m.gyCount,
        'GY - ชม. ปกติ': m.gyNormalHours,
        'GY - ชม. OT': m.gyOtHours,
        'GY - รวม ชม.': m.gyTotalHours,
        'Contractor - จำนวนคน': m.contractorCount,
        'Contractor - ชม. ปกติ': m.contractorNormalHours,
        'Contractor - ชม. OT': m.contractorOtHours,
        'Contractor - รวม ชม.': m.contractorTotalHours,
        'รายเดือน WAS - จำนวนคน': m.monthlyCount,
        'รายเดือน WAS - ชม. ปกติ': m.monthlyNormalHours,
        'รวมพนักงานทั้งหมด (คน)': m.totalCount,
        'รวม ชม. ปกติทั้งหมด': m.totalNormalHours,
        'รวม ชม. OT ทั้งหมด': m.totalOtHours,
        'รวมชั่วโมงทำงานสุทธิ (Grand Total)': m.grandTotalHours
      });
    });
    managerRows.push({
      'Manager (ผู้จัดการ)': 'รวมทั้งโรงงาน (Grand Total)',
      'GY - จำนวนคน': overallTotals.gyCount,
      'GY - ชม. ปกติ': overallTotals.gyNormal,
      'GY - ชม. OT': overallTotals.gyOt,
      'GY - รวม ชม.': overallTotals.gyTotal,
      'Contractor - จำนวนคน': overallTotals.contCount,
      'Contractor - ชม. ปกติ': overallTotals.contNormal,
      'Contractor - ชม. OT': overallTotals.contOt,
      'Contractor - รวม ชม.': overallTotals.contTotal,
      'รายเดือน WAS - จำนวนคน': overallTotals.monthlyCount,
      'รายเดือน WAS - ชม. ปกติ': overallTotals.monthlyNormal,
      'รวมพนักงานทั้งหมด (คน)': overallTotals.grandCount,
      'รวม ชม. ปกติทั้งหมด': overallTotals.grandNormal,
      'รวม ชม. OT ทั้งหมด': overallTotals.grandOt,
      'รวมชั่วโมงทำงานสุทธิ (Grand Total)': overallTotals.grandTotal
    });
    const wsManager = XLSX.utils.json_to_sheet(managerRows);
    XLSX.utils.book_append_sheet(wb, wsManager, 'สรุปแยก Manager');

    // 2. Department Breakdown Sheet
    const deptRows: any[] = [];
    Object.values(aggregatedByManager).forEach(m => {
      Object.values(m.departments).forEach(d => {
        deptRows.push({
          'Manager (ผู้จัดการ)': m.manager,
          'แผนก (Department)': d.dept,
          'รหัส Cost Center': d.costCenter,
          'GY - จำนวนคน': d.gyCount,
          'GY - ชม. ปกติ': d.gyNormalHours,
          'GY - ชม. OT': d.gyOtHours,
          'GY - รวม ชม.': d.gyTotalHours,
          'Contractor - จำนวนคน': d.contractorCount,
          'Contractor - ชม. ปกติ': d.contractorNormalHours,
          'Contractor - ชม. OT': d.contractorOtHours,
          'Contractor - รวม ชม.': d.contractorTotalHours,
          'รายเดือน WAS - จำนวนคน': d.monthlyCount,
          'รายเดือน WAS - ชม. ปกติ': d.monthlyNormalHours,
          'รวมพนักงานทั้งหมด (คน)': d.totalCount,
          'รวม ชม. ปกติทั้งหมด': d.totalNormalHours,
          'รวม ชม. OT ทั้งหมด': d.totalOtHours,
          'รวมชั่วโมงทำงานสุทธิ': d.grandTotalHours
        });
      });
    });
    const wsDept = XLSX.utils.json_to_sheet(deptRows);
    XLSX.utils.book_append_sheet(wb, wsDept, 'สรุปแยก แผนก');

    // 3. Machine / Position Breakdown Sheet
    const machineRows: any[] = [];
    Object.values(aggregatedByManager).forEach(m => {
      Object.values(m.departments).forEach(d => {
        Object.values(d.machines).forEach(mc => {
          machineRows.push({
            'Manager (ผู้จัดการ)': m.manager,
            'แผนก (Department)': d.dept,
            'เครื่องจักร / ตำแหน่ง (Machine)': mc.machine,
            'GY - จำนวนคน': mc.gyCount,
            'GY - ชม. ปกติ': mc.gyNormalHours,
            'GY - ชม. OT': mc.gyOtHours,
            'GY - รวม ชม.': mc.gyTotalHours,
            'Contractor - จำนวนคน': mc.contractorCount,
            'Contractor - ชม. ปกติ': mc.contractorNormalHours,
            'Contractor - ชม. OT': mc.contractorOtHours,
            'Contractor - รวม ชม.': mc.contractorTotalHours,
            'รายเดือน WAS - จำนวนคน': mc.monthlyCount,
            'รายเดือน WAS - ชม. ปกติ': mc.monthlyNormalHours,
            'รวมคนทั้งหมด': mc.totalCount,
            'รวม ชม. ปกติ': mc.totalNormalHours,
            'รวม ชม. OT': mc.totalOtHours,
            'รวมชั่วโมงทำงานสุทธิ': mc.grandTotalHours
          });
        });
      });
    });
    const wsMachine = XLSX.utils.json_to_sheet(machineRows);
    XLSX.utils.book_append_sheet(wb, wsMachine, 'สรุปแยก เครื่องจักร (Machine)');

    // 4. Raw Detail Workers Sheet
    const rawWorkerRows = filteredWorkers.map((w, idx) => ({
      'ลำดับ': idx + 1,
      'รหัสพนักงาน': w.empId,
      'ชื่อ-นามสกุล': w.name,
      'กลุ่มพนักงาน': w.groupLabel,
      'Manager (ผู้จัดการ)': w.manager,
      'แผนก (Department)': w.dept,
      'Cost Center': w.costCenter,
      'เครื่องจักร (Machine)': w.machine,
      'ตำแหน่ง (Position)': w.position,
      'กะการทำงาน': w.shiftLabel,
      'ชม. ทำงานปกติ': w.normalHours,
      'ชม. OT': w.otHours,
      'รวม ชม. ทำงาน': w.totalHours
    }));
    const wsRaw = XLSX.utils.json_to_sheet(rawWorkerRows);
    XLSX.utils.book_append_sheet(wb, wsRaw, 'รายชื่อพนักงานรายบุคคล');

    const cleanDate = currentScanDateFormatted.replace(/[/.-]/g, '');
    XLSX.writeFile(wb, `Dashboard_Working_OT_Hours_${cleanDate}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Banner & Top Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-900/40 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>หน้า 5 • ศูนย์รวมแดชบอร์ดชั่วโมงทำงาน & OT (Executive Dashboard)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              แดชบอร์ดสรุปชั่วโมงทำงานและ OT ประจำวัน
            </h2>
            <p className="text-sm text-indigo-200/80">
              จำแนกข้อมูลตาม <strong>3 กลุ่มพนักงาน</strong> (พนักงาน GY, Contractor รายชม., รายเดือน WAS) • สรุปและเจาะลึก <strong>แยกตาม Manager, แผนก และเครื่องจักร (Machine)</strong>
            </p>
          </div>

          {/* Right Action: Excel Export */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออก Excel แดชบอร์ด</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* KPI 1: Grand Total */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-indigo-200">
              <span className="text-xs font-medium">รวมชั่วโมงทำงานทั้งหมด</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black text-white">
                {overallTotals.grandTotal.toLocaleString()}
              </span>
              <span className="text-xs text-indigo-200">ชม. รวม</span>
            </div>
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs text-indigo-200">
              <span>ปกติ: <strong className="text-white">{overallTotals.grandNormal.toLocaleString()}</strong> ชม.</span>
              <span>OT: <strong className="text-amber-300">{overallTotals.grandOt.toLocaleString()}</strong> ชม.</span>
              <span>รวม <strong className="text-white">{overallTotals.grandCount}</strong> คน</span>
            </div>
          </div>

          {/* KPI 2: GY Hourly */}
          <div className="bg-blue-900/40 backdrop-blur-md p-4 rounded-2xl border border-blue-500/30 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-200">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-400" />
                1. พนักงาน GY
              </span>
              <span className="text-[11px] bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full font-bold">
                {overallTotals.gyCount} คน
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-300">
                {overallTotals.gyTotal.toLocaleString()}
              </span>
              <span className="text-xs text-blue-200">ชม. GY</span>
            </div>
            <div className="mt-2 pt-2 border-t border-blue-500/20 flex items-center justify-between text-xs text-blue-200">
              <span>ปกติ: <strong className="text-white">{overallTotals.gyNormal.toLocaleString()}</strong> ชม.</span>
              <span>OT: <strong className="text-amber-300">{overallTotals.gyOt.toLocaleString()}</strong> ชม.</span>
            </div>
          </div>

          {/* KPI 3: Contractor Hourly (WAS) */}
          <div className="bg-teal-900/40 backdrop-blur-md p-4 rounded-2xl border border-teal-500/30 flex flex-col justify-between">
            <div className="flex items-center justify-between text-teal-200">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <HardHat className="w-4 h-4 text-teal-400" />
                2. Contractor รายชม. (WAS)
              </span>
              <span className="text-[11px] bg-teal-500/30 text-teal-200 px-2 py-0.5 rounded-full font-bold">
                {overallTotals.contCount} คน
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-teal-300">
                {overallTotals.contTotal.toLocaleString()}
              </span>
              <span className="text-xs text-teal-200">ชม. Cont</span>
            </div>
            <div className="mt-2 pt-2 border-t border-teal-500/20 flex items-center justify-between text-xs text-teal-200">
              <span>ปกติ: <strong className="text-white">{overallTotals.contNormal.toLocaleString()}</strong> ชม.</span>
              <span>OT: <strong className="text-amber-300">{overallTotals.contOt.toLocaleString()}</strong> ชม.</span>
            </div>
          </div>

          {/* KPI 4: WAS Monthly Staff */}
          <div className="bg-purple-900/40 backdrop-blur-md p-4 rounded-2xl border border-purple-500/30 flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-200">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-purple-400" />
                3. รายเดือน (WAS Only)
              </span>
              <span className="text-[11px] bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full font-bold">
                {overallTotals.monthlyCount} คน
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black text-purple-300">
                {overallTotals.monthlyTotal.toLocaleString()}
              </span>
              <span className="text-xs text-purple-200">ชม. รายเดือน</span>
            </div>
            <div className="mt-2 pt-2 border-t border-purple-500/20 flex items-center justify-between text-xs text-purple-200">
              <span>ปกติ: <strong className="text-white">{overallTotals.monthlyNormal.toLocaleString()}</strong> ชม.</span>
              <span className="text-[11px] text-purple-300">({monthlyMetrics.hoursPerPerson} ชม./คน)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Charts Section (3 Interactive Visualizations) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Normal Hours vs OT Hours by Manager */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ชั่วโมงทำงานปกติ และ OT แยกตาม Manager</h3>
                <p className="text-xs text-slate-500">เปรียบเทียบชั่วโมงปกติ (Normal) และโอเวอร์ไทม์ (OT) ของแต่ละสายงาน</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-500 inline-block"></span> ชม. ปกติ</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block"></span> ชม. OT</span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={managerChartData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any, name: any) => [`${Number(val).toLocaleString()} ชม.`, name]}
                  labelFormatter={(label, payload) => {
                    const full = payload?.[0]?.payload?.fullName;
                    return full ? `Manager: ${full}` : label;
                  }}
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="ชม. ทำงานปกติ" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="ชม. OT" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Total Hours Share by 3 Groups */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <PieIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">สัดส่วน 3 กลุ่มพนักงาน</h3>
              <p className="text-xs text-slate-500">สัดส่วนชั่วโมงทำงานรวมทั้งโรงงาน</p>
            </div>
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={groupPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {groupPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString()} ชม. (${((Number(val) / (overallTotals.grandTotal || 1)) * 100).toFixed(1)}%)`, 'ชั่วโมง']}
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            {groupPieData.map((g, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }}></span>
                  {g.name}
                </span>
                <span className="font-bold text-slate-900">
                  {g.value.toLocaleString()} ชม. ({((g.value / (overallTotals.grandTotal || 1)) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 3: Top Machines by OT */}
      {topOtMachinesChartData.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Top 6 เครื่องจักร / ตำแหน่งที่มีชั่วโมง OT สูงสุด</h3>
              <p className="text-xs text-slate-500">ติดตามพื้นที่ที่มีการทำโอเวอร์ไทม์เข้มข้นที่สุดประจำวัน</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            {topOtMachinesChartData.map((m, idx) => (
              <div key={idx} className="bg-amber-50/60 border border-amber-200/70 p-3.5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-amber-800 font-bold mb-1">
                    <span>#{idx + 1}</span>
                    <span className="text-[11px] text-amber-600 font-medium">{m.workers} คน</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2" title={m.name}>
                    {m.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5" title={`${m.dept} • ${m.manager}`}>
                    {m.dept}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-amber-200/50 flex items-baseline justify-between">
                  <span className="text-xs text-amber-700 font-medium">OT:</span>
                  <span className="text-base font-black text-amber-600">
                    {m.otHours.toLocaleString()} <span className="text-[10px] font-normal">ชม.</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Filter & Search Toolbar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Employee Group Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
            <button
              onClick={() => setFilterGroup('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterGroup === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทุกกลุ่ม ({unifiedWorkers.length} คน)
            </button>
            <button
              onClick={() => setFilterGroup('GY')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterGroup === 'GY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              พนักงาน GY ({overallTotals.gyCount} คน)
            </button>
            <button
              onClick={() => setFilterGroup('CONTRACTOR')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterGroup === 'CONTRACTOR' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Contractor รายชม. ({overallTotals.contCount} คน)
            </button>
            <button
              onClick={() => setFilterGroup('MONTHLY')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterGroup === 'MONTHLY' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายเดือน WAS ({overallTotals.monthlyCount} คน)
            </button>
          </div>

          {/* Expand / Collapse All Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              ขยายทั้งหมด (+)
            </button>
            <button
              onClick={collapseAll}
              className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              ย่อทั้งหมด (-)
            </button>
          </div>
        </div>

        {/* Dropdowns & Search Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {/* Manager Dropdown */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1 block">กรองตาม Manager:</label>
            <select
              value={selectedManagerFilter}
              onChange={(e) => setSelectedManagerFilter(e.target.value)}
              className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">ผู้จัดการทั้งหมด ({availableManagers.length} ท่าน)</option>
              {availableManagers.map((m, idx) => (
                <option key={idx} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Department Dropdown */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1 block">กรองตาม แผนก:</label>
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">แผนกทั้งหมด ({availableDepts.length} แผนก)</option>
              {availableDepts.map((d, idx) => (
                <option key={idx} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Machine Dropdown */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1 block">กรองตาม เครื่องจักร (Machine):</label>
            <select
              value={selectedMachineFilter}
              onChange={(e) => setSelectedMachineFilter(e.target.value)}
              className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">เครื่องจักรทั้งหมด ({availableMachines.length} เครื่อง)</option>
              {availableMachines.map((mc, idx) => (
                <option key={idx} value={mc}>{mc}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1 block">ค้นหาด่วน:</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ชื่อ, รหัส, แผนก, เครื่องจักร..."
                className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Comprehensive Hierarchical Summary Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                ตารางสรุปชั่วโมงทำงานและ OT (ลำดับชั้น Manager ➔ แผนก ➔ เครื่องจักร)
              </h3>
              <p className="text-xs text-slate-500">
                คลิกแถว Manager เพื่อดูแผนกย่อย และคลิกแถวแผนกเพื่อดูรายการเครื่องจักร (Machine) รายบุคคล
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            แสดงข้อมูลผลลัพธ์: <strong className="text-indigo-600 font-bold">{Object.keys(aggregatedByManager).length}</strong> สายงาน Manager
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-4 w-72">โครงสร้าง (Manager / แผนก / เครื่องจักร)</th>
                <th className="py-3 px-3 text-center bg-blue-50/70 text-blue-900 border-l border-r border-blue-100" colSpan={4}>
                  🔵 1. พนักงาน GY
                </th>
                <th className="py-3 px-3 text-center bg-teal-50/70 text-teal-900 border-r border-teal-100" colSpan={4}>
                  🟢 2. Contractor รายชั่วโมง (WAS)
                </th>
                <th className="py-3 px-3 text-center bg-purple-50/70 text-purple-900 border-r border-purple-100" colSpan={2}>
                  🟣 3. รายเดือน WAS
                </th>
                <th className="py-3 px-3 text-center bg-amber-50/70 text-amber-950 font-black" colSpan={3}>
                  ⭐ รวมทุกกลุ่ม (Grand Total)
                </th>
              </tr>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-4">ชื่อกลุ่ม / สายงาน</th>
                {/* GY Subheaders */}
                <th className="py-2 px-2 text-center bg-blue-50/30 text-blue-800">คน</th>
                <th className="py-2 px-2 text-right bg-blue-50/30 text-blue-800">ปกติ</th>
                <th className="py-2 px-2 text-right bg-blue-50/30 text-amber-700 font-bold">OT</th>
                <th className="py-2 px-2 text-right bg-blue-50/30 text-blue-900 font-bold border-r border-blue-100">รวม</th>
                {/* Contractor Subheaders */}
                <th className="py-2 px-2 text-center bg-teal-50/30 text-teal-800">คน</th>
                <th className="py-2 px-2 text-right bg-teal-50/30 text-teal-800">ปกติ</th>
                <th className="py-2 px-2 text-right bg-teal-50/30 text-amber-700 font-bold">OT</th>
                <th className="py-2 px-2 text-right bg-teal-50/30 text-teal-900 font-bold border-r border-teal-100">รวม</th>
                {/* Monthly Subheaders */}
                <th className="py-2 px-2 text-center bg-purple-50/30 text-purple-800">คน</th>
                <th className="py-2 px-2 text-right bg-purple-50/30 text-purple-900 font-bold border-r border-purple-100">ปกติ</th>
                {/* Total Subheaders */}
                <th className="py-2 px-2 text-right bg-amber-50/30 text-slate-800 font-bold">ชม. ปกติ</th>
                <th className="py-2 px-2 text-right bg-amber-50/30 text-amber-700 font-bold">ชม. OT</th>
                <th className="py-2 px-3 text-right bg-amber-100/50 text-amber-950 font-black">รวม ชม.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.values(aggregatedByManager).map((m) => {
                const isMgrExpanded = !!expandedManagers[m.manager];

                return (
                  <React.Fragment key={m.manager}>
                    {/* Level 1 Row: Manager */}
                    <tr
                      onClick={() => toggleManager(m.manager)}
                      className={`font-bold transition-all cursor-pointer ${
                        isMgrExpanded ? 'bg-indigo-50/60' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 flex items-center gap-2">
                        {isMgrExpanded ? (
                          <ChevronDown className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="text-slate-900 text-xs sm:text-[13px] font-bold">
                          {m.manager}
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          ({Object.keys(m.departments).length} แผนก)
                        </span>
                      </td>

                      {/* GY */}
                      <td className="py-3 px-2 text-center text-blue-700">{m.gyCount || '-'}</td>
                      <td className="py-3 px-2 text-right text-slate-700">{m.gyNormalHours ? m.gyNormalHours.toLocaleString() : '-'}</td>
                      <td className="py-3 px-2 text-right text-amber-600 font-bold">{m.gyOtHours ? m.gyOtHours.toLocaleString() : '-'}</td>
                      <td className="py-3 px-2 text-right font-bold text-blue-900 border-r border-blue-100">
                        {m.gyTotalHours ? m.gyTotalHours.toLocaleString() : '-'}
                      </td>

                      {/* Contractor */}
                      <td className="py-3 px-2 text-center text-teal-700">{m.contractorCount || '-'}</td>
                      <td className="py-3 px-2 text-right text-slate-700">{m.contractorNormalHours ? m.contractorNormalHours.toLocaleString() : '-'}</td>
                      <td className="py-3 px-2 text-right text-amber-600 font-bold">{m.contractorOtHours ? m.contractorOtHours.toLocaleString() : '-'}</td>
                      <td className="py-3 px-2 text-right font-bold text-teal-900 border-r border-teal-100">
                        {m.contractorTotalHours ? m.contractorTotalHours.toLocaleString() : '-'}
                      </td>

                      {/* Monthly */}
                      <td className="py-3 px-2 text-center text-purple-700">{m.monthlyCount || '-'}</td>
                      <td className="py-3 px-2 text-right font-bold text-purple-900 border-r border-purple-100">
                        {m.monthlyNormalHours ? m.monthlyNormalHours.toLocaleString() : '-'}
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-2 text-right font-bold text-slate-800">{m.totalNormalHours.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-bold text-amber-600">
                        {m.totalOtHours > 0 ? (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold">
                            {m.totalOtHours.toLocaleString()}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-indigo-900 text-sm bg-indigo-50/40">
                        {m.grandTotalHours.toLocaleString()}
                      </td>
                    </tr>

                    {/* Level 2 Rows: Departments under Manager */}
                    {isMgrExpanded && Object.values(m.departments).map((d) => {
                      const deptKey = `${m.manager}_${d.dept}`;
                      const isDeptExpanded = !!expandedDepts[deptKey];

                      return (
                        <React.Fragment key={deptKey}>
                          <tr
                            onClick={() => toggleDept(deptKey)}
                            className={`transition-all cursor-pointer ${
                              isDeptExpanded ? 'bg-slate-100/80' : 'bg-slate-50/60 hover:bg-slate-100/50'
                            }`}
                          >
                            <td className="py-2.5 px-4 pl-9 flex items-center gap-2">
                              {isDeptExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <Building2 className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-slate-800 font-semibold text-xs">
                                {d.dept}
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({Object.keys(d.machines).length} เครื่องจักร)
                              </span>
                            </td>

                            {/* GY */}
                            <td className="py-2 px-2 text-center text-blue-600">{d.gyCount || '-'}</td>
                            <td className="py-2 px-2 text-right text-slate-600">{d.gyNormalHours ? d.gyNormalHours.toLocaleString() : '-'}</td>
                            <td className="py-2 px-2 text-right text-amber-600 font-semibold">{d.gyOtHours ? d.gyOtHours.toLocaleString() : '-'}</td>
                            <td className="py-2 px-2 text-right text-blue-800 font-semibold border-r border-blue-100">
                              {d.gyTotalHours ? d.gyTotalHours.toLocaleString() : '-'}
                            </td>

                            {/* Contractor */}
                            <td className="py-2 px-2 text-center text-teal-600">{d.contractorCount || '-'}</td>
                            <td className="py-2 px-2 text-right text-slate-600">{d.contractorNormalHours ? d.contractorNormalHours.toLocaleString() : '-'}</td>
                            <td className="py-2 px-2 text-right text-amber-600 font-semibold">{d.contractorOtHours ? d.contractorOtHours.toLocaleString() : '-'}</td>
                            <td className="py-2 px-2 text-right text-teal-800 font-semibold border-r border-teal-100">
                              {d.contractorTotalHours ? d.contractorTotalHours.toLocaleString() : '-'}
                            </td>

                            {/* Monthly */}
                            <td className="py-2 px-2 text-center text-purple-600">{d.monthlyCount || '-'}</td>
                            <td className="py-2 px-2 text-right text-purple-800 font-semibold border-r border-purple-100">
                              {d.monthlyNormalHours ? d.monthlyNormalHours.toLocaleString() : '-'}
                            </td>

                            {/* Total */}
                            <td className="py-2 px-2 text-right text-slate-700 font-medium">{d.totalNormalHours.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right text-amber-600 font-semibold">
                              {d.totalOtHours ? d.totalOtHours.toLocaleString() : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900 bg-slate-100/50">
                              {d.grandTotalHours.toLocaleString()}
                            </td>
                          </tr>

                          {/* Level 3 Rows: Machines under Department */}
                          {isDeptExpanded && Object.values(d.machines).map((mc) => {
                            const machineKey = `${m.manager}_${d.dept}_${mc.machine}`;
                            const isMachineExpanded = !!expandedMachines[machineKey];

                            return (
                              <React.Fragment key={machineKey}>
                                <tr
                                  onClick={() => toggleMachine(machineKey)}
                                  className={`bg-white hover:bg-indigo-50/30 transition-all cursor-pointer ${
                                    isMachineExpanded ? 'bg-indigo-50/20' : ''
                                  }`}
                                >
                                  <td className="py-2 px-4 pl-16 flex items-center gap-2">
                                    {isMachineExpanded ? (
                                      <ChevronDown className="w-3 h-3 text-indigo-400 shrink-0" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                                    )}
                                    <span className="text-slate-700 font-medium text-xs">
                                      ⚙️ {mc.machine}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      ({mc.workers.length} คน)
                                    </span>
                                  </td>

                                  {/* GY */}
                                  <td className="py-1.5 px-2 text-center text-slate-500">{mc.gyCount || '-'}</td>
                                  <td className="py-1.5 px-2 text-right text-slate-500">{mc.gyNormalHours ? mc.gyNormalHours.toLocaleString() : '-'}</td>
                                  <td className="py-1.5 px-2 text-right text-amber-600 font-medium">{mc.gyOtHours ? mc.gyOtHours.toLocaleString() : '-'}</td>
                                  <td className="py-1.5 px-2 text-right text-slate-700 font-medium border-r border-blue-50">
                                    {mc.gyTotalHours ? mc.gyTotalHours.toLocaleString() : '-'}
                                  </td>

                                  {/* Contractor */}
                                  <td className="py-1.5 px-2 text-center text-slate-500">{mc.contractorCount || '-'}</td>
                                  <td className="py-1.5 px-2 text-right text-slate-500">{mc.contractorNormalHours ? mc.contractorNormalHours.toLocaleString() : '-'}</td>
                                  <td className="py-1.5 px-2 text-right text-amber-600 font-medium">{mc.contractorOtHours ? mc.contractorOtHours.toLocaleString() : '-'}</td>
                                  <td className="py-1.5 px-2 text-right text-slate-700 font-medium border-r border-teal-50">
                                    {mc.contractorTotalHours ? mc.contractorTotalHours.toLocaleString() : '-'}
                                  </td>

                                  {/* Monthly */}
                                  <td className="py-1.5 px-2 text-center text-slate-500">{mc.monthlyCount || '-'}</td>
                                  <td className="py-1.5 px-2 text-right text-slate-700 font-medium border-r border-purple-50">
                                    {mc.monthlyNormalHours ? mc.monthlyNormalHours.toLocaleString() : '-'}
                                  </td>

                                  {/* Total */}
                                  <td className="py-1.5 px-2 text-right text-slate-600">{mc.totalNormalHours.toLocaleString()}</td>
                                  <td className="py-1.5 px-2 text-right text-amber-600 font-medium">
                                    {mc.totalOtHours ? mc.totalOtHours.toLocaleString() : '-'}
                                  </td>
                                  <td className="py-1.5 px-3 text-right font-semibold text-slate-800">
                                    {mc.grandTotalHours.toLocaleString()}
                                  </td>
                                </tr>

                                {/* Level 4: Worker Details on Machine */}
                                {isMachineExpanded && (
                                  <tr className="bg-slate-50/90 border-y border-slate-200/60">
                                    <td colSpan={14} className="py-3 px-6 pl-20">
                                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
                                        <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                          <span>👥 รายชื่อพนักงานประจำเครื่อง: <strong>{mc.machine}</strong></span>
                                          <span className="text-[11px] text-slate-500 font-normal">ทั้งหมด {mc.workers.length} คน</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                                          {mc.workers.map((w, wIdx) => (
                                            <div
                                              key={wIdx}
                                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                                                w.group === 'GY_HOURLY'
                                                  ? 'bg-blue-50/40 border-blue-200/60 text-blue-950'
                                                  : w.group === 'CONTRACTOR_HOURLY'
                                                  ? 'bg-teal-50/40 border-teal-200/60 text-teal-950'
                                                  : 'bg-purple-50/40 border-purple-200/60 text-purple-950'
                                              }`}
                                            >
                                              <div>
                                                <div className="font-bold flex items-center gap-1.5">
                                                  <span className="font-mono text-[11px] opacity-80">{w.empId}</span>
                                                  <span className="truncate max-w-[140px]">{w.name}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                  {w.position} • {w.shiftLabel}
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <div className="font-bold text-slate-900">
                                                  {w.totalHours} <span className="text-[10px] font-normal text-slate-500">ชม.</span>
                                                </div>
                                                {w.otHours > 0 && (
                                                  <div className="text-[10px] font-bold text-amber-600">
                                                    OT: +{w.otHours} ชม.
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Table Footer: Overall Grand Total */}
            <tfoot>
              <tr className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white font-bold border-t-2 border-slate-700">
                <td className="py-4 px-4 text-xs sm:text-sm font-black text-amber-300">
                  ⭐ รวมทั้งโรงงาน (Grand Total)
                </td>

                {/* GY Total */}
                <td className="py-4 px-2 text-center text-blue-300 font-black">{overallTotals.gyCount}</td>
                <td className="py-4 px-2 text-right text-slate-200">{overallTotals.gyNormal.toLocaleString()}</td>
                <td className="py-4 px-2 text-right text-amber-300 font-black">{overallTotals.gyOt.toLocaleString()}</td>
                <td className="py-4 px-2 text-right font-black text-blue-300 border-r border-indigo-900/60">
                  {overallTotals.gyTotal.toLocaleString()}
                </td>

                {/* Contractor Total */}
                <td className="py-4 px-2 text-center text-teal-300 font-black">{overallTotals.contCount}</td>
                <td className="py-4 px-2 text-right text-slate-200">{overallTotals.contNormal.toLocaleString()}</td>
                <td className="py-4 px-2 text-right text-amber-300 font-black">{overallTotals.contOt.toLocaleString()}</td>
                <td className="py-4 px-2 text-right font-black text-teal-300 border-r border-indigo-900/60">
                  {overallTotals.contTotal.toLocaleString()}
                </td>

                {/* Monthly Total */}
                <td className="py-4 px-2 text-center text-purple-300 font-black">{overallTotals.monthlyCount}</td>
                <td className="py-4 px-2 text-right font-black text-purple-300 border-r border-indigo-900/60">
                  {overallTotals.monthlyNormal.toLocaleString()}
                </td>

                {/* Grand Totals */}
                <td className="py-4 px-2 text-right font-black text-slate-100">{overallTotals.grandNormal.toLocaleString()}</td>
                <td className="py-4 px-2 text-right font-black text-amber-300 text-sm">
                  {overallTotals.grandOt.toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right font-black text-amber-400 text-base bg-white/10">
                  {overallTotals.grandTotal.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
