import { ActivityForecastPage, normalizeShore } from "@/components/ocean/activity-forecast";
import { OceanAppShell } from "@/components/ocean/shell";
import { getOceanIntelligence } from "@/lib/ocean";

export default async function ShoresPage({
  searchParams,
}: {
  searchParams: Promise<{ shore?: string | string[] }>;
}) {
  const { snapshot } = await getOceanIntelligence();
  const selectedShore = normalizeShore((await searchParams).shore);

  return (
    <OceanAppShell active="/shores" marineAlertCount={snapshot.alerts.length} marineAlertHeadline={snapshot.alerts[0]?.headline}>
      <ActivityForecastPage activity="shores" selectedShore={selectedShore} snapshot={snapshot} />
    </OceanAppShell>
  );
}
