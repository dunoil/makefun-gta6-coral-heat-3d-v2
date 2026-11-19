// CORAL HEAT 3D — every tuning number in one place.
// The island is a 7x7 road grid; blocks are 40 wide, roads 12 wide, spacing 52.
export const STEP = 1 / 60;
export const BLOCK = 40;
export const ROAD = 12;
export const GRID = 52; // block + road
export const HALF = 3; // grid runs -3..3
export const ISLAND_R = 210; // island half-size; water beyond

export const DAY_LENGTH = 300; // seconds for a full day cycle (visual only)

export const PLAYER = {
  walkSpeed: 9,
  runSpeed: 14,
  radius: 0.9,
  health: 100,
  armour: 0,
  turn: 9,
};

export const CAR = {
  accel: 26,
  brake: 42,
  maxSpeed: 34,
  reverse: 12,
  turn: 2.4,
  grip: 6,
  radius: 1.6,
  length: 4.6,
  width: 2.1,
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 22, spread: 0.03, mag: 12, reload: 0.9, price: 0, ammoPrice: 12, rate: 0.22, range: 60 },
  smg: { name: 'SMG', damage: 11, spread: 0.09, mag: 32, reload: 1.4, price: 450, ammoPrice: 30, rate: 0.08, range: 50 },
  shotgun: { name: 'Shotgun', damage: 16, spread: 0.16, mag: 6, reload: 1.8, price: 700, ammoPrice: 40, rate: 0.8, range: 28, pellets: 6 },
};

export const COP = {
  carSpeed: 30,
  footSpeed: 8.5,
  shootRange: 34,
  damage: 5,
  accuracy: 0.32,
  bustRange: 7,
  bustRate: 0.6,
};

export const ECONOMY = {
  startCash: 120,
  wastedFine: 120,
  bustedFine: 200,
  foodPrice: 8,
  armourPrice: 120,
  repairPrice: 60,
  resprayPrice: 150,
  enginePrice: 600,
  platingPrice: 400,
  nosPrice: 350,
};

export const SAVE_KEY = 'coral-heat-3d.save.v3';
export const BEST_KEY = 'coral-heat-3d.best.v3';

export const PALETTE = {
  skyDay: [0.45, 0.72, 0.95],
  skyDusk: [0.98, 0.55, 0.35],
  skyNight: [0.04, 0.06, 0.14],
  fogDay: [0.75, 0.85, 0.95],
  fogNight: [0.05, 0.07, 0.15],
  water: [0.05, 0.35, 0.55],
  sand: [0.88, 0.78, 0.55],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
