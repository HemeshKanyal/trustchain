"use client";
import { useWorkspace } from "@/components/Workspace";
import { System } from "@/components/admin";
import { PageHeader } from "@/components/ui";

export default function Page() {
  const { me } = useWorkspace();
  return (
    <>
      <PageHeader eyebrow="System" n={7} title="Network controls" />
      <System me={me} />
    </>
  );
}
