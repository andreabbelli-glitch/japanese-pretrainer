import { NextResponse, type NextRequest } from "next/server";

import {
  APP_SEARCH_HEADER,
  APP_PATHNAME_HEADER,
  AUTH_SESSION_COOKIE,
  AUTH_LOGIN_PATH,
  getAuthConfig,
  hasValidSessionToken,
  isLoginPath
} from "@/features/auth/server";

const INTERNAL_CONTENT_CACHE_REVALIDATE_PATH =
  "/api/internal/content-cache/revalidate";
const INTERNAL_FSRS_OPTIMIZER_RUN_PATH = "/api/internal/fsrs-optimizer/run";
const DAILY_KANJI_IOS_DATASET_PATH = "/api/daily-kanji/ios-dataset";
const STATIC_MEDIA_AUDIO_PATH_PREFIX = "/media-audio";

export function proxy(request: NextRequest) {
  const config = getAuthConfig();
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(APP_PATHNAME_HEADER, pathname);
  requestHeaders.set(APP_SEARCH_HEADER, search);

  if (isStaticMediaAudioPath(pathname)) {
    return continueRequest(requestHeaders);
  }

  if (!config.enabled) {
    return continueRequest(requestHeaders);
  }

  const isLoginPage = isLoginPath(pathname);
  const isInternalContentCacheRevalidate =
    pathname === INTERNAL_CONTENT_CACHE_REVALIDATE_PATH;
  const isInternalFsrsOptimizerRun =
    pathname === INTERNAL_FSRS_OPTIMIZER_RUN_PATH;
  const isDailyKanjiIosDataset = pathname === DAILY_KANJI_IOS_DATASET_PATH;
  const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  const isAuthenticated = hasValidSessionToken(sessionToken);

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    isLoginPage ||
    isAuthenticated ||
    isInternalContentCacheRevalidate ||
    isInternalFsrsOptimizerRun ||
    isDailyKanjiIosDataset
  ) {
    return continueRequest(requestHeaders);
  }

  const loginUrl = new URL(AUTH_LOGIN_PATH, request.url);
  const destination = `${pathname}${request.nextUrl.search}`;

  if (!isLoginPath(destination)) {
    loginUrl.searchParams.set("next", destination);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|media-audio(?:/|$)|favicon.ico|icon.svg|apple-icon.png|robots.txt|site.webmanifest).*)"
  ]
};

export function isStaticMediaAudioPath(pathname: string) {
  return (
    pathname === STATIC_MEDIA_AUDIO_PATH_PREFIX ||
    pathname.startsWith(`${STATIC_MEDIA_AUDIO_PATH_PREFIX}/`)
  );
}

function continueRequest(requestHeaders: Headers) {
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}
