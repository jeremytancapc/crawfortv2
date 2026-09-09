import type { SVGProps } from "react";

/**
 * Spot illustrations for the /v2 funnel. One drawing system throughout:
 * a soft tinted disc behind, paper-white shapes with a 2.5px brand-blue
 * outline, and a single teal accent per drawing. Decorative only - every
 * consumer wraps them in `V2Illustration`, which is `aria-hidden`.
 */

const STROKE = "var(--v2-ill-stroke)";
const ACCENT = "var(--v2-ill-accent)";
const TINT = "var(--v2-ill-tint)";
const PAPER = "var(--v2-ill-paper)";

const base = {
  viewBox: "0 0 200 200",
  fill: "none",
  strokeWidth: 2.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} satisfies SVGProps<SVGSVGElement>;

function Disc({ cx = 100, cy = 104, r = 78 }: { cx?: number; cy?: number; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={TINT} />;
}

/** ID card with a shield: retrieving verified details. */
export function SingpassIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <rect x="34" y="58" width="118" height="80" rx="12" fill={PAPER} stroke={STROKE} />
      <circle cx="64" cy="90" r="12" fill={TINT} stroke={STROKE} />
      <path d="M46 122c3-10 10-15 18-15s15 5 18 15" stroke={STROKE} />
      <path d="M94 82h42M94 96h30M94 110h20" stroke={STROKE} />
      <path
        d="M150 106c14 4 22 6 30 6v22c0 15-13 26-30 32-17-6-30-17-30-32v-22c8 0 16-2 30-6z"
        fill={PAPER}
        stroke={STROKE}
      />
      <path d="M139 136l8 8 16-18" stroke={ACCENT} strokeWidth={3.5} />
    </svg>
  );
}

/** Documents rising into place: uploading payslips. */
export function UploadIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <path d="M52 74h56l18 18v60H52z" fill={TINT} stroke={STROKE} opacity={0.6} />
      <path d="M66 60h56l18 18v60H66z" fill={PAPER} stroke={STROKE} />
      <path d="M122 60v18h18" stroke={STROKE} />
      <path d="M82 104h40M82 118h28" stroke={STROKE} />
      <circle cx="140" cy="140" r="22" fill={ACCENT} />
      <path d="M140 150v-20M131 139l9-9 9 9" stroke="#fff" strokeWidth={3} />
    </svg>
  );
}

/** Portrait frame with a check badge: is this you. */
export function IdentityIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <rect x="54" y="44" width="92" height="118" rx="18" fill={PAPER} stroke={STROKE} />
      <circle cx="100" cy="90" r="20" fill={TINT} stroke={STROKE} />
      <path d="M70 142c6-18 17-26 30-26s24 8 30 26" stroke={STROKE} />
      <circle cx="140" cy="54" r="16" fill={ACCENT} />
      <path d="M133 54l5 5 9-10" stroke="#fff" strokeWidth={3} />
    </svg>
  );
}

/** Seal with a check and quiet rays: approved. */
export function ApprovedIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <path
        d="M100 44l12 9 15-3 6 14 14 6-3 15 9 12-9 12 3 15-14 6-6 14-15-3-12 9-12-9-15 3-6-14-14-6 3-15-9-12 9-12-3-15 14-6 6-14 15 3z"
        fill={PAPER}
        stroke={STROKE}
      />
      <circle cx="100" cy="104" r="30" fill={TINT} />
      <path d="M85 104l10 10 20-22" stroke={ACCENT} strokeWidth={4} />
      <path d="M40 40l-8-8M160 40l8-8M30 104h-10M180 104h-10" stroke={STROKE} opacity={0.5} />
    </svg>
  );
}

/** Three rising bars with a calendar tick: pick a plan. */
export function PlanIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <rect x="44" y="112" width="30" height="46" rx="8" fill={PAPER} stroke={STROKE} />
      <rect x="85" y="88" width="30" height="70" rx="8" fill={PAPER} stroke={STROKE} />
      <rect x="126" y="62" width="30" height="96" rx="8" fill={PAPER} stroke={STROKE} />
      <rect x="85" y="88" width="30" height="16" rx="8" fill={ACCENT} />
      <path d="M40 158h120" stroke={STROKE} />
      <path d="M46 78c14-16 30-24 52-24" stroke={STROKE} strokeDasharray="4 6" opacity={0.6} />
    </svg>
  );
}

