import { ActivityForecastPage, normalizeHarbor } from "@/components/ocean/activity-forecast";
import { OceanAppShell } from "@/components/ocean/shell";
import { getOceanIntelligence } from "@/lib/ocean";

export default async function HarborsPage({
  searchParams,
}: {
  searchParams: Promise<{ harbor?: string | string[]; zone?: string | string[] }>;
}) {
  const { snapshot } = await getOceanIntelligence();
  const params = await searchParams;
  const selectedHarbor = normalizeHarbor(params.harbor);

  return (
    <OceanAppShell active="/harbors" marineAlertCount={snapshot.alerts.length} marineAlertHeadline={snapshot.alerts[0]?.headline}>
      <ActivityForecastPage activity="harbors" selectedHarbor={selectedHarbor} snapshot={snapshot} />
    </OceanAppShell>
  );
}
