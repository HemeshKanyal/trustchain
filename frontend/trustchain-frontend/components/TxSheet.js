"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { explorerTx } from "@/lib/config";
import { cx } from "./ui";

const Ctx = createContext(null);
export const useTxSheet = () => useContext(Ctx);

const STEPS = [
  { id: "check", label: "Checking with the contract" },
  { id: "sign", label: "Confirm in your wallet" },
  { id: "seal", label: "Sealing on-chain" },
];

export function TxProvider({ children }) {
  const [tx, setTx] = useState(null); // {label, step, error, hash, success}
  const timer = useRef(null);
  const update = useCallback((patch) => setTx((t) => ({ ...(t ?? {}), ...patch })), []);
  const close = useCallback(() => setTx(null), []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (tx?.step === "done") timer.current = setTimeout(close, 2600);
    return () => clearTimeout(timer.current);
  }, [tx?.step, close]);

  return (
    <Ctx.Provider value={{ update, close }}>
      {children}
      {tx && <Sheet tx={tx} onClose={close} />}
    </Ctx.Provider>
  );
}

function Sheet({ tx, onClose }) {
  const idx = STEPS.findIndex((s) => s.id === tx.step);
  const done = tx.step === "done";
  const failed = tx.step === "error";
  const url = tx.hash ? explorerTx(tx.hash) : null;
  return (
    <div className="no-print fixed inset-x-3 bottom-3 z-[120] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96" role="status" aria-live="polite">
      <div
        data-testid="tx-sheet"
        data-state={tx.step}
        className={cx(
          "card overflow-hidden bg-ink-900/95 p-5",
          done && "border-brand/40 shadow-[0_0_40px_-8px_rgba(45,212,191,0.5)]",
          failed && "border-danger/40",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Blockchain action</div>
            <div className="mt-1 font-semibold text-white">{tx.label}</div>
          </div>
          {(done || failed) && (
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {done ? (
          <div className="mt-4 flex items-center gap-4">
            <svg className="hex-seal shrink-0" width="52" height="46" viewBox="0 0 26 23" fill="none">
              <path d="M6.5 1h13L26 11.5 19.5 22h-13L0 11.5z" stroke="#2dd4bf" strokeWidth="1.5" />
              <path className="tick" d="M8 11.8l3.4 3.3L18 8.3" stroke="#2dd4bf" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="min-w-0">
              <div className="text-sm font-medium text-teal-200">{tx.success ?? "Sealed on-chain"}</div>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                  View transaction <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                tx.hash && <div className="mt-0.5 font-mono text-xs text-slate-500">{tx.hash.slice(0, 18)}…</div>
              )}
            </div>
          </div>
        ) : failed ? (
          <p className="mt-3 text-sm text-rose-200" data-testid="tx-error">{tx.error}</p>
        ) : (
          <ol className="mt-4 space-y-2.5">
            {STEPS.map((s, i) => (
              <li key={s.id} className={cx("flex items-center gap-3 text-sm", i < idx ? "text-teal-300" : i === idx ? "text-white" : "text-slate-600")}>
                <span className="grid h-5 w-5 place-items-center">
                  {i < idx ? <Check className="h-4 w-4" /> : i === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                {s.label}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
