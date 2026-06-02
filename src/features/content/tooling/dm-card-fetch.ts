import { createHash } from "node:crypto";

export type DmCardFetchInputKind = "fixture-html" | "official-id" | "url";
export type DmCardFetchStatus = "found" | "mismatch" | "not-found";
export type DmCardFetchConfidence = "blocked" | "high" | "medium";

export type DmOfficialCard = {
  abilities: string[];
  civilization?: string;
  cost?: string;
  flavor?: string;
  illustrator?: string;
  imageUrl?: string;
  mana?: string;
  name: string;
  officialId?: string;
  power?: string;
  print?: string;
  race?: string;
  rarity?: string;
  type?: string;
};

export type DmCardFetchExpectations = {
  keywords: string[];
  name?: string;
  print?: string;
  textLines: string[];
  type?: string;
};

export type DmCardFetchCheck = {
  actual?: string;
  expected: string;
  field: "keyword" | "name" | "print" | "text-line" | "type";
  status: "fail" | "pass";
};

export type DmCardFetchResult = {
  card?: DmOfficialCard;
  checks: {
    items: DmCardFetchCheck[];
    status: "fail" | "pass" | "unchecked";
  };
  confidence: DmCardFetchConfidence;
  flags: string[];
  source: {
    inputKind: DmCardFetchInputKind;
    kind: "official-tcg";
    url: string;
  };
  status: DmCardFetchStatus;
};

type ParseOfficialTcgCardDetailInput = {
  html: string;
  sourceUrl: string;
};

type BuildDmCardFetchResultInput = ParseOfficialTcgCardDetailInput & {
  expectations: DmCardFetchExpectations;
  inputKind: DmCardFetchInputKind;
};

const officialCardDetailOrigin = "https://dm.takaratomy.co.jp";
const officialCardIdPattern = /^[A-Za-z0-9][A-Za-z0-9-]*$/u;
export const dmCardHelperFlags = [
  "verify_with_screenshot",
  "errata_possible",
  "duel_plays_not_checked",
  "ground_truth_user_input"
];

export function createOfficialCardDetailUrl(officialId: string) {
  const url = new URL("/card/detail/", officialCardDetailOrigin);
  url.searchParams.set("id", officialId);
  return url.href;
}

export function isSafeOfficialCardId(value: string) {
  return officialCardIdPattern.test(value);
}

export function isOfficialCardDetailUrl(value: string) {
  try {
    const url = new URL(value);
    const officialIds = url.searchParams.getAll("id");
    const officialId = officialIds.at(0);

    return (
      url.protocol === "https:" &&
      url.hostname === "dm.takaratomy.co.jp" &&
      url.pathname === "/card/detail/" &&
      officialIds.length === 1 &&
      officialId !== undefined &&
      isSafeOfficialCardId(officialId)
    );
  } catch {
    return false;
  }
}

