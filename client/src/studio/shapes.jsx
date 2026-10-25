// Simple vector shapes the user can add. All are drawn in a 100 x 100 box and filled with one colour.
export const shapeList = [
  { kind: 'rect', label: 'Square', node: <rect x="0" y="0" width="100" height="100" rx="4" /> },
  { kind: 'circle', label: 'Circle', node: <circle cx="50" cy="50" r="50" /> },
  { kind: 'triangle', label: 'Triangle', node: <polygon points="50,3 97,95 3,95" /> },
  { kind: 'star', label: 'Star', node: <polygon points="50,2 61,36 97,36 68,57 79,92 50,71 21,92 32,57 3,36 39,36" /> },
  { kind: 'heart', label: 'Heart', node: <path d="M50 90 C10 60 2 38 15 22 C27 8 45 14 50 28 C55 14 73 8 85 22 C98 38 90 60 50 90 Z" /> },
  { kind: 'bolt', label: 'Bolt', node: <polygon points="58,2 18,56 46,56 38,98 82,40 54,40" /> },
];

export function ShapeSvg({ kind, fill }) {
  const s = shapeList.find((x) => x.kind === kind) || shapeList[0];
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" fill={fill} aria-hidden="true">
      {s.node}
    </svg>
  );
}
