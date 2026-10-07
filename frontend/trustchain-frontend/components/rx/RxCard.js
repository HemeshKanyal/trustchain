"use client";
import { Printer } from "lucide-react";
import { rxPayload } from "@/lib/qr";
import { date, short } from "@/lib/format";
import QrImage from "../QrImage";
import { Button } from "../ui";

/** Printable prescription with its QR (TCRX:<id>) for the pharmacy to scan. */
export default function RxCard({ id, doctorName, patient, text, allowance, validUntil, print = true }) {
  return (
    <div className="card overflow-hidden" data-testid="rx-printable">
      <div className="flex flex-col gap-5 p-6 sm:flex-row">
        <QrImage value={rxPayload(id)} size={140} label={`Prescription ${id} QR`} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-teal-300">Prescription</div>
          <div className="display mt-1 text-4xl" data-testid="rx-issued-id">Rx #{id}</div>
          <div className="mt-3 space-y-1 text-sm text-slate-300">
            {text && <p className="whitespace-pre-wrap text-slate-100">{text}</p>}
            <div className="text-xs text-slate-400">{doctorName} · patient {short(patient)}</div>
            <div className="text-xs text-slate-400">{allowance} strips · valid until {date(validUntil)}</div>
          </div>
        </div>
      </div>
      {print && (
        <div className="no-print border-t border-white/[0.06] px-6 py-3">
          <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      )}
    </div>
  );
}
