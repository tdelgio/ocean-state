import { OceanAppShell } from "@/components/ocean/shell";
import { HomeForecastOverview, normalizeShore } from "@/components/ocean/activity-forecast";
import { getOceanIntelligence } from "@/lib/ocean";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomeModePage({
  searchParams,
}: {
  searchParams: Promise<{ shore?: string | string[] }>;
}) {
  const params = await searchParams;
  if (!params.shore) {
    redirect("/home?shore=north");
  }

  const selectedShore = normalizeShore(params.shore);
  const { snapshot } = await getOceanIntelligence();

  return (
    <OceanAppShell active="/home" marineAlertCount={snapshot.alerts.length} marineAlertHeadline={snapshot.alerts[0]?.headline}>
      <HomeForecastOverview key={selectedShore} snapshot={snapshot} selectedShore={selectedShore} />
    </OceanAppShell>
  );
}
