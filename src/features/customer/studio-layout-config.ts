// Studio layout config — all positional constants in one place for easy tweaking.
// Coordinates are percentages relative to the bench wrapper's width/height.

export const STUDIO_LAYOUT = {
  rightHand: {
    left: '50%',
    top: '30%',
    width: '30%',
    transform: 'translate(-50%, -50%)',
  },
} as const;

// ── Drawer hotspot positions on 双层工作台.png ──────────────────────────────────
// x/y = % of bench wrapper (studio-bench-wrap), centered on each drawer handle.
// Adjust these to align with the actual drawer knob positions in the image.
export type DrawerZoneId = 'color' | 'shape' | 'art' | 'deco';

export type DrawerZone = {
  id: DrawerZoneId;
  label: string;
  img: string;
  // centre of the clickable hotspot , as % of studio-bench-wrap
  cx: number; // % from left
  cy: number; // % from top
  // tap/click target size
  w: number;  // % of bench width
  h: number;  // % of bench height
};

export const DRAWER_ZONES: DrawerZone[] = [
  // top-left drawer
  { id: 'color', label: '底色', img: '/studio_assets/底色.png',  cx: 25, cy: 60, w: 40, h: 20 },
  // top-right drawer
  { id: 'shape', label: '甲型', img: '/studio_assets/甲型.png',  cx: 75, cy: 60, w: 40, h: 20 },
  // bottom-left drawer
  { id: 'art',   label: '艺术', img: '/studio_assets/艺术.png',  cx: 25, cy: 85, w: 45, h: 25 },
  // bottom-right drawer
  { id: 'deco',  label: '装饰', img: '/studio_assets/装饰.png',  cx: 75, cy: 85, w: 50, h: 25 },
];

// ── Nail slot positions ────────────────────────────────────────────────────────
// x/y are % of studio-wb-desk-wrap's rendered width/height.
// Derived from 双手.png (1447×910) overlaid at: width=90%, left=5%, bottom=10%
// on top of 纯桌面.png (1447×1027).
// To adjust: change x/y here — values are desk-wrap percentages.

export type NailSlot = {
  id: string;
  label: string;
  hand: 'left' | 'right';
  finger: 0 | 1 | 2 | 3 | 4;   // 0=thumb … 4=pinky
  x: number;   // % of desk-wrap width  (left edge = 0, right = 100)
  y: number;   // % of desk-wrap height (top = 0, bottom = 100)
  w: number;   // px width  of oval drop-zone
  h: number;   // px height of oval drop-zone
  rotate: number; // degrees, matching nail angle in image
};

export const NAIL_SLOTS: NailSlot[] = [
  // ── Left hand (palm facing up, fingers pointing right/up) ──────────────────
  { id: 'L4', label: '左小指',   hand: 'left',  finger: 4, x: 7.5, y: 33.5, w: 15, h: 18, rotate:  -20 },
  { id: 'L3', label: '左无名指', hand: 'left',  finger: 3, x: 17.5, y: 20, w: 15, h: 20, rotate:   -5 },
  { id: 'L2', label: '左中指',   hand: 'left',  finger: 2, x: 26.5, y: 15.5, w: 15.5, h: 22.5, rotate:  0 },
  { id: 'L1', label: '左食指',   hand: 'left',  finger: 1, x: 36.5, y: 19.5, w: 16, h: 21, rotate: 4 },
  { id: 'L0', label: '左拇指',   hand: 'left',  finger: 0, x: 45.2, y: 44.5, w: 17.5, h: 22, rotate: 23 },
  // ── Right hand (palm facing up, fingers pointing left/up) ──────────────────
  { id: 'R0', label: '右拇指',   hand: 'right', finger: 0, x: 54.8, y: 44.5, w: 17.5, h: 22,   rotate: -23 },
  { id: 'R1', label: '右食指',   hand: 'right', finger: 1, x: 63.5, y: 19.5, w: 16,   h: 21,   rotate:  -4 },
  { id: 'R2', label: '右中指',   hand: 'right', finger: 2, x: 73.5, y: 15.5, w: 15.5, h: 22.5, rotate:   0 },
  { id: 'R3', label: '右无名指', hand: 'right', finger: 3, x: 82.5, y: 20,   w: 15,   h: 20,   rotate:   5 },
  { id: 'R4', label: '右小指',   hand: 'right', finger: 4, x: 92.5, y: 33.5, w: 15,   h: 18,   rotate:  20 },
];
