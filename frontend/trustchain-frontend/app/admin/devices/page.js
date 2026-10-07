"use client";
import { useDevices } from "@/lib/hooks";
import { Devices } from "@/components/admin";
import { PageHeader } from "@/components/ui";

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Smart boxes" n={6} title="IoT trackers" subtitle="Each ESP32 box signs its own readings. Register its address once; disable it if it is lost." />
      <Devices q={useDevices()} />
    </>
  );
}
