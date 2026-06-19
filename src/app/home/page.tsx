import { OceanAppShell } from "@/components/ocean/shell";
import { HomeForecastOverview, normalizeShore } from "@/components/ocean/activity-forecast";
import { getOceanIntelligence } from "@/lib/ocean";

export const dynamic = "force-dynamic";

export default async function HomeModePage({
  searchParams,
}: {
  searchParams: Promise<{ shore?: string | string[] }>;
}) {
  const params = await searchParams;
  const selectedShore = normalizeShore(params.shore);
  const { snapshot } = await getOceanIntelligence();

  return (
    <OceanAppShell active="/home" marineAlertCount={snapshot.alerts.length} marineAlertHeadline={snapshot.alerts[0]?.headline}>
      <HomeForecastOverview snapshot={snapshot} selectedShore={selectedShore} />
    </OceanAppShell>
  );
}
