import { OceanAppShell } from "@/components/ocean/shell";
import { HomeForecastOverview, normalizeIsland, normalizeShore } from "@/components/ocean/activity-forecast";
import { getOceanIntelligence, malikoNorthShoreRoute, oahuLiveOceanRoute } from "@/lib/ocean";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomeModePage({
  searchParams,
}: {
  searchParams: Promise<{ island?: string | string[]; shore?: string | string[] }>;
}) {
  const params = await searchParams;
  const selectedIsland = normalizeIsland(params.island);
  if (!params.shore) {
    redirect(`/home?island=${selectedIsland}&shore=north`);
  }

  const selectedShore = normalizeShore(params.shore);
  const route = selectedIsland === "oahu" ? oahuLiveOceanRoute : malikoNorthShoreRoute;
  const { snapshot } = await getOceanIntelligence(route);
  const islandLabel = selectedIsland === "oahu" ? "Oʻahu" : "Maui";

  return (
    <OceanAppShell active="/home" islandLabel={islandLabel} marineAlertCount={snapshot.alerts.length} marineAlertHeadline={snapshot.alerts[0]?.headline}>
      <HomeForecastOverview key={`${selectedIsland}-${selectedShore}`} snapshot={snapshot} selectedIsland={selectedIsland} selectedShore={selectedShore} />
    </OceanAppShell>
  );
}
