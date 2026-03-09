import { SettingsPage } from "@/components/settings/settings-page";
import { getStudySettings } from "@/lib/settings";

type SettingsRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsRoute({
  searchParams
}: SettingsRouteProps) {
  const [settings, resolvedSearchParams] = await Promise.all([
    getStudySettings(),
    searchParams
  ]);
  const saved = resolvedSearchParams.saved === "1";

  return <SettingsPage saved={saved} settings={settings} />;
}
