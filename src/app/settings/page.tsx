import { SettingsPage } from "@/components/settings/settings-page";
import { getFsrsOptimizerStatus } from "@/lib/fsrs-optimizer";
import { hasSearchParamValue } from "@/lib/search-params";
import { readInternalHref } from "@/lib/site";
import { getStudySettings } from "@/lib/settings";

type SettingsRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsRoute({
  searchParams
}: SettingsRouteProps) {
  const [fsrsOptimizerStatus, settings, resolvedSearchParams] =
    await Promise.all([
      getFsrsOptimizerStatus(),
      getStudySettings(),
      searchParams
    ]);
  const saved = hasSearchParamValue(resolvedSearchParams.saved, "1");
  const returnTo = readInternalHref(resolvedSearchParams.returnTo);

  return (
    <SettingsPage
      fsrsOptimizerStatus={fsrsOptimizerStatus}
      returnTo={returnTo}
      saved={saved}
      settings={settings}
    />
  );
}
