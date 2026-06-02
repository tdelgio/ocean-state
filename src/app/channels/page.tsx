import { ActivityForecastPage, normalizeChannel } from "@/components/ocean/activity-forecast";
import { OceanAppShell } from "@/components/ocean/shell";
import { getOceanIntelligence } from "@/lib/ocean";

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string | string[]; zone?: string | string[] }>;
}) {
  const { snapshot } = await getOceanIntelligence();
  const params = await searchParams;
  const selectedChannel = normalizeChannel(params.channel);

  return (
    <OceanAppShell active="/channels" marineAlertCount={snapshot.alerts.length} marineAlertHeadline={snapshot.alerts[0]?.headline}>
      <ActivityForecastPage activity="channels" selectedChannel={selectedChannel} snapshot={snapshot} />
    </OceanAppShell>
  );
}
