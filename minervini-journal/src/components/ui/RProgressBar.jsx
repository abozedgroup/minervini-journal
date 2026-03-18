import { formatR } from '../../utils/calculations';

export default function RProgressBar({ currentR, entry, stop }) {
  const MIN_R = -1;
  const MAX_R = 5;
  const pct = Math.max(
    0,
    Math.min(100, ((currentR - MIN_R) / (MAX_R - MIN_R)) * 100)
  );

  const color =
    currentR >= 3
      ? '#06d6a0'
      : currentR >= 1
        ? '#f0b429'
        : currentR >= 0
          ? '#94a3b8'
          : '#ef476f';

  const milestones = [
    { r: 0, label: 'دخول', pct: ((0 - MIN_R) / (MAX_R - MIN_R)) * 100 },
    { r: 1, label: '+1R', pct: ((1 - MIN_R) / (MAX_R - MIN_R)) * 100 },
    { r: 2, label: '+2R', pct: ((2 - MIN_R) / (MAX_R - MIN_R)) * 100 },
    { r: 3, label: '+3R', pct: ((3 - MIN_R) / (MAX_R - MIN_R)) * 100 },
  ];

  return (
    <div className="w-full" dir="ltr">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>-1R</span>
        <span className="font-mono" style={{ color }}>
          {formatR(currentR)} الآن
        </span>
        <span>+5R</span>
      </div>

      <div className="relative h-3 bg-[#0e1016] rounded-full border border-[#1e2438]">
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        {milestones.map((m) => (
          <div
            key={m.r}
            className="absolute top-0 bottom-0 w-px bg-[#1e2438]"
            style={{ left: `${m.pct}%` }}
          />
        ))}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white transition-all duration-300"
          style={{ left: `calc(${pct}% - 6px)`, backgroundColor: color }}
        />
      </div>

      <div className="flex justify-between text-xs text-gray-600 mt-1">
        <span>وقف</span>
        {milestones.slice(1).map((m) => (
          <span key={m.r}>{m.label}</span>
        ))}
      </div>
    </div>
  );
}
