export interface StandardHCRow {
  id: number;
  positionName: string;
  costCenter: string;
  shift1Target: number;
  shift2Target: number;
  shift3Target: number;
}

export const TEAM_A_STANDARD_HC: StandardHCRow[] = [
  { id: 1, positionName: '320 BANBURY # 1', costCenter: '3200', shift1Target: 6, shift2Target: 6, shift3Target: 6 },
  { id: 2, positionName: '320 BANBURY # 2', costCenter: '3200', shift1Target: 6, shift2Target: 6, shift3Target: 6 },
  { id: 3, positionName: '320 Pigment', costCenter: '3200', shift1Target: 1, shift2Target: 1, shift3Target: 1 },
  { id: 4, positionName: '330 3ROII', costCenter: '3300', shift1Target: 7, shift2Target: 0, shift3Target: 0 },
  { id: 5, positionName: 'Cement (3roll)', costCenter: '3700', shift1Target: 1, shift2Target: 0, shift3Target: 0 },
  { id: 6, positionName: '411 4Roll#1', costCenter: '4110', shift1Target: 4, shift2Target: 4, shift3Target: 4 },
  { id: 7, positionName: '411 4Roll#2', costCenter: '4110', shift1Target: 5, shift2Target: 3, shift3Target: 3 },
  { id: 8, positionName: '411 Chafer lay up', costCenter: '4110', shift1Target: 1, shift2Target: 1, shift3Target: 1 },
  { id: 9, positionName: '411 Lux/slitter', costCenter: '4110', shift1Target: 1, shift2Target: 1, shift3Target: 1 },
  { id: 10, positionName: '411 Shear Fiscer', costCenter: '4110', shift1Target: 2, shift2Target: 2, shift3Target: 2 },
  { id: 11, positionName: '412 Band54"', costCenter: '4120', shift1Target: 4, shift2Target: 4, shift3Target: 3 },
  { id: 12, positionName: '413 Band72"', costCenter: '4130', shift1Target: 8, shift2Target: 8, shift3Target: 8 },
  { id: 13, positionName: '420 Bead Flap', costCenter: '4200', shift1Target: 3, shift2Target: 3, shift3Target: 2 },
  { id: 14, positionName: '420 Bead insulation', costCenter: '4200', shift1Target: 2, shift2Target: 0, shift3Target: 0 },
  { id: 15, positionName: '420 Bead Wrap', costCenter: '4200', shift1Target: 1, shift2Target: 0, shift3Target: 0 },
  { id: 16, positionName: '420 Hex Bead', costCenter: '4200', shift1Target: 1, shift2Target: 1, shift3Target: 1 },
  { id: 17, positionName: '420 Hot apexer', costCenter: '4200', shift1Target: 2, shift2Target: 3, shift3Target: 3 },
  { id: 19, positionName: '430 6"x8" Tuber', costCenter: '4300', shift1Target: 7, shift2Target: 7, shift3Target: 7 },
  { id: 20, positionName: '430 Quad', costCenter: '4300', shift1Target: 6, shift2Target: 6, shift3Target: 6 },
  { id: 21, positionName: 'Leader', costCenter: '3200/4300/4110', shift1Target: 4, shift2Target: 4, shift3Target: 4 },
];
