"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_SESSION_COOKIE,
  createSessionToken,
  getAuthConfig,
  getSessionCookieOptions,
  verifyLoginCredentials
} from "@/lib/auth";
import { buildHrefWithSearch, readInternalHref } from "@/lib/site";

export async function loginAction(formData: FormData) {
  const config = getAuthConfig();

  if (!config.enabled) {
    redirect("/");
  }

  const nextHref = readInternalHref(formData.get("next")?.toString());
  const username = readRequiredString(formData, "username");
  const password = readRequiredPassword(formData, "password");

  if (!verifyLoginCredentials({ username, password })) {
    redirect(buildLoginHref(nextHref, "credentials"));
  }

  const cookieStore = await cookies();

  cookieStore.set(
    AUTH_SESSION_COOKIE,
    createSessionToken(),
    getSessionCookieOptions()
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

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing form field: ${key}`);
  }

  return value.trim();
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
