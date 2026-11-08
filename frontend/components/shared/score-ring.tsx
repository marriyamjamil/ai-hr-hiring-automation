// A circular score meter, e.g. 87 / 100
type ScoreRingProps = {
  score: number;
  size?: number;
  stroke?: number;
  className?: string;
};

function colorFor(score: number) {
  if (score >= 75) return "#10b981"; // green: strong match
  if (score >= 50) return "#6366f1"; // indigo: possible match
  return "#f59e0b"; // amber: weak match
}

export function ScoreRing({ score, size = 72, stroke = 7, className = "" }: ScoreRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorFor(clamped)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <span className="absolute font-display text-lg font-bold" style={{ fontSize: size / 4 }}>
        {Math.round(clamped)}
      </span>
    </div>
  );
}
