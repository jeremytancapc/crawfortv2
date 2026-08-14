interface ProgressRingProps {
  cleared: number;
  total: number;
  size?: number;
}

export function ProgressRing({ cleared, total, size = 40 }: ProgressRingProps) {
  const pct = total === 0 ? 1 : Math.min(1, cleared / total);
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--border-subtle)" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--brand-teal-hex)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-[var(--text-primary)]">
        {cleared}/{total}
      </span>
    </div>
  );
}
