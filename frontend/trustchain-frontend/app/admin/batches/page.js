"use client";
import { useAllBatches } from "@/lib/hooks";
import { Batches } from "@/components/admin";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Batches" n={4} title="Every batch" subtitle="Held batches are pinned to the top. Release after lab review, or recall." />
      <Batches q={useAllBatches()} />
    </>
  );
}
