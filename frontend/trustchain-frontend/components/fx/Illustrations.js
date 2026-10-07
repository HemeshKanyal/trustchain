"use client";
import { CheckCircle2, ScanLine } from "lucide-react";
import QrImage from "../QrImage";

const SAMPLE = "TC1:0x7a3f19c2e4b8d05a6f1e2c3b4a5968778695a4b3c2d1e0f9e8d7c6b5a4938271";

/** Blister strip with its printed QR (chapter "Made"). */
export function StripArt() {
  return (
    <div className="relative w-full max-w-sm rotate-[-6deg]">
      <div className="absolute -inset-6 rounded-[2rem] bg-brand/10 blur-2xl" />
      <div className="card relative grid grid-cols-[1fr_auto] gap-5 p-6">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="h-10 rounded-full bg-gradient-to-br from-slate-200/80 to-slate-400/40 shadow-inner ring-1 ring-white/20" />
          ))}
        </div>
        <div className="flex flex-col items-center justify-between">
          <QrImage value={SAMPLE} size={96} label="Sample strip QR" />
          <div className="mt-2 text-center text-[10px] leading-tight text-slate-400">
            Lot TC-IN-2026
            <br />
            #0042
          </div>
        </div>
      </div>
    </div>
  );
}

/** Counter receipt (chapter "Sold"). */
export function ReceiptArt() {
  return (
    <div className="card w-full max-w-sm p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <ScanLine className="h-4 w-4 text-brand" /> Counter · City Care Pharmacy
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {["Amoxicillin 500mg · strip 1", "Amoxicillin 500mg · strip 2", "Prescription #12 · Dr. Rao"].map((t) => (
          <li key={t} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-slate-300">
            {t}
            <CheckCircle2 className="h-4 w-4 text-brand" />
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-lg bg-brand py-2 text-center text-sm font-semibold text-ink-950">Dispense 2 strips</div>
    </div>
  );
}

/** Verdict card (chapter "Verified"). */
export function VerdictArt() {
  return (
    <div className="relative w-full max-w-sm">
      <div className="absolute -inset-8 rounded-[2rem] bg-ok/10 blur-3xl" />
      <div className="card relative border-ok/40 p-8 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-300" />
        <div className="display mt-4 text-5xl text-emerald-300">GENUINE</div>
        <div className="mt-3 text-sm text-slate-300">Insulin Glargine · Acme Pharma Ltd</div>
        <div className="mt-1 text-xs text-slate-500">Made → Moved → Sold → You</div>
      </div>
    </div>
  );
}