export function parseOfficialTcgCardDetail(
  input: ParseOfficialTcgCardDetailInput
): DmOfficialCard | null {
  const nameHeading = findFirstElementByClass(input.html, "h3", "card-name");

  if (!nameHeading) {
    return null;
  }

  const print = readPackName(nameHeading.html);
  const name = normalizeText(
    stripTags(
      nameHeading.html.replaceAll(
        /<span\b[^>]*class=(["'])[^"']*\bpackname\b[^"']*\1[^>]*>[\s\S]*?<\/span>/giu,
        ""
      )
    )
  );

  if (!name) {
    return null;
  }

  const imageUrl = readImageUrl(input.html, input.sourceUrl);
  const officialId =
    readOfficialIdFromUrl(input.sourceUrl) ?? readOfficialIdFromImage(imageUrl);

  return {
    abilities: readAbilityLines(input.html),
    civilization: readClassText(input.html, "civil"),
    cost: readClassText(input.html, "cost"),
    flavor: readClassText(input.html, "flavor"),
    illustrator: readClassText(input.html, "illusttxt"),
    imageUrl,
    mana: readClassText(input.html, "mana"),
    name,
    officialId,
    power: readClassText(input.html, "power"),
    print,
    race: readClassText(input.html, "race"),
    rarity: readClassText(input.html, "rarelity"),
    type: readClassText(input.html, "type")
  };
}

export function buildDmCardFetchResult(
  input: BuildDmCardFetchResultInput
): DmCardFetchResult {
  const card = parseOfficialTcgCardDetail({
    html: input.html,
    sourceUrl: input.sourceUrl
  });

  if (!card) {
    return {
      checks: { items: [], status: "unchecked" },
      confidence: "blocked",
      flags: dmCardHelperFlags,
      source: {
        inputKind: input.inputKind,
        kind: "official-tcg",
        url: input.sourceUrl
      },
      status: "not-found"
    };
  }

  const checks = buildChecks(card, input.expectations);
  const checkStatus = resolveCheckStatus(checks);

  return {
    card,
    checks: {
      items: checks,
      status: checkStatus
    },
    confidence: resolveConfidence(checkStatus),
    flags: dmCardHelperFlags,
    source: {
      inputKind: input.inputKind,
      kind: "official-tcg",
      url: input.sourceUrl
    },
    status: checkStatus === "fail" ? "mismatch" : "found"
  };
}

export function formatDmCardFetchResult(result: DmCardFetchResult) {
  const lines = [
    [
      `STATUS ${result.status}`,
      "source=official-tcg",
      `confidence=${result.confidence}`,
      `checks=${result.checks.status}`,
      "authority=helper"
    ].join(" ")
  ];

  if (result.card) {
    lines.push(formatCardLine(result.card));
  }

  for (const check of result.checks.items) {
    lines.push(formatCheckLine(check));
  }

  if (result.card) {
    lines.push(
      `TEXT lines=${result.card.abilities.length} hash=sha256:${hashTextLines(
        result.card.abilities
      )}`
    );

    result.card.abilities.forEach((line, index) => {
      lines.push(`T${index + 1} ${quoteForLine(line)}`);
    });

    if (result.card.flavor) {
      lines.push(`FLAVOR ${quoteForLine(result.card.flavor)}`);
    }

    if (result.card.imageUrl) {
      lines.push(`IMAGE ${result.card.imageUrl}`);
    }
  }

  lines.push(`URL ${result.source.url}`);
  lines.push(`FLAGS ${result.flags.join(" ")}`);

  if (result.status === "mismatch") {
    lines.push(
      "ACTION prefer user-provided screenshot/text; inspect mismatch before using fetched text"
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildChecks(
  card: DmOfficialCard,
  expectations: DmCardFetchExpectations
) {
  const checks: DmCardFetchCheck[] = [];

  if (expectations.name) {
    checks.push(buildExactCheck("name", expectations.name, card.name));
  }

  if (expectations.print) {
    checks.push(buildExactCheck("print", expectations.print, card.print));
  }

  if (expectations.type) {
    checks.push(buildExactCheck("type", expectations.type, card.type));
  }

  for (const expected of expectations.textLines) {
    checks.push({
      actual: card.abilities.join(" / "),
      expected,
      field: "text-line",
      status: textIncludes(card.abilities, expected) ? "pass" : "fail"
    });
  }

  for (const expected of expectations.keywords) {
    checks.push({
      actual: card.abilities.join(" / "),
      expected,
      field: "keyword",
      status: textIncludes(card.abilities, expected) ? "pass" : "fail"
    });
  }

  return checks;
}

function buildExactCheck(
  field: "name" | "print" | "type",
  expected: string,
  actual: string | undefined
): DmCardFetchCheck {
  return {
    actual,
    expected,
    field,
    status:
      normalizeComparable(actual ?? "") === normalizeComparable(expected)
        ? "pass"
        : "fail"
  };
}

function resolveCheckStatus(checks: DmCardFetchCheck[]) {
  if (checks.length === 0) {
    return "unchecked";
  }

  return checks.every((check) => check.status === "pass") ? "pass" : "fail";
}

function resolveConfidence(
  checkStatus: DmCardFetchResult["checks"]["status"]
): DmCardFetchConfidence {
  if (checkStatus === "pass") {
    return "high";
  }

  if (checkStatus === "fail") {
    return "blocked";
  }

  return "medium";
}

function textIncludes(lines: string[], expected: string) {
  const normalizedExpected = normalizeComparable(expected);

  return lines.some((line) =>
    normalizeComparable(line).includes(normalizedExpected)
  );
}

function readPackName(html: string) {
  const match = html.match(
    /<span\b[^>]*class=(["'])[^"']*\bpackname\b[^"']*\1[^>]*>\(([\s\S]*?)\)<\/span>/iu
  );

  return match ? normalizeText(stripTags(match[2]!)) : undefined;
}

function readClassText(html: string, className: string) {
  const element = findFirstElementByClass(html, "td", className);
  const text = element ? normalizeText(stripTags(element.html)) : "";

  return text.length > 0 ? text : undefined;
}

function readAbilityLines(html: string) {
  const skills = findFirstElementByClass(html, "td", "skills");

  if (!skills) {
    return [];
  }

  const items = findElementsByTag(skills.html, "li");

  return items
    .map((item) => normalizeText(stripTags(item.html)))
    .filter((line) => line.length > 0);
}

function readImageUrl(html: string, sourceUrl: string) {
  const imageMatch = html.match(
    /<div\b[^>]*class=(["'])[^"']*\bcard-img\b[^"']*\1[^>]*>[\s\S]*?<img\b([^>]*)>/iu
  );
  const src = imageMatch ? readAttribute(imageMatch[2]!, "src") : undefined;

  if (!src) {
    return undefined;
  }

  try {
    return new URL(src, sourceUrl).href;
  } catch {
    return src;
  }
}

function readOfficialIdFromUrl(sourceUrl: string) {
  try {
    return new URL(sourceUrl).searchParams.get("id") ?? undefined;
  } catch {
    return undefined;
  }
}

function readOfficialIdFromImage(imageUrl: string | undefined) {
  if (!imageUrl) {
    return undefined;
  }

  const fileName = imageUrl.split("/").at(-1);

  return fileName?.replace(/\.[^.]+$/u, "");
}

function findFirstElementByClass(
  html: string,
  tagName: string,
  className: string
) {
  return findElementsByTag(html, tagName).find((element) =>
    hasClass(element.attributes, className)
  );
}

function findElementsByTag(html: string, tagName: string) {
  const pattern = new RegExp(
    `<${escapeRegExp(tagName)}\\b([^>]*)>([\\s\\S]*?)<\\/${escapeRegExp(
      tagName
    )}>`,
    "giu"
  );
  const elements: Array<{ attributes: string; html: string }> = [];

  for (const match of html.matchAll(pattern)) {
    elements.push({
      attributes: match[1] ?? "",
      html: match[2] ?? ""
    });
  }

  return elements;
}

function hasClass(attributes: string, className: string) {
  const classValue = readAttribute(attributes, "class");

  return (
    classValue
      ?.split(/\s+/u)
      .filter((value) => value.length > 0)
      .includes(className) ?? false
  );
}

function readAttribute(attributes: string, attributeName: string) {
  const pattern = new RegExp(
    `\\b${escapeRegExp(attributeName)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
    "iu"
  );
  const match = attributes.match(pattern);

  return match?.[2];
}

function stripTags(html: string) {
  return decodeHtmlEntities(
    html
      .replaceAll(/<br\s*\/?>/giu, "\n")
      .replaceAll(/<img\b[^>]*>/giu, " ")
      .replaceAll(/<[^>]+>/gu, "")
  );
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"'
  };

  return value.replaceAll(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/giu,
    (entity, rawName: string) => {
      const name = rawName.toLowerCase();

      if (name.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
      }

      if (name.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
      }

      return namedEntities[name] ?? entity;
    }
  );
}

function normalizeText(value: string) {
  return value.replaceAll(/\s+/gu, " ").trim();
}

function normalizeComparable(value: string) {
  return normalizeText(value);
}

function formatCardLine(card: DmOfficialCard) {
  return [
    "CARD",
    card.officialId ? `official=${card.officialId}` : null,
    `name=${quoteForLine(card.name)}`,
    card.print ? `print=${quoteForLine(card.print)}` : null,
    card.type ? `type=${quoteForLine(card.type)}` : null,
    card.civilization ? `civ=${quoteForLine(card.civilization)}` : null,
    card.cost ? `cost=${card.cost}` : null,
    card.mana ? `mana=${card.mana}` : null,
    card.rarity ? `rarity=${quoteForLine(card.rarity)}` : null,
    card.power ? `power=${card.power}` : null,
    card.race ? `race=${quoteForLine(card.race)}` : null
  ]
    .filter((value): value is string => value !== null)
    .join(" ");
}

function formatCheckLine(check: DmCardFetchCheck) {
  return [
    `CHECK ${check.status}`,
    check.field,
    `expected=${quoteForLine(check.expected)}`,
    check.actual ? `actual=${quoteForLine(check.actual)}` : null
  ]
    .filter((value): value is string => value !== null)
    .join(" ");
}

function hashTextLines(lines: string[]) {
  return createHash("sha256")
    .update(lines.join("\n"))
    .digest("hex")
    .slice(0, 12);
}

function quoteForLine(value: string) {
  return JSON.stringify(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
