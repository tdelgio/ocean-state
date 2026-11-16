import { DataHealthOverview } from "@/components/ocean/data-health-overview";
import { OceanAppShell } from "@/components/ocean/shell";
import { getOceanIntelligence } from "@/lib/ocean";
import { buildDataHealthReport } from "@/lib/ocean/data-health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DataHealthPage() {
  const { snapshot } = await getOceanIntelligence();
  const report = buildDataHealthReport(snapshot.sources, snapshot.generatedAt);

  return (
    <OceanAppShell active="/status" marineAlertCount={snapshot.alerts.length} marineAlertHeadline={snapshot.alerts[0]?.headline}>
      <DataHealthOverview report={report} generatedAt={snapshot.generatedAt} />
    </OceanAppShell>
  );
}
