import { NextResponse } from "next/server";

import { getGlobalGlossaryAutocompleteData } from "@/lib/glossary";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const suggestions = await getGlobalGlossaryAutocompleteData({
    cards: searchParams.get("cards") ?? undefined,
    media: searchParams.get("media") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    study: searchParams.get("study") ?? undefined,
    type: searchParams.get("type") ?? undefined
  });

  return NextResponse.json(suggestions);
}