/** Contract with a pen: terms. */
export function TermsIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <rect x="52" y="44" width="96" height="120" rx="12" fill={PAPER} stroke={STROKE} />
      <path d="M70 70h60M70 86h60M70 102h44M70 118h30" stroke={STROKE} />
      <path d="M70 142h28" stroke={ACCENT} strokeWidth={3.5} />
      <path d="M150 96l18 18-44 44-22 4 4-22z" fill={PAPER} stroke={STROKE} />
      <path d="M142 104l18 18" stroke={STROKE} />
      <path d="M106 158l-4-4" stroke={STROKE} />
    </svg>
  );
}

/** Signature curve with a nib: sign. */
export function SignIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <path d="M36 128h128" stroke={STROKE} strokeDasharray="4 6" opacity={0.6} />
      <path
        d="M44 118c10-30 22-46 30-40 8 6-6 40 2 42 8 2 18-30 28-28 8 2 0 26 8 26 8 0 14-20 22-18"
        stroke={STROKE}
        strokeWidth={3}
      />
      <path d="M134 100l24-24 10 10-24 24-14 4z" fill={PAPER} stroke={STROKE} />
      <path d="M150 84l10 10" stroke={STROKE} />
      <circle cx="140" cy="106" r="4" fill={ACCENT} />
    </svg>
  );
}

/** Month grid with one highlighted day: book a visit. */
export function CalendarIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <rect x="44" y="56" width="112" height="104" rx="14" fill={PAPER} stroke={STROKE} />
      <path d="M44 82h112" stroke={STROKE} />
      <path d="M72 44v22M128 44v22" stroke={STROKE} />
      {[0, 1, 2, 3].map((col) =>
        [0, 1, 2].map((row) => {
          const x = 62 + col * 24;
          const y = 96 + row * 22;
          const highlight = col === 2 && row === 1;
          return (
            <rect
              key={`${col}-${row}`}
              x={x}
              y={y}
              width="14"
              height="14"
              rx="4"
              fill={highlight ? ACCENT : TINT}
            />
          );
        }),
      )}
    </svg>
  );
}

/** Ticket with a perforation and check: booked. */
export function BookedIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <path
        d="M40 70a10 10 0 0 1 10-10h100a10 10 0 0 1 10 10v24a12 12 0 0 0 0 24v24a10 10 0 0 1-10 10H50a10 10 0 0 1-10-10v-24a12 12 0 0 0 0-24z"
        fill={PAPER}
        stroke={STROKE}
      />
      <path d="M116 66v80" stroke={STROKE} strokeDasharray="4 6" />
      <path d="M56 86h40M56 102h28M56 118h34" stroke={STROKE} />
      <circle cx="138" cy="106" r="12" fill={ACCENT} />
      <path d="M132 106l4 4 8-9" stroke="#fff" strokeWidth={3} />
    </svg>
  );
}

/** Clock face with a sweeping arc: under review. */
export function PendingIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <circle cx="100" cy="104" r="50" fill={PAPER} stroke={STROKE} />
      <path d="M100 68v36l24 14" stroke={STROKE} strokeWidth={3} />
      <circle cx="100" cy="104" r="4" fill={ACCENT} />
      <path d="M100 42a62 62 0 0 1 62 62" stroke={ACCENT} strokeWidth={3.5} />
      <path d="M100 166a62 62 0 0 1-62-62" stroke={STROKE} strokeDasharray="4 6" opacity={0.6} />
    </svg>
  );
}

/** Envelope with a paper plane: request received. */
export function ReceivedIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <rect x="40" y="76" width="120" height="80" rx="12" fill={PAPER} stroke={STROKE} />
      <path d="M40 88l60 40 60-40" stroke={STROKE} />
      <path d="M132 40l26 8-22 32-6-14z" fill={ACCENT} />
      <path d="M130 66l28-18" stroke={STROKE} opacity={0.6} />
    </svg>
  );
}

/** Coins and a phone: funds on the way (unused for now, kept for parity). */
export function FundsIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <Disc />
      <rect x="70" y="40" width="60" height="120" rx="14" fill={PAPER} stroke={STROKE} />
      <path d="M90 52h20" stroke={STROKE} />
      <circle cx="100" cy="100" r="22" fill={TINT} stroke={STROKE} />
      <path d="M100 88v24M94 94h9a4 4 0 0 1 0 8h-6a4 4 0 0 0 0 8h9" stroke={STROKE} />
      <circle cx="146" cy="136" r="12" fill={ACCENT} />
    </svg>
  );
}
