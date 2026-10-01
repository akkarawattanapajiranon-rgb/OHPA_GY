export interface BiasAeroStandardHCRow {
  id: number;
  positionName: string;
  costCenter: string;
  subDepartment: 'Build' | 'Curing & FF';
  shift1Target: number;
  shift2Target: number;
  shift3Target: number;
}

export const BIAS_AERO_STANDARD_HC: BiasAeroStandardHCRow[] = [
  // 1. Build (Dept A5110)
  {
    id: 1,
    positionName: 'Leader',
    costCenter: 'A5110',
    subDepartment: 'Build',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  },
  {
    id: 2,
    positionName: 'TBM - U2 , U3 , U1 , Taku Bias',
    costCenter: 'A5110',
    subDepartment: 'Build',
    shift1Target: 20,
    shift2Target: 20,
    shift3Target: 20
  },
  {
    id: 3,
    positionName: 'Material Handling',
    costCenter: 'A5110',
    subDepartment: 'Build',
    shift1Target: 3,
    shift2Target: 3,
    shift3Target: 3
  },

  // 2. Curing & FF (Dept A5120 / A5130)
  {
    id: 4,
    positionName: 'Leader',
    costCenter: 'A5120',
    subDepartment: 'Curing & FF',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  },
  {
    id: 5,
    positionName: 'Spray',
    costCenter: 'A5120',
    subDepartment: 'Curing & FF',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  },
  {
    id: 6,
    positionName: 'Curing',
    costCenter: 'A5120',
    subDepartment: 'Curing & FF',
    shift1Target: 4,
    shift2Target: 4,
    shift3Target: 4
  },
  {
    id: 7,
    positionName: 'Mold & Bladder',
    costCenter: 'A5120',
    subDepartment: 'Curing & FF',
    shift1Target: 2,
    shift2Target: 2,
    shift3Target: 2
  },
  {
    id: 8,
    positionName: 'Inspection',
    costCenter: 'A5130',
    subDepartment: 'Curing & FF',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  },
  {
    id: 9,
    positionName: 'Final Finishing',
    costCenter: 'A5130',
    subDepartment: 'Curing & FF',
    shift1Target: 4,
    shift2Target: 4,
    shift3Target: 4
  },
  {
    id: 10,
    positionName: 'Buffing & Repair',
    costCenter: 'A5130',
    subDepartment: 'Curing & FF',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  }
];
