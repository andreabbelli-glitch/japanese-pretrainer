import { expect } from "vitest";

export type GlossaryHrefExpectation = {
  pathname: string;
  returnTo?: string;
  searchParams?: Record<string, string>;
};

const MARKUP_HREF_REGEX = /href="([^"]*)"/g;
const TEST_BASE_URL = "https://example.test";

export function expectMarkupHref(
  markup: string,
  expected: GlossaryHrefExpectation
) {
  expectMarkupHrefMatch(markup, expected, true);
}

export function expectNoMarkupHref(
  markup: string,
  expected: GlossaryHrefExpectation
) {
  expectMarkupHrefMatch(markup, expected, false);
}

function expectMarkupHrefMatch(
  markup: string,
  expected: GlossaryHrefExpectation,
  shouldExist: boolean
) {
  const actualHrefs = Array.from(markup.matchAll(MARKUP_HREF_REGEX), (match) =>
    decodeHtmlEntities(match[1] ?? "")
  );
  const matchingHref = actualHrefs.find((href) => matchesExpectedHref(href, expected));
  const details = [
    `${shouldExist ? "Expected" : "Expected not"} to find href with pathname ${expected.pathname}`,
    expected.searchParams ? `searchParams ${JSON.stringify(expected.searchParams)}` : null,
    expected.returnTo ? `returnTo ${expected.returnTo}` : null,
    `Available hrefs: ${actualHrefs.join(" | ")}`
  ]
    .filter(Boolean)
    .join("\n");

  if (shouldExist) {
    expect(matchingHref, details).toBeDefined();
    return;
  }

  expect(matchingHref, details).toBeUndefined();
}

function matchesExpectedHref(
  href: string,
  expected: GlossaryHrefExpectation
) {
  const url = new URL(href, TEST_BASE_URL);

  if (url.pathname !== expected.pathname) {
    return false;
  }

  const normalizedSearchParams = Object.fromEntries(url.searchParams.entries());

  if (normalizedSearchParams.returnTo !== undefined) {
    normalizedSearchParams.returnTo = decodeReturnTo(
      normalizedSearchParams.returnTo
    );
  }

  const expectedSearchParams: Record<string, string> = {
    ...(expected.searchParams ?? {})
  };
  if (expected.returnTo !== undefined) {
    expectedSearchParams.returnTo = expected.returnTo;
  }

  const expectedKeys = Object.keys(expectedSearchParams).sort();
  const actualKeys = Object.keys(normalizedSearchParams).sort();

  if (
    expectedKeys.length !== actualKeys.length ||
    !expectedKeys.every((key, index) => key === actualKeys[index])
  ) {
    return false;
  }

  return expectedKeys.every(
    (key) => normalizedSearchParams[key] === expectedSearchParams[key]
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"');
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeReturnTo(value: string) {
  let current = value;

  for (let index = 0; index < 5; index += 1) {
    const decoded = safeDecodeURIComponent(current);

    if (decoded === current) {
      return decoded;
    }

    current = decoded;
  }

  return current;
}
