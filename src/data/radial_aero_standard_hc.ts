export interface RadialAeroStandardHCRow {
  id: number;
  positionName: string;
  costCenter: string;
  subDepartment: 'Build' | 'Cure & FF';
  shift1Target: number;
  shift2Target: number;
  shift3Target: number;
}

export const RADIAL_AERO_STANDARD_HC: RadialAeroStandardHCRow[] = [
  // 1. Build (Dept S5110)
  {
    id: 1,
    positionName: 'Bart',
    costCenter: 'S5110',
    subDepartment: 'Build',
    shift1Target: 16,
    shift2Target: 16,
    shift3Target: 16
  },
  {
    id: 2,
    positionName: 'Tart',
    costCenter: 'S5110',
    subDepartment: 'Build',
    shift1Target: 2,
    shift2Target: 2,
    shift3Target: 2
  },
  {
    id: 3,
    positionName: 'Steel',
    costCenter: 'S5110',
    subDepartment: 'Build',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  },

  // 2. Cure & FF (Dept S5120 / S5130)
  {
    id: 4,
    positionName: 'Cure',
    costCenter: 'S5120',
    subDepartment: 'Cure & FF',
    shift1Target: 4,
    shift2Target: 4,
    shift3Target: 4
  },
  {
    id: 5,
    positionName: 'F/F',
    costCenter: 'S5130',
    subDepartment: 'Cure & FF',
    shift1Target: 2,
    shift2Target: 2,
    shift3Target: 2
  }
];
