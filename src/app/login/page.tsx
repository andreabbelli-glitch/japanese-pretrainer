import { redirect } from "next/navigation";

import { LoginPageContent } from "@/components/auth/login-page-content";
import { getAuthConfig } from "@/lib/auth";
import { hasSearchParamValue } from "@/lib/search-params";
import { readInternalHref } from "@/lib/site";

type LoginRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginRoute({ searchParams }: LoginRouteProps) {
  const config = getAuthConfig();

  if (!config.enabled) {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const nextHref = readInternalHref(resolvedSearchParams.next);
  const showCredentialsError = hasSearchParamValue(
    resolvedSearchParams.error,
    "credentials"
  );
  const showLoggedOutNotice = hasSearchParamValue(
    resolvedSearchParams.loggedOut,
    "1"
  );

  return (
    <LoginPageContent
      nextHref={nextHref}
      showCredentialsError={showCredentialsError}
      showLoggedOutNotice={showLoggedOutNotice}
    />
  );
}
