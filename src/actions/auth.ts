"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { readOptionalInternalHref, readRequiredString } from "./form-data.ts";
import {
  AUTH_SESSION_COOKIE,
  createSessionToken,
  getAuthConfig,
  getSessionCookieOptions,
  verifyLoginCredentials
} from "@/lib/auth";
import { buildHrefWithSearch } from "@/lib/site";

export async function loginAction(formData: FormData) {
  const config = getAuthConfig();

  if (!config.enabled) {
    redirect("/");
  }

  const nextHref = readOptionalInternalHref(formData, "next");
  const username = readRequiredString(formData, "username");
  const password = readRequiredPassword(formData, "password");
  const credentialsValid = verifyLoginCredentials({ username, password });

  if (!credentialsValid) {
    redirect(buildLoginHref(nextHref, "credentials"));
  }

  const cookieStore = await cookies();
  const now = Date.now();

  cookieStore.set(
    AUTH_SESSION_COOKIE,
    createSessionToken(now),
    getSessionCookieOptions(now)
  );

  redirect(nextHref ?? "/");
}

export async function logoutAction() {
  const cookieStore = await cookies();

  cookieStore.delete(AUTH_SESSION_COOKIE);
  redirect(
    buildHrefWithSearch("/login", (params) => {
      params.set("loggedOut", "1");
    })
  );
}


function readRequiredPassword(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing form field: ${key}`);
  }

  return value;
}

function buildLoginHref(nextHref: Route | null, error: "credentials"): Route {
  return buildHrefWithSearch("/login", (params) => {
    if (nextHref) {
      params.set("next", nextHref);
    }

    params.set("error", error);
  });
}
