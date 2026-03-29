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
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  return trimmed as Route;
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

  const pathname = new URL(href, "https://jcs.local").pathname;

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

  while (currentHref) {
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
