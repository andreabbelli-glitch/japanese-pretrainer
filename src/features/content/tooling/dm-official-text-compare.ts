import { createHash } from "node:crypto";

import {
  dmCardHelperFlags,
  parseOfficialTcgCardDetail,
  type DmCardFetchInputKind,
  type DmOfficialCard
} from "./dm-card-fetch.ts";

export type DmOfficialTextCompareVisibleInput = {
  cardLines: string[];
  keywords: string[];
  name?: string;
  print?: string;
  type?: string;
};

export type DmOfficialTextCompareStatus =
  | "mismatch"
  | "not-found"
  | "supported";

export type DmOfficialTextCompareCheckField =
  | "card-line"
  | "keyword"
  | "name"
  | "print"
  | "type";

export type DmOfficialTextCompareCheck = {
  field: DmOfficialTextCompareCheckField;
  mode?: "exact" | "normalized";
  official?: string;
  official_line?: number;
  official_lines?: number;
  status: "fail" | "pass";
  visible: string;
};

export type DmOfficialTextCompareResult = {
  authority: "helper";
  card?: DmOfficialCard;
  checks: {
    items: DmOfficialTextCompareCheck[];
    status: "fail" | "pass" | "unchecked";
  };
  confidence: "blocked" | "high";
  flags: string[];
  ground_truth: "user-input";
  schema_version: 1;
  source: {
    inputKind: DmCardFetchInputKind;
    kind: "official-tcg";
    url: string;
  };
  status: DmOfficialTextCompareStatus;
};

type BuildDmOfficialTextCompareResultInput = {
  html: string;
  inputKind: DmCardFetchInputKind;
  sourceUrl: string;
  visible: DmOfficialTextCompareVisibleInput;
};

export function buildDmOfficialTextCompareResult(
  input: BuildDmOfficialTextCompareResultInput
): DmOfficialTextCompareResult {
  const card = parseOfficialTcgCardDetail({
    html: input.html,
    sourceUrl: input.sourceUrl
  });

  if (!card) {
    return {
      authority: "helper",
      checks: { items: [], status: "unchecked" },
      confidence: "blocked",
      flags: dmCardHelperFlags,
      ground_truth: "user-input",
      schema_version: 1,
      source: {
        inputKind: input.inputKind,
        kind: "official-tcg",
        url: input.sourceUrl
      },
      status: "not-found"
    };
  }

  const checks = buildChecks(card, input.visible);
  const checksStatus = resolveChecksStatus(checks);

  return {
    authority: "helper",
    card,
    checks: {
      items: checks,
      status: checksStatus
    },
    confidence: checksStatus === "pass" ? "high" : "blocked",
    flags: dmCardHelperFlags,
    ground_truth: "user-input",
    schema_version: 1,
    source: {
      inputKind: input.inputKind,
      kind: "official-tcg",
      url: input.sourceUrl
    },
    status: checksStatus === "pass" ? "supported" : "mismatch"
  };
}

export function hasVisibleCompareInput(
  input: DmOfficialTextCompareVisibleInput
) {
  return (
    input.cardLines.some(hasText) ||
    input.keywords.some(hasText) ||
    hasText(input.name) ||
    hasText(input.print) ||
    hasText(input.type)
  );
}

