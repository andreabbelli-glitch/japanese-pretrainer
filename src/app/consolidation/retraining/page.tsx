import { ConsolidationSessionClient } from "@/components/consolidation/consolidation-session-client";
import { getRetrainingConsolidationSessionData } from "@/features/consolidation/server";

export const dynamic = "force-dynamic";

export default async function ConsolidationRetrainingRoute() {
  const data = await getRetrainingConsolidationSessionData();

  return <ConsolidationSessionClient data={data} key="retraining" />;
}
