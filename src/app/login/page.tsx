import { redirect } from "next/navigation";

import { LoginPageContent } from "@/components/auth/login-page-content";
import { getAuthConfig } from "@/lib/auth";
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
  const showCredentialsError = resolvedSearchParams.error === "credentials";
  const showLoggedOutNotice = resolvedSearchParams.loggedOut === "1";

  return (
    <LoginPageContent
      nextHref={nextHref}
      showCredentialsError={showCredentialsError}
      showLoggedOutNotice={showLoggedOutNotice}
    />
  );
}
