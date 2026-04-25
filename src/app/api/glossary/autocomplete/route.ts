import { NextResponse } from "next/server";

import { getGlobalGlossaryAutocompleteData } from "@/features/glossary/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const suggestions = await getGlobalGlossaryAutocompleteData({
    cards: readRequestSearchParam(searchParams, "cards"),
    media: readRequestSearchParam(searchParams, "media"),
    q: readRequestSearchParam(searchParams, "q"),
    study: readRequestSearchParam(searchParams, "study"),
    type: readRequestSearchParam(searchParams, "type")
  });

  return NextResponse.json(suggestions);
}

function readRequestSearchParam(searchParams: URLSearchParams, key: string) {
  const candidates = searchParams
    .getAll(key)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates.length === 1 ? candidates[0] : candidates;
}
