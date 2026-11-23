// Animated "arc reactor" core — the signature Jarvis HUD element.
// Pure SVG, themed via currentColor (accent). Decorative only.
export function JarvisCore({ size = 120, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={`text-accent ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="55%" stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="60" cy="60" r="58" fill="url(#coreGlow)" className="animate-pulse-ring origin-center" />

      {/* outer dashed ring, slow spin */}
      <circle
        cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeOpacity="0.4"
        strokeWidth="1.5" strokeDasharray="3 7" className="animate-spin-slow origin-center"
      />
      {/* mid ring with gaps, reverse spin */}
      <circle
        cx="60" cy="60" r="40" fill="none" stroke="currentColor" strokeOpacity="0.6"
        strokeWidth="2" strokeDasharray="50 12 30 12" className="animate-spin-rev origin-center"
      />
      {/* sweep arc */}
      <circle
        cx="60" cy="60" r="30" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray="40 150" strokeLinecap="round" className="animate-sweep origin-center"
      />
      {/* inner core */}
      <circle cx="60" cy="60" r="16" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="6" fill="currentColor" className="animate-pulse-ring origin-center" />
    </svg>
  );
}
