import { ExtendedForecastOverview, normalizeForecastRegion } from "@/components/ocean/activity-forecast";
import { OceanAppShell } from "@/components/ocean/shell";
import { getOceanIntelligence } from "@/lib/ocean";

export const revalidate = 300;

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string | string[]; shore?: string | string[] }>;
}) {
  const { snapshot } = await getOceanIntelligence();
  const params = await searchParams;
  const selectedRegion = normalizeForecastRegion(params.region ?? params.shore);

  return (
    <OceanAppShell active="/forecast" marineAlertCount={snapshot.alerts.length} marineAlertHeadline={snapshot.alerts[0]?.headline}>
      <ExtendedForecastOverview snapshot={snapshot} selectedRegion={selectedRegion} />
    </OceanAppShell>
  );
}
