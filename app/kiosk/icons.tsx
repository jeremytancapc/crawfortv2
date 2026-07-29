import type { ReactNode } from "react";

export function IconMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 183 179"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        className="blob"
        d="M125.444 20.3018C132.308 12.5632 144.145 11.8536 151.884 18.7168C165.739 31.0045 175.53 47.2147 179.957 65.1963C184.384 83.178 183.239 102.081 176.673 119.397C170.107 136.712 158.43 151.622 143.193 162.148C127.956 172.672 109.879 178.315 91.3604 178.327C72.8417 178.339 54.7572 172.719 39.5068 162.214C24.2564 151.708 12.5608 136.813 5.97267 119.506C-0.615425 102.199 -1.78434 83.297 2.62013 65.3096C7.02462 47.3223 16.7946 31.0993 30.6338 18.794C38.3636 11.9211 50.2012 12.616 57.0742 20.3457C63.9472 28.0755 63.2531 39.9131 55.5234 46.7862C47.3619 54.0432 41.5995 63.6108 39.002 74.2188C36.4046 84.8266 37.0943 95.974 40.9795 106.181C44.8648 116.387 51.7621 125.172 60.7559 131.367C69.7497 137.563 80.4156 140.877 91.3369 140.87C102.258 140.863 112.919 137.535 121.905 131.328C130.891 125.121 137.777 116.328 141.649 106.116C145.522 95.9044 146.197 84.756 143.586 74.1514C140.975 63.5468 135.2 53.9868 127.029 46.7403C119.291 39.8771 118.581 28.0403 125.444 20.3018Z"
        fill="#0033AA"
      />
      <circle className="dot" cx="90.9999" cy="21.1545" r="21.0698" fill="#06DEC0" />
    </svg>
  );
}

export function SilhouetteIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="50" cy="36" r="20" fill="#fff" />
      <path d="M10 96c0-24 18-40 40-40s40 16 40 40" fill="#fff" />
    </svg>
  );
}

export function TickIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="#00281F"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Decorative Singpass-style QR (not a scannable payload). */
export function QrPlaceholder() {
  const N = 21;
  function finderModule(lr: number, lc: number) {
    if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
    if (lr === 1 || lr === 5 || lc === 1 || lc === 5) return false;
    return true;
  }
  function pseudoRand(r: number, c: number) {
    const x = Math.sin(r * 928.233 + c * 127.13 + 91.71) * 43758.5453;
    return x - Math.floor(x);
  }
  const cells: ReactNode[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      let on = false;
      if (r < 7 && c < 7) on = finderModule(r, c);
      else if (r < 7 && c >= N - 7) on = finderModule(r, c - (N - 7));
      else if (r >= N - 7 && c < 7) on = finderModule(r - (N - 7), c);
      else if (r === 6 && c >= 8 && c <= 12) on = c % 2 === 0;
      else if (c === 6 && r >= 8 && r <= 12) on = r % 2 === 0;
      else if (r >= 8 && r <= 12 && c >= 8 && c <= 12) on = false;
      else on = pseudoRand(r, c) > 0.52;
      if (on) {
        cells.push(
          <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#001F66" />,
        );
      }
    }
  }
  return (
    <svg viewBox="0 0 21 21" shapeRendering="crispEdges" aria-hidden>
      <rect x="0" y="0" width="21" height="21" fill="#ffffff" />
      {cells}
      <rect
        x="8"
        y="8"
        width="5"
        height="5"
        rx="1"
        fill="#ffffff"
        stroke="#001F66"
        strokeWidth="0.3"
      />
      <text
        x="10.5"
        y="11.15"
        fontFamily="var(--font-quicksand), sans-serif"
        fontSize="2.7"
        fontWeight="800"
        fill="#0033AA"
        textAnchor="middle"
      >
        SP
      </text>
    </svg>
  );
}
