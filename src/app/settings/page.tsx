import { SettingsPage } from "@/components/settings/settings-page";
import {
  buildFsrsReschedulePreview,
  getFsrsOptimizerStatus
} from "@/features/fsrs-optimizer/server";
import { hasSearchParamValue } from "@/features/shared/model/search-params";
import { readInternalHref } from "@/features/navigation";
import { getStudySettings } from "@/features/settings/server";

type SettingsRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsRoute({
  searchParams
}: SettingsRouteProps) {
  const resolvedSearchParams = await searchParams;
  const saved = hasSearchParamValue(resolvedSearchParams.saved, "1");
  const fsrsRescheduleStatus = hasSearchParamValue(
    resolvedSearchParams.fsrsRescheduled,
    "1"
  )
    ? "applied"
    : hasSearchParamValue(resolvedSearchParams.fsrsRescheduleStale, "1")
      ? "stale"
      : hasSearchParamValue(resolvedSearchParams.fsrsRescheduleNoop, "1")
        ? "noop"
        : null;
  const shouldBuildFsrsReschedulePreview =
    fsrsRescheduleStatus !== null ||
    hasSearchParamValue(resolvedSearchParams.fsrsPreview, "1");
  const [fsrsOptimizerStatus, fsrsReschedulePreview, settings] =
    await Promise.all([
      getFsrsOptimizerStatus(),
      shouldBuildFsrsReschedulePreview
        ? buildFsrsReschedulePreview()
        : Promise.resolve(null),
      getStudySettings()
    ]);
  const returnTo = readInternalHref(resolvedSearchParams.returnTo);

  return (
    <SettingsPage
      fsrsOptimizerStatus={fsrsOptimizerStatus}
      fsrsReschedulePreview={fsrsReschedulePreview}
      fsrsRescheduleStatus={fsrsRescheduleStatus}
      returnTo={returnTo}
      saved={saved}
      settings={settings}
    />
  );
}
