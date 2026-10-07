import { redirect } from "next/navigation";

export default async function LegacyLabels({ params }) {
  const { id } = await params;
  redirect(`/manufacturer/batches/${id}/labels`);
}
