"use client";
import { useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import { short } from "@/lib/format";

const cx = (...c) => c.filter(Boolean).join(" ");
export { cx };

const BTN = {
  primary: "bg-brand text-ink-950 hover:bg-teal-300 font-semibold shadow-[0_0_24px_-6px_rgba(45,212,191,0.6)]",
  secondary: "border border-white/40 text-white hover:bg-white hover:text-ink-950",
  ghost: "text-slate-300 hover:bg-white/[0.06] hover:text-white",
  danger: "bg-danger/15 text-rose-200 hover:bg-danger/25 border border-danger/40",
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...props }) {
  const sz = size === "sm" ? "px-2.5 py-1.5 text-xs" : size === "lg" ? "px-5 py-3 text-base" : "px-3.5 py-2 text-sm";
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg transition duration-200 disabled:cursor-not-allowed disabled:opacity-50", BTN[variant], sz, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ title, subtitle, actions, children, className, bodyClassName, id }) {
  return (
    <section id={id} className={cx("card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const TONE = {
  ok: "bg-ok/10 text-emerald-300 ring-ok/25",
  warn: "bg-warn/10 text-amber-300 ring-warn/25",
  danger: "bg-danger/10 text-rose-300 ring-danger/30",
  info: "bg-info/10 text-blue-300 ring-info/25",
  brand: "bg-brand/10 text-teal-300 ring-brand/25",
  neutral: "bg-white/[0.05] text-slate-300 ring-white/10",
};

export function Badge({ tone = "neutral", children, className }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const Input = ({ className, ...p }) => <input className={cx("input", className)} {...p} />;
export const Textarea = ({ className, ...p }) => <textarea className={cx("input min-h-24", className)} {...p} />;
export const Select = ({ className, children, ...p }) => (
  <select className={cx("input", className)} {...p}>
    {children}
  </select>
);

export function Stat({ label, value, sub, tone }) {
  const color = tone === "danger" ? "text-rose-300" : tone === "warn" ? "text-amber-300" : tone === "ok" ? "text-emerald-300" : "text-white";
  return (
    <div className="card px-5 py-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={cx("mt-1 text-2xl font-semibold tabular-nums", color)}>{value ?? "—"}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-slate-600" />}
      <div className="text-sm font-medium text-slate-300">{title}</div>
      {children && <div className="mt-1 max-w-sm text-xs text-slate-500">{children}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function Address({ address, name, className }) {
  const [copied, setCopied] = useState(false);
  if (!address) return null;
  return (
    <span className={cx("inline-flex items-center gap-1.5", className)}>
      {name && <span className="text-slate-200">{name}</span>}
      <span className="font-mono text-xs text-slate-500" title={address}>
        {short(address)}
      </span>
      <button
        type="button"
        aria-label="Copy address"
        className="text-slate-500 hover:text-slate-200"
        onClick={(e) => {
          e.preventDefault();
          navigator.clipboard?.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, icon: Icon, eyebrow, n }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-teal-300">
            {n != null && <span>{String(n).padStart(2, "0")}</span>}
            {n != null && <span className="h-px w-8 bg-current opacity-60" />}
            <span>{eyebrow}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/25">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <h1 className="display text-3xl sm:text-4xl">{title}</h1>
        </div>
        {subtitle && <p className="mt-2 text-sm text-slate-400 sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx(
            "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition",
            value === t.id ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200",
          )}
        >
          {t.label}
          {t.count != null && t.count > 0 && <span className="rounded-full bg-brand/20 px-1.5 text-xs text-teal-200">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/70 p-3 pt-[12vh] backdrop-blur-sm sm:p-4" onMouseDown={onClose}>
      <div className={cx("card w-full bg-ink-900/90 shadow-2xl", wide ? "max-w-2xl" : "max-w-md")} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Notice({ tone = "info", title, children, icon: Icon, className }) {
  const ring = { info: "border-info/25 bg-info/[0.06]", warn: "border-warn/30 bg-warn/[0.06]", danger: "border-danger/30 bg-danger/[0.07]", ok: "border-ok/25 bg-ok/[0.06]" }[tone];
  return (
    <div className={cx("flex gap-3 rounded-xl border px-4 py-3 text-sm", ring, className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div>
        {title && <div className="font-medium text-white">{title}</div>}
        {children && <div className="text-slate-300">{children}</div>}
      </div>
    </div>
  );
}

/** Marks an organisation run by the showcase simulator (fictional company, real transactions). */
export function SimBadge({ className }) {
  return (
    <span title="Fictional organisation run by the showcase simulator. Its transactions and signed readings are real." className={cx("inline-flex items-center whitespace-nowrap rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-300 ring-1 ring-inset ring-violet-400/30", className)}>
      Simulated
    </span>
  );
}
