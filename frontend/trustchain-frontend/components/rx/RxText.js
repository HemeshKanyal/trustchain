"use client";
import { useAuthedApi } from "@/lib/hooks";

/** Decrypted prescription details (doctor, patient or pharmacy session). */
export default function RxText({ id, viewer, className = "" }) {
  const q = useAuthedApi(`/api/prescriptions/${id}/details`, viewer);
  if (q.isLoading) return <span className={`text-slate-500 ${className}`}>…</span>;
  return <span className={className}>{q.data?.text ?? <span className="text-slate-500">No details stored</span>}</span>;
}
