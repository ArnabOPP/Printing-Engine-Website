// Original vector product mockups (no external images needed).

export function Tee({ color = '#111', lines = [], ink = '#fff', badge, accent, className, style }) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} role="img" aria-label="T-shirt">
      <defs>
        <linearGradient id={`sh-${color}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".12" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".06" />
          <stop offset="1" stopColor="#000" stopOpacity=".16" />
        </linearGradient>
      </defs>
      <path
        d="M62 18 L86 10 Q100 26 114 10 L138 18 L184 50 L163 80 L141 66 L141 186 L59 186 L59 66 L37 80 L16 50 Z"
        fill={color}
      />
      <path
        d="M62 18 L86 10 Q100 26 114 10 L138 18 L184 50 L163 80 L141 66 L141 186 L59 186 L59 66 L37 80 L16 50 Z"
        fill={`url(#sh-${color})`}
      />
      <path d="M86 10 Q100 26 114 10" fill="none" stroke="#000" strokeOpacity=".25" strokeWidth="3" />
      {badge && <circle cx="100" cy="92" r="26" fill={badge} />}
      {accent && <path d="M72 70 L100 56 L128 70 L120 76 L100 66 L80 76 Z" fill={accent} />}
      {lines.map((t, i) => (
        <text
          key={i}
          x="100"
          y={lines.length === 1 ? 108 : 96 + i * 22}
          textAnchor="middle"
          fontFamily="Barlow Condensed, sans-serif"
          fontWeight="800"
          fontSize={lines.length === 1 ? 26 : 24}
          fill={ink}
          letterSpacing="1"
        >
          {t}
        </text>
      ))}
    </svg>
  );
}

export function Mug() {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Mug">
      <ellipse cx="100" cy="176" rx="62" ry="8" fill="#000" opacity=".15" />
      <path d="M140 80 q38 0 38 32 t-38 32" fill="none" stroke="#f3f3f3" strokeWidth="14" />
      <rect x="48" y="52" width="96" height="116" rx="10" fill="#fff" stroke="#ddd" />
      <text x="96" y="104" textAnchor="middle" fontFamily="Barlow Condensed" fontWeight="800" fontSize="22" fill="#111">GOOD</text>
      <text x="96" y="126" textAnchor="middle" fontFamily="Barlow Condensed" fontWeight="800" fontSize="22" fill="#111">IDEAS.</text>
      <text x="96" y="148" textAnchor="middle" fontFamily="Caveat" fontWeight="700" fontSize="20" fill="#7ab800">better coffee</text>
    </svg>
  );
}

export function Keychain() {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Keychain">
      <circle cx="100" cy="40" r="22" fill="none" stroke="#b8bcc4" strokeWidth="6" />
      <rect x="92" y="58" width="16" height="22" rx="4" fill="#9aa0aa" />
      <rect x="52" y="78" width="96" height="100" rx="26" fill="#fff" stroke="#d6d9de" strokeWidth="4" />
      <circle cx="100" cy="124" r="32" fill="#2b6cff" />
      <circle cx="88" cy="118" r="5" fill="#fff" />
      <circle cx="112" cy="118" r="5" fill="#fff" />
      <path d="M86 134 Q100 146 114 134" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Tote() {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Tote bag">
      <path d="M70 70 Q70 24 100 24 Q130 24 130 70" fill="none" stroke="#c9b48a" strokeWidth="8" />
      <rect x="40" y="62" width="120" height="122" rx="4" fill="#efe3c6" />
      <text x="100" y="110" textAnchor="middle" fontFamily="Barlow Condensed" fontWeight="800" fontSize="26" fill="#111">CARRY</text>
      <text x="100" y="136" textAnchor="middle" fontFamily="Barlow Condensed" fontWeight="800" fontSize="26" fill="#111">GOOD</text>
      <text x="100" y="162" textAnchor="middle" fontFamily="Barlow Condensed" fontWeight="800" fontSize="26" fill="#111">IDEAS.</text>
    </svg>
  );
}

export function Sticker() {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Sticker">
      <path
        d="M30 60 Q30 36 54 36 L146 36 Q170 36 170 60 L170 140 Q170 164 146 164 L54 164 Q30 164 30 140 Z"
        fill="#fff" stroke="#e3e3e3" strokeWidth="3"
      />
      <rect x="44" y="50" width="112" height="100" rx="14" fill="#b6ff00" />
      <text x="100" y="92" textAnchor="middle" fontFamily="Barlow Condensed" fontWeight="800" fontSize="28" fill="#111">GOOD</text>
      <text x="100" y="118" textAnchor="middle" fontFamily="Barlow Condensed" fontWeight="800" fontSize="28" fill="#111">THINGS</text>
      <text x="100" y="142" textAnchor="middle" fontFamily="Barlow Condensed" fontWeight="800" fontSize="22" fill="#ff3d8b">TAKE TIME</text>
    </svg>
  );
}

export function Frame() {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Photo frame">
      <rect x="40" y="24" width="120" height="152" fill="#8a6a45" />
      <rect x="50" y="34" width="100" height="132" fill="#f6f1e8" />
      <rect x="60" y="44" width="80" height="112" fill="#d9c7b0" />
      <circle cx="100" cy="86" r="20" fill="#7a5a43" />
      <path d="M62 156 Q100 100 138 156 Z" fill="#c43e5a" />
    </svg>
  );
}
