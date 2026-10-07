"use client";
import { useWorkspace } from "@/components/Workspace";
import Arriving from "@/components/work/Arriving";
import { PageHeader } from "@/components/ui";

export default function Page() {
  const { me } = useWorkspace();
  return (
    <>
      <PageHeader eyebrow="Arriving" n={2} title="Deliveries" subtitle="Check the box readings, open it, scan one strip, then confirm." />
      <Arriving me={me.address} />
    </>
  );
}
