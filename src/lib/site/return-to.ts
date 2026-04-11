import type { Route } from "next";

export type ReturnToContextKind =
  | "review"
  | "globalGlossary"
  | "localGlossary"
  | "mediaLibrary"
  | "media"
  | "other";

export type ReturnToContext = {
  href: Route;
  kind: ReturnToContextKind;
  pathname: string;
};

export function readInternalHref(
  value: string | string[] | undefined
): Route | null {
  const candidates = Array.isArray(value) ? value : [value];
  for (const entry of candidates) {
    if (typeof entry !== "string") {
      continue;
    }

    const trimmed = entry.trim();

    if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
      continue;
    }

    return trimmed as Route;
  }

  return null;
}

export function readNestedReturnTo(
  value: string | string[] | Route | null | undefined
): Route | null {
  const href = readInternalHref(
    Array.isArray(value) ? value : value === null ? undefined : value
  );

  if (!href) {
    return null;
  }

  const nestedReturnTo = new URL(href, "https://jcs.local").searchParams.get(
    "returnTo"
  );

  return readInternalHref(nestedReturnTo ?? undefined);
}

export function resolveReturnToContext(
  value: string | string[] | Route | null | undefined
): ReturnToContext | null {
  const href = readInternalHref(
    Array.isArray(value) ? value : value === null ? undefined : value
  );

  if (!href) {
    return null;
  }

  const pathname = normalizeInternalPathname(
    new URL(href, "https://jcs.local").pathname
  );

  if (
    pathname === "/review" ||
    pathname.startsWith("/review/") ||
    /^\/media\/[^/]+\/review(?:\/|$)/.test(pathname)
  ) {
    return {
      href,
      kind: "review",
      pathname
    };
  }

  if (pathname === "/glossary" || pathname.startsWith("/glossary/")) {
    return {
      href,
      kind: "globalGlossary",
      pathname
    };
  }

  if (/^\/media\/[^/]+\/glossary(?:\/|$)/.test(pathname)) {
    return {
      href,
      kind: "localGlossary",
      pathname
    };
  }

  if (pathname === "/media") {
    return {
      href,
      kind: "mediaLibrary",
      pathname
    };
  }

  if (/^\/media\/[^/]+(?:\/|$)/.test(pathname)) {
    return {
      href,
      kind: "media",
      pathname
    };
  }

  return {
    href,
    kind: "other",
    pathname
  };
}

function normalizeInternalPathname(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

export function resolveReturnToLabel(
  context: ReturnToContext | null
): string | null {
  if (!context) {
    return null;
  }

  switch (context.kind) {
    case "review":
      return "Torna alla Review";
    case "globalGlossary":
    case "localGlossary":
      return "Torna al Glossary";
    case "mediaLibrary":
      return "Torna ai Media";
    case "media":
      return "Torna al Media";
    case "other":
      return null;
  }
}

export function resolveGlossaryReviewReturnTo(
  value: string | string[] | Route | null | undefined
): Route | null {
  let currentHref = readInternalHref(
    Array.isArray(value) ? value : value === null ? undefined : value
  );
  const visitedHrefs = new Set<Route>();

  while (currentHref) {
    if (visitedHrefs.has(currentHref)) {
      return null;
    }

    visitedHrefs.add(currentHref);

    const currentContext = resolveReturnToContext(currentHref);

    if (currentContext?.kind === "review") {
      return currentContext.href;
    }

    if (
      currentContext?.kind !== "globalGlossary" &&
      currentContext?.kind !== "localGlossary"
    ) {
      return null;
    }

    currentHref = readNestedReturnTo(currentContext.href);
  }

  return null;
}

export function resolveGlossaryBackNavigation(input: {
  localGlossaryHref: Route;
  mediaHref: Route;
  mediaTitle: string;
  page: "index" | "detail";
  returnTo?: Route | null;
}) {
  const returnContext = resolveReturnToContext(input.returnTo);

  switch (returnContext?.kind) {
    case "review":
      return {
        backHref: returnContext.href,
        backLabel: "Torna alla Review",
        returnContext
      };
    case "globalGlossary":
    case "localGlossary":
      return {
        backHref: returnContext.href,
        backLabel: "Torna al Glossary",
        returnContext
      };
    case "mediaLibrary":
      return {
        backHref: returnContext.href,
        backLabel: "Torna ai Media",
        returnContext
      };
    case "media":
      return {
        backHref: returnContext.href,
        backLabel: `Torna a ${input.mediaTitle}`,
        returnContext
      };
    case "other":
    case undefined:
      return {
        backHref:
          input.page === "detail" ? input.localGlossaryHref : input.mediaHref,
        backLabel:
          input.page === "detail"
            ? "Torna al Glossary"
            : `Torna a ${input.mediaTitle}`,
        returnContext: returnContext ?? null
      };
  }
}
