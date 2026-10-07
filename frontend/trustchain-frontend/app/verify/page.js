"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { codeHashOf, parseStripCode } from "@/lib/qr";
import VerifyResult from "@/components/VerifyResult";
import QrScanner from "@/components/QrScanner";
import { Eyebrow, Reveal } from "@/components/fx/motion";
import { Button, Input } from "@/components/ui";

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const hash = params.get("h");
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);

  function check(text) {
    const secret = parseStripCode(text);
    if (!secret) return setError("That doesn't look like a TrustChain strip code. It starts with TC1: followed by 64 characters.");
    setError(null);
    setCode("");
    // Only the hash goes in the URL; the secret printed on the strip never leaves this page.
    router.push(`/verify?h=${codeHashOf(secret)}`);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Reveal className={hash ? "text-center" : "py-10 text-center"}>
        <Eyebrow n={1} className="justify-center">Verify</Eyebrow>
        {!hash && <h1 className="display mt-6 text-5xl sm:text-7xl">Scan the <span className="text-brand">strip.</span></h1>}
        {!hash && <p className="mx-auto mt-5 max-w-lg text-lg text-slate-400">Point your camera at the QR code on the medicine strip, or paste the code. No account needed.</p>}
      </Reveal>
      <form className={`mx-auto mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row ${hash ? "" : "mt-10"}`} onSubmit={(e) => { e.preventDefault(); check(code); }}>
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TC1:0x…" aria-label="Strip code" data-testid="verify-input" className="h-12 font-mono" />
        <Button type="submit" size="lg" className="h-12" data-testid="verify-submit"><Search className="h-4 w-4" /> Check</Button>
        <QrScanner onResult={check} label="Scan" variant={hash ? "secondary" : "primary"} />
      </form>
      {error && <p className="mt-3 text-center text-sm text-rose-300">{error}</p>}
      {hash && <div className="mt-10"><VerifyResult key={hash} codeHash={hash} /></div>}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
