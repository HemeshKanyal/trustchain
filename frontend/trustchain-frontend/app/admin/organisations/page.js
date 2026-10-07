"use client";
import { useParticipants } from "@/lib/hooks";
import { useWorkspace } from "@/components/Workspace";
import { Participants } from "@/components/admin";
import { PageHeader } from "@/components/ui";

export default function Page() {
  const { me } = useWorkspace();
  return (
    <>
      <PageHeader eyebrow="Organisations" n={3} title="Everyone on the network" subtitle="Register organisations directly, or suspend and reinstate them." />
      <Participants me={me} q={useParticipants()} />
    </>
  );
}
