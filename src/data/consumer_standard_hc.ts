export interface ConsumerStandardHCRow {
  id: number;
  positionName: string;
  costCenter: string;
  subDepartment: 'Building' | 'Curing' | 'Final Finishing';
  shift1Target: number;
  shift2Target: number;
  shift3Target: number;
}

export const CONSUMER_STANDARD_HC: ConsumerStandardHCRow[] = [
  // 1. Building (Dept 5110 / 4140)
  {
    id: 1,
    positionName: 'Team Leader',
    costCenter: '5110',
    subDepartment: 'Building',
    shift1Target: 2,
    shift2Target: 2,
    shift3Target: 2
  },
  {
    id: 2,
    positionName: 'TBM - R1 & R2.5',
    costCenter: '5110',
    subDepartment: 'Building',
    shift1Target: 8,
    shift2Target: 8,
    shift3Target: 8
  },
  {
    id: 3,
    positionName: 'TBM - VMI248',
    costCenter: '5110',
    subDepartment: 'Building',
    shift1Target: 16,
    shift2Target: 16,
    shift3Target: 16
  },
  {
    id: 4,
    positionName: 'Calemard Slitter',
    costCenter: '5110/4140',
    subDepartment: 'Building',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  },
  {
    id: 5,
    positionName: 'Steelastic',
    costCenter: '4140',
    subDepartment: 'Building',
    shift1Target: 4,
    shift2Target: 4,
    shift3Target: 4
  },

  // 2. Curing (Dept 5120)
  {
    id: 6,
    positionName: 'Team Leader',
    costCenter: '5120',
    subDepartment: 'Curing',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  },
  {
    id: 7,
    positionName: 'Spray',
    costCenter: '5120',
    subDepartment: 'Curing',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  },
  {
    id: 8,
    positionName: 'Consumer Curing',
    costCenter: '5120',
    subDepartment: 'Curing',
    shift1Target: 4,
    shift2Target: 4,
    shift3Target: 4
  },
  {
    id: 9,
    positionName: 'Mold & Bladder',
    costCenter: '5120',
    subDepartment: 'Curing',
    shift1Target: 2,
    shift2Target: 2,
    shift3Target: 2
  },

  // 3. Final Finishing (Dept 5130)
  {
    id: 10,
    positionName: 'Smart Grinder',
    costCenter: '5130',
    subDepartment: 'Final Finishing',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  },
  {
    id: 11,
    positionName: 'Inspection',
    costCenter: '5130',
    subDepartment: 'Final Finishing',
    shift1Target: 3,
    shift2Target: 3,
    shift3Target: 3
  },
  {
    id: 12,
    positionName: 'FVM',
    costCenter: '5130',
    subDepartment: 'Final Finishing',
    shift1Target: 2,
    shift2Target: 2,
    shift3Target: 2
  },
  {
    id: 13,
    positionName: 'DBM',
    costCenter: '5130',
    subDepartment: 'Final Finishing',
    shift1Target: 2,
    shift2Target: 2,
    shift3Target: 2
  },
  {
    id: 14,
    positionName: 'Buffing & Repair',
    costCenter: '5130',
    subDepartment: 'Final Finishing',
    shift1Target: 1,
    shift2Target: 0,
    shift3Target: 0 // กะเช้า เท่านั้น 1 คน
  },
  {
    id: 15,
    positionName: 'Stocking',
    costCenter: '5130',
    subDepartment: 'Final Finishing',
    shift1Target: 1,
    shift2Target: 1,
    shift3Target: 1
  }
];
