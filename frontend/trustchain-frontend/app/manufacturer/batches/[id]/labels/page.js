"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useChainId } from "wagmi";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import { useBatch } from "@/lib/hooks";
import { loadStrips, stripPayload } from "@/lib/qr";
import { date } from "@/lib/format";
import { Button, Empty, PageHeader, Spinner } from "@/components/ui";

export default function LabelsPage() {
  const { id } = useParams();
  const chainId = useChainId();
  const { data: batch } = useBatch(id);
  const [labels, setLabels] = useState(null);

  useEffect(() => {
    const secrets = loadStrips(chainId, id);
    Promise.all(secrets.map((s) => QRCode.toDataURL(stripPayload(s), { margin: 1, width: 160 }))).then((imgs) =>
      setLabels(secrets.map((s, i) => ({ secret: s, img: imgs[i] }))),
    );
  }, [chainId, id]);

  function exportCsv() {
    const rows = ["serial,qr_payload", ...labels.map((l, i) => `${i + 1},${stripPayload(l.secret)}`)];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `batch-${id}-strip-codes.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!batch || !labels) return <Spinner />;
  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={`Strip labels: ${batch.productName}`}
          subtitle={`Batch #${id} · lot ${batch.lotNumber} · ${labels.length} of ${batch.quantity} codes stored on this device`}
          actions={
            labels.length > 0 && (
              <>
                <Button variant="secondary" onClick={exportCsv}>
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
                <Button onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </>
            )
          }
        />
      </div>
      {!labels.length ? (
        <div className="card">
          <Empty title="No strip codes on this device">
            Codes are generated in the browser that serialised the batch. Open this page there, or{" "}
            <Link className="text-brand underline" href="/manufacturer/batches">
              serialise remaining strips
            </Link>
            .
          </Empty>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 print:grid-cols-5 print:gap-2">
          {labels.map((l, i) => (
            <div key={l.secret} className="break-inside-avoid rounded-lg border border-white/10 bg-white p-2 text-center text-[10px] leading-tight text-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.img} alt={`QR for strip ${i + 1}`} className="mx-auto w-full max-w-28" />
              <div className="mt-1 font-semibold">{batch.productName}</div>
              <div>
                Lot {batch.lotNumber} · #{i + 1}
              </div>
              <div>Exp {date(batch.expiresAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
