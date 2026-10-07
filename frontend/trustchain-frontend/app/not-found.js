import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-400">404 · Not on the chain</div>
      <h1 className="display mt-6 text-5xl sm:text-7xl">This page doesn&apos;t exist.</h1>
      <p className="mt-5 text-slate-400">The link may be wrong, or the batch was never minted.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink-950">Home</Link>
        <Link href="/verify" className="rounded-lg border border-white/40 px-4 py-2 text-sm text-white">Verify a strip</Link>
      </div>
    </div>
  );
}