export function splitVisibleTextLines(value: string) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function formatDmOfficialTextCompareResult(
  result: DmOfficialTextCompareResult
) {
  const lines = [
    [
      `OFFICIAL_TEXT_COMPARE ${result.status}`,
      "source=official-tcg",
      `confidence=${result.confidence}`,
      `checks=${result.checks.status}`,
      "authority=helper"
    ].join(" "),
    "GROUND_TRUTH user-input"
  ];

  if (result.card) {
    lines.push(formatCardLine(result.card));
  }

  for (const check of result.checks.items) {
    lines.push(formatCheckLine(check));
  }

  if (result.card) {
    lines.push(
      `OFFICIAL_TEXT lines=${
        result.card.abilities.length
      } hash=sha256:${hashTextLines(result.card.abilities)}`
    );
  }

  lines.push(`URL ${result.source.url}`);
  lines.push(`FLAGS ${result.flags.join(" ")}`);

  if (result.status === "supported") {
    lines.push(
      "ACTION official page did not contradict checked user-visible text"
    );
  } else if (result.status === "mismatch") {
    lines.push(
      "ACTION keep user-provided screenshot/text; inspect errata, reprint, or Duel Masters Play's-only mismatch before copying official wording"
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildChecks(
  card: DmOfficialCard,
  visible: DmOfficialTextCompareVisibleInput
) {
  const checks: DmOfficialTextCompareCheck[] = [];
  const { name, print, type } = visible;

  if (hasText(name)) {
    checks.push(compareScalar("name", name, card.name));
  }

  if (hasText(print)) {
    checks.push(compareScalar("print", print, card.print));
  }

  if (hasText(type)) {
    checks.push(compareScalar("type", type, card.type));
  }

  for (const keyword of visible.keywords.filter(hasText)) {
    checks.push(compareOfficialLines("keyword", keyword, card.abilities));
  }

  for (const cardLine of visible.cardLines.filter(hasText)) {
    checks.push(compareOfficialLines("card-line", cardLine, card.abilities));
  }

  return checks;
}

function compareScalar(
  field: Extract<DmOfficialTextCompareCheckField, "name" | "print" | "type">,
  visible: string,
  official: string | undefined
): DmOfficialTextCompareCheck {
  if (!official) {
    return {
      field,
      official,
      status: "fail",
      visible
    };
  }

  const mode = resolveMatchMode(visible, official, normalizeScalarExact);

  return {
    field,
    mode,
    official,
    status: mode ? "pass" : "fail",
    visible
  };
}

function compareOfficialLines(
  field: Extract<DmOfficialTextCompareCheckField, "card-line" | "keyword">,
  visible: string,
  officialLines: string[]
): DmOfficialTextCompareCheck {
  const exactVisible = normalizeLineExact(visible);

  for (const [index, line] of officialLines.entries()) {
    if (normalizeLineExact(line).includes(exactVisible)) {
      return {
        field,
        mode: "exact",
        official: line,
        official_line: index + 1,
        official_lines: officialLines.length,
        status: "pass",
        visible
      };
    }
  }

  const normalizedVisible = normalizeComparable(normalizeLineExact(visible));

  for (const [index, line] of officialLines.entries()) {
    if (
      normalizeComparable(normalizeLineExact(line)).includes(normalizedVisible)
    ) {
      return {
        field,
        mode: "normalized",
        official: line,
        official_line: index + 1,
        official_lines: officialLines.length,
        status: "pass",
        visible
      };
    }
  }

  return {
    field,
    official: officialLines.join(" / ") || undefined,
    official_lines: officialLines.length,
    status: "fail",
    visible
  };
}

function resolveMatchMode(
  visible: string,
  official: string,
  normalizeExact: (value: string) => string
): "exact" | "normalized" | undefined {
  const exactVisible = normalizeExact(visible);
  const exactOfficial = normalizeExact(official);

  if (exactVisible === exactOfficial) {
    return "exact";
  }

  if (
    normalizeComparable(exactVisible) === normalizeComparable(exactOfficial)
  ) {
    return "normalized";
  }

  return undefined;
}

function resolveChecksStatus(checks: DmOfficialTextCompareCheck[]) {
  if (checks.length === 0) {
    return "unchecked";
  }

  return checks.every((check) => check.status === "pass") ? "pass" : "fail";
}

function normalizeScalarExact(value: string) {
  return normalizeText(value);
}

function normalizeLineExact(value: string) {
  return normalizeText(value).replaceAll(/^[\s■□●○◆◇・★*]+/gu, "");
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFKC")
    .replaceAll(/[\u200B-\u200D\uFE0E\uFE0F]/gu, "");
}

function normalizeText(value: string) {
  return value.replaceAll(/\s+/gu, " ").trim();
}

function hasText(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
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
    card.rarity ? `rarity=${quoteForLine(card.rarity)}` : null,
    card.power ? `power=${card.power}` : null,
    card.race ? `race=${quoteForLine(card.race)}` : null
  ]
    .filter((value): value is string => value !== null)
    .join(" ");
}

function formatCheckLine(check: DmOfficialTextCompareCheck) {
  return [
    `CHECK ${check.status}`,
    check.field,
    check.mode ? `mode=${check.mode}` : null,
    `visible=${quoteForLine(check.visible)}`,
    check.official_line ? `official_line=${check.official_line}` : null,
    check.official_lines !== undefined
      ? `official_lines=${check.official_lines}`
      : null,
    check.official ? `official=${quoteForLine(check.official)}` : null
  ]
    .filter((value): value is string => value !== null)
    .join(" ");
}

function quoteForLine(value: string) {
  return JSON.stringify(value);
}

function hashTextLines(lines: string[]) {
  return createHash("sha256")
    .update(lines.join("\n"))
    .digest("hex")
    .slice(0, 12);
}
