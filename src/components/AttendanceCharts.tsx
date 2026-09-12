import React from 'react';
import { ShiftSummary, DepartmentSummary } from '../types/attendance';
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
import { BarChart3, PieChart as PieIcon } from 'lucide-react';

interface AttendanceChartsProps {
  shiftSummaries: ShiftSummary[];
  departmentSummaries: DepartmentSummary[];
}

const SHIFT_COLORS = ['#f59e0b', '#f97316', '#6366f1'];

export const AttendanceCharts: React.FC<AttendanceChartsProps> = ({
  shiftSummaries,
  departmentSummaries
}) => {
  // Data for Shift Bar Chart
  const shiftChartData = shiftSummaries.map(s => ({
    name: s.shiftName,
    'พนักงานทั้งหมด (คน)': s.totalWorkers,
    'คนทำ OT (คน)': s.totalOtWorkers,
    'ชั่วโมง OT รวม (ชม.)': s.totalOtHours,
    'มาสาย (คน)': s.totalLateWorkers
  }));

  // Data for Shift Pie Chart
  const pieData = shiftSummaries.map(s => ({
    name: s.shiftName,
    value: s.totalWorkers
  }));

  // Data for Top 10 Departments by OT Hours
  const topDeptOtData = [...departmentSummaries]
    .sort((a, b) => b.totalOtHours - a.totalOtHours)
    .slice(0, 10)
    .map(d => ({
      name: d.dept === 'ไม่ระบุแผนก' ? 'ไม่ระบุ' : `แผนก ${d.dept}`,
      'ชั่วโมง OT': d.totalOtHours,
      'จำนวนคน': d.totalWorkers
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Shift Bar Chart */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              แผนภูมิเปรียบเทียบพนักงานและ OT แยกตามกะ
            </h3>
            <p className="text-xs text-slate-500">
              แสดงสัดส่วนจำนวนพนักงาน, คนทำ OT และชั่วโมง OT รวมแต่ละกะ
            </p>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shiftChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="พนักงานทั้งหมด (คน)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="คนทำ OT (คน)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              <Bar dataKey="ชั่วโมง OT รวม (ชม.)" fill="#f97316" radius={[6, 6, 0, 0]} />
              <Bar dataKey="มาสาย (คน)" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Shift Pie Distribution */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <PieIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              สัดส่วนพนักงานตามกะ
            </h3>
            <p className="text-xs text-slate-500">เปอร์เซ็นต์การกระจายตัวของกำลังคน</p>
          </div>
        </div>

        <div className="h-64 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={SHIFT_COLORS[index % SHIFT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
          {shiftSummaries.map((s, idx) => (
            <div key={s.shift} className="space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-600">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: SHIFT_COLORS[idx] }}
                ></span>
                {s.shiftName}
              </div>
              <div className="text-sm font-bold text-slate-900">{s.totalWorkers} คน</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Top 10 Departments by OT */}
      <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              10 อันดับแผนกที่มีชั่วโมง OT สูงสุด (Top 10 Departments by OT Hours)
            </h3>
            <p className="text-xs text-slate-500">
              วิเคราะห์ภาระงานและ OT สะสมสูงสุดแยกตามแผนก
            </p>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topDeptOtData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#1e293b',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="ชั่วโมง OT" fill="#ea580c" radius={[6, 6, 0, 0]} />
              <Bar dataKey="จำนวนคน" fill="#0284c7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
