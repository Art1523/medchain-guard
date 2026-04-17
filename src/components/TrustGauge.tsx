import { motion } from "framer-motion";

export default function TrustGauge({ score }: { score: number }) {
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? "hsl(var(--success))" : score >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const label = score >= 80 ? "Genuine" : score >= 50 ? "Suspicious" : "Fake";

  return (
    <div className="relative w-[200px] h-[200px] mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
        <circle cx="100" cy="100" r={radius} stroke="hsl(var(--muted))" strokeWidth="14" fill="none" />
        <motion.circle
          cx="100" cy="100" r={radius} stroke={color} strokeWidth="14" fill="none" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-5xl font-semibold tabular-nums" style={{ color }}>{score}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
        </div>
      </div>
    </div>
  );
}
