import { unstable_noStore as noStore } from "next/cache";

import { db, type DatabaseClient } from "@/db";
import {
  loadGlobalGlossaryAutocompleteData,
  loadGlobalGlossaryDetailData,
  loadGlobalGlossaryPageData,
  loadGlossaryDetailData,
  loadGlossaryPageData
} from "./loaders";
import type {
  GlossaryDetailData,
  GlossaryPageData,
  GlobalGlossaryAutocompleteSuggestion,
  GlobalGlossaryPageData
} from "../types";

export type * from "../types";

export async function getGlossaryPageData(
  mediaSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlossaryPageData | null> {
  markDataAsLive();
  return loadGlossaryPageData(mediaSlug, searchParams, database);
}

export async function getGlobalGlossaryPageData(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlobalGlossaryPageData> {
  return loadGlobalGlossaryPageData(searchParams, database);
}

export async function getGlobalGlossaryAutocompleteData(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlobalGlossaryAutocompleteSuggestion[]> {
  return loadGlobalGlossaryAutocompleteData(searchParams, database);
}

export async function getGlobalTermGlossaryDetailData(
  surface: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlossaryDetailData | null> {
  markDataAsLive();
  return loadGlobalGlossaryDetailData("term", surface, searchParams, database);
}

export async function getGlobalGrammarGlossaryDetailData(
  surface: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlossaryDetailData | null> {
  markDataAsLive();
  return loadGlobalGlossaryDetailData(
    "grammar",
    surface,
    searchParams,
    database
  );
}

export async function getTermGlossaryDetailData(
  mediaSlug: string,
  entryId: string,
  database: DatabaseClient = db
): Promise<GlossaryDetailData | null> {
  markDataAsLive();
  return loadGlossaryDetailData(mediaSlug, "term", entryId, database);
}

export async function getGrammarGlossaryDetailData(
  mediaSlug: string,
  entryId: string,
  database: DatabaseClient = db
): Promise<GlossaryDetailData | null> {
  markDataAsLive();
  return loadGlossaryDetailData(mediaSlug, "grammar", entryId, database);
}

function markDataAsLive() {
  try {
    noStore();
  } catch {
    // Rendering hint only.
  }
}
