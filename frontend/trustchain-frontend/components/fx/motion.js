"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/** Story-site chapter label: "02 —— SHIP" */
export function Eyebrow({ n, children, tone = "brand", className = "" }) {
  const color = tone === "danger" ? "text-rose-400" : tone === "warn" ? "text-amber-300" : "text-teal-300";
  return (
    <div className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] ${color} ${className}`}>
      {n != null && <span>{String(n).padStart(2, "0")}</span>}
      {n != null && <span className="h-px w-8 bg-current opacity-60" />}
      <span>{children}</span>
    </div>
  );
}

/** Fade + rise when scrolled into view. */
export function Reveal({ children, delay = 0, className, as = "div" }) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </M>
  );
}

/** Number that counts up once visible. */
export function CountUp({ value, duration = 900, format = (n) => n.toLocaleString() }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const target = Number(value ?? 0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setShown(target);
      return;
    }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration, reduce]);
  return <span ref={ref} className="tabular-nums">{value == null ? "—" : format(shown)}</span>;
}
