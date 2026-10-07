"use client";
import { useApplications } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import { Applications } from "@/components/admin";
import { PageHeader } from "@/components/ui";

export default function Page() {
  const { me } = useWorkspace();
  return (
    <>
      <PageHeader eyebrow="Applications" n={2} title="Who wants in" subtitle="Check each licence against the official registry before approving." />
      <Applications q={useApplications()} admin={me.address} />
    </>
  );
}
