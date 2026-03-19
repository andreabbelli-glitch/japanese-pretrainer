import { NextResponse, type NextRequest } from "next/server";

import {
  APP_SEARCH_HEADER,
  APP_PATHNAME_HEADER,
  AUTH_SESSION_COOKIE,
  AUTH_LOGIN_PATH,
  getAuthConfig,
  hasValidSessionToken,
  isLoginPath
} from "@/lib/auth";
import {
  REVIEW_PROFILE_COOKIE,
  REVIEW_PROFILE_COOKIE_MAX_AGE_SECONDS,
  REVIEW_PROFILE_HEADER,
  REVIEW_PROFILE_QUERY_PARAM,
  resolveReviewProfilingControl
} from "@/lib/review-profiler";

export function proxy(request: NextRequest) {
  const config = getAuthConfig();
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const requestHeaders = new Headers(request.headers);
  const profilingControl = resolveReviewProfilingControl({
    cookieValue: request.cookies.get(REVIEW_PROFILE_COOKIE)?.value,
    queryValue: request.nextUrl.searchParams.get(REVIEW_PROFILE_QUERY_PARAM)
  });

  requestHeaders.set(APP_PATHNAME_HEADER, pathname);
  requestHeaders.set(APP_SEARCH_HEADER, search);
  requestHeaders.set(
    REVIEW_PROFILE_HEADER,
    profilingControl.enabled ? "1" : "0"
  );

  if (!config.enabled) {
    return continueRequest(requestHeaders, profilingControl.cookieMutation);
  }

  const isLoginPage = isLoginPath(pathname);
  const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const isAuthenticated = hasValidSessionToken(sessionToken);

  if (isLoginPage && isAuthenticated) {
    return applyProfilingCookie(
      NextResponse.redirect(new URL("/", request.url)),
      profilingControl.cookieMutation
    );
  }

  if (isLoginPage || isAuthenticated) {
    return continueRequest(requestHeaders, profilingControl.cookieMutation);
  }

  const loginUrl = new URL(AUTH_LOGIN_PATH, request.url);
  const destination = `${pathname}${request.nextUrl.search}`;

  if (!isLoginPath(destination)) {
    loginUrl.searchParams.set("next", destination);
  }

  return applyProfilingCookie(
    NextResponse.redirect(loginUrl),
    profilingControl.cookieMutation
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|site.webmanifest).*)"
  ]
};

function continueRequest(
  requestHeaders: Headers,
  cookieMutation: "disable" | "enable" | "preserve"
) {
  return applyProfilingCookie(
    NextResponse.next({
      request: {
        headers: requestHeaders
      }
    }),
    cookieMutation
  );
}

function applyProfilingCookie(
  response: NextResponse,
  cookieMutation: "disable" | "enable" | "preserve"
) {
  if (cookieMutation === "enable") {
    response.cookies.set(REVIEW_PROFILE_COOKIE, "1", {
      httpOnly: true,
      maxAge: REVIEW_PROFILE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
  } else if (cookieMutation === "disable") {
    response.cookies.delete(REVIEW_PROFILE_COOKIE);
  }

  return response;
}
