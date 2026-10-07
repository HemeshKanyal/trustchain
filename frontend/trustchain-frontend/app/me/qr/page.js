"use client";
import { useWorkspace } from "@/components/Workspace";
import QrImage from "@/components/QrImage";
import { Address, PageHeader } from "@/components/ui";

export default function MyQr() {
  const { me } = useWorkspace();
  return (
    <div className="mx-auto max-w-md text-center">
      <PageHeader eyebrow="My wallet QR" n={3} title="Show this to your doctor" />
      <div className="card flex flex-col items-center gap-4 p-8">
        <QrImage value={`ethereum:${me.address}`} size={240} label="Your wallet address QR" />
        <Address address={me.address} />
        <p className="text-sm text-slate-400">Doctors scan it to write your prescription; pharmacies scan it so recalls can reach you. It reveals no medical information.</p>
      </div>
    </div>
  );
}
