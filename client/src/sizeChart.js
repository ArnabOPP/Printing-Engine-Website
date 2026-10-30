// Size chart: garment measurements, in inches, taken flat (the letters match the guide picture, /size-guide.png).
//
// THESE NUMBERS ARE PLACEHOLDERS (typical sizes). Replace them with your real measurements.

export const chartColumns = [
  { key: 'A', label: 'Chest' },
  { key: 'B', label: 'Shoulders' },
  { key: 'C', label: 'Sleeve length' },
  { key: 'D', label: 'Front length' },
  { key: 'E', label: 'Back length' },
];

// size -> [A chest, B shoulders, C sleeve length, D front length, E back length]
const men = {
  S: [20, 17.5, 8, 27, 27.5],
  M: [21, 18, 8.5, 28, 28.5],
  L: [22, 18.5, 9, 29, 29.5],
  XL: [23, 19, 9.5, 30, 30.5],
  XXL: [24, 19.5, 10, 31, 31.5],
  XXXL: [25, 20, 10.5, 32, 32.5],
};

export const sizeCharts = {
  men,
  women: {
    XS: [17.5, 15, 7, 24.5, 25],
    S: [18.5, 15.5, 7.5, 25.5, 26],
    M: [19.5, 16, 8, 26.5, 27],
    L: [20.5, 16.5, 8.5, 27.5, 28],
    XL: [21.5, 17, 9, 28.5, 29],
    XXL: [22.5, 17.5, 9.5, 29.5, 30],
  },
  unisex: { XS: [19, 16.5, 7.5, 26, 26.5], ...men },
  kids: {
    '2-3 yrs': [14, 12, 5, 16.5, 17],
    '4-5 yrs': [15, 12.8, 5.5, 18, 18.5],
    '6-7 yrs': [16, 13.6, 6, 19.5, 20],
    '8-9 yrs': [17, 14.4, 6.5, 21, 21.5],
    '10-11 yrs': [18, 15.2, 7, 22.5, 23],
    '12-13 yrs': [19, 16, 7.5, 24, 24.5],
  },
};
