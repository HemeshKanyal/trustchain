"use client";
/**
 * CSS-3D smart box from the story site. state: sealed | opened | hot | checking | idle.
 * Purely visual; the page passes the real state from the chain / telemetry.
 */
const LOOK = {
  sealed: { edge: "#2dd4bf", leds: ["#2dd4bf", "#60a5fa", "#2dd4bf"], label: "Sealed · tamper-evident" },
  opened: { edge: "#f43f5e", leds: ["#f43f5e", "#f43f5e", "#fbbf24"], label: "Lid opened" },
  hot: { edge: "#fbbf24", leds: ["#fbbf24", "#f43f5e", "#fbbf24"], label: "Out of range" },
  checking: { edge: "#60a5fa", leds: ["#60a5fa", "#2dd4bf", "#60a5fa"], label: "Checking the chain…" },
  idle: { edge: "#64748b", leds: ["#334155", "#334155", "#334155"], label: "No box" },
};

export default function SmartBox({ state = "sealed", size = 240, label, className = "" }) {
  const look = LOOK[state] ?? LOOK.sealed;
  const w = size, d = size * 0.62, h = size * 0.34;
  const face = "absolute left-1/2 top-1/2 border border-white/10";
  return (
    <div className={`relative grid place-items-center ${className}`} style={{ height: size * 1.05 }} data-testid="smart-box" data-state={state}>
      <div className="pointer-events-none absolute inset-0 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, ${look.edge}33, transparent 65%)` }} />
      <div style={{ perspective: 900 }}>
        <div
          className={state === "checking" ? "smartbox-spin" : "smartbox-float"}
          style={{ width: w, height: h, position: "relative", transformStyle: "preserve-3d", transform: "rotateX(-24deg) rotateY(-32deg)" }}
        >
          {/* top (lid) */}
          <div className={face} style={{ width: w, height: d, marginLeft: -w / 2, marginTop: -d / 2, transform: `rotateX(90deg) translateZ(${h / 2}px)`, background: "linear-gradient(135deg,#111827,#05070f)", boxShadow: `inset 0 0 0 2px ${look.edge}55` }}>
            <div className="absolute inset-0 flex items-center justify-around px-[14%]">
              {look.leds.map((c, i) => (
                <span key={i} className="smartbox-led h-3 w-3 rounded-full" style={{ background: c, boxShadow: `0 0 18px 6px ${c}aa`, animationDelay: `${i * 0.4}s` }} />
              ))}
            </div>
            <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" width={size * 0.16} height={size * 0.14} viewBox="0 0 24 21" fill="none">
              <path d="M6 1h12l6 9.5L18 20H6L0 10.5z" stroke={look.edge} strokeWidth="1.4" />
            </svg>
          </div>
          {/* front */}
          <div className={face} style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform: `translateZ(${d / 2}px)`, background: "linear-gradient(180deg,#0b1220,#020409)" }}>
            <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: look.edge, boxShadow: `0 0 16px 2px ${look.edge}` }} />
          </div>
          {/* back */}
          <div className={face} style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform: `rotateY(180deg) translateZ(${d / 2}px)`, background: "#030509" }} />
          {/* right */}
          <div className={face} style={{ width: d, height: h, marginLeft: -d / 2, marginTop: -h / 2, transform: `rotateY(90deg) translateZ(${w / 2}px)`, background: "linear-gradient(180deg,#0a0f1c,#020409)" }}>
            <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: look.edge, boxShadow: `0 0 16px 2px ${look.edge}` }} />
          </div>
          {/* left */}
          <div className={face} style={{ width: d, height: h, marginLeft: -d / 2, marginTop: -h / 2, transform: `rotateY(-90deg) translateZ(${w / 2}px)`, background: "#04060c" }} />
          {/* bottom */}
          <div className={face} style={{ width: w, height: d, marginLeft: -w / 2, marginTop: -d / 2, transform: `rotateX(-90deg) translateZ(${h / 2}px)`, background: "#020306", boxShadow: `0 0 60px 10px ${look.edge}22` }} />
        </div>
      </div>
      <span
        className="absolute left-1/2 top-[6%] -translate-x-1/2 whitespace-nowrap rounded-full border bg-ink-950/80 px-3 py-1 text-xs backdrop-blur"
        style={{ borderColor: `${look.edge}66`, color: look.edge }}
      >
        {label ?? look.label}
      </span>
    </div>
  );
}
