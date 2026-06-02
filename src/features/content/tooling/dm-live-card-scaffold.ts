import path from "node:path";

import type { NormalizedMediaBundle } from "../types.ts";
import { assertValidTextbookScaffoldSource } from "./scaffold.ts";
import type { ContentScaffoldWriteResult } from "./scaffold.ts";
import {
  buildContentScaffoldPlan,
  renderTextbookScaffold,
  writeContentScaffold
} from "./scaffold.ts";
import { buildContentNextIdPlan } from "./next-id.ts";

export type DmLiveCardScaffoldInput = {
  assetExt?: DmLiveCardAssetExt;
  cardSlug: string;
  contentRoot: string;
  difficulty?: string;
  mediaBundle: NormalizedMediaBundle;
  officialId?: string;
  repositoryRoot?: string;
  summary?: string;
  tags?: string[];
  title: string;
  url?: string;
  write?: boolean;
};

export type DmLiveCardAssetExt = "jpg" | "png" | "webp";

export type DmLiveCardScaffoldResult = {
  asset: {
    action: "planned";
    path: string;
  };
  card_fetch_command?: string;
  commands: {
    editorial_lint: string;
    import: null;
    validate: string;
  };
  files: {
    cards: {
      action: "not-created";
      path: string;
      reason: string;
    };
    textbook: {
      action: "create";
      path: string;
    };
  };
  ground_truth: "user-input";
  next: ContentScaffoldWriteResult["next"];
  schema_version: 1;
  status: "created" | "ready";
  warnings: string[];
  write: boolean;
};

const dmMediaSlug = "duel-masters-dm25";
const dmSegmentRef = "live-duel-encounters";
const dmSlugPrefix = `${dmSegmentRef}-`;
const defaultTags = ["live-duel", "card"];
const safeSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const safeOfficialIdPattern = /^[A-Za-z0-9][A-Za-z0-9-]*$/u;

export function normalizeDmLiveCardSlug(cardSlug: string) {
  const withoutNumber = cardSlug.replace(/^\d+-/u, "");
  const baseSlug = withoutNumber.startsWith(dmSlugPrefix)
    ? withoutNumber.slice(dmSlugPrefix.length)
    : withoutNumber;

  if (baseSlug.startsWith(dmSlugPrefix)) {
    throw new Error(
      "--card-slug must not repeat the live-duel-encounters- prefix."
    );
  }

  if (!safeSlugPattern.test(baseSlug)) {
    throw new Error(
      "--card-slug must be a URL-safe slug, optionally prefixed with live-duel-encounters-."
    );
  }

  return {
    baseSlug,
    lessonSlug: `${dmSlugPrefix}${baseSlug}`
  };
}

export async function buildDmLiveCardScaffold(
  input: DmLiveCardScaffoldInput
): Promise<DmLiveCardScaffoldResult> {
  assertDmMedia(input.mediaBundle);
  assertSafeTags(input.tags ?? []);
  assertFetchHint(input);

  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const { baseSlug, lessonSlug } = normalizeDmLiveCardSlug(input.cardSlug);
  const nextIdPlan = buildContentNextIdPlan({
    contentRoot: input.contentRoot,
    mediaBundle: input.mediaBundle,
    repositoryRoot,
    segmentRef: dmSegmentRef,
    slug: lessonSlug
  });

  if (nextIdPlan.conflicts.length > 0) {
    throw new DmLiveCardScaffoldFailure(
      `dm:live-card-scaffold refused because the next-id plan has conflicts:\n${nextIdPlan.conflicts.join(
        "\n"
      )}`,
      2
    );
  }

  const blockingWarnings = nextIdPlan.warnings.filter((warning) =>
    warning.startsWith("order-collision:")
  );

  if (blockingWarnings.length > 0) {
    throw new DmLiveCardScaffoldFailure(
      `dm:live-card-scaffold refused because the next-id plan has blocking warnings:\n${blockingWarnings.join(
        "\n"
      )}`,
      2
    );
  }

  const tags = mergeTags(input.tags ?? []);
  const scaffoldPlan = buildContentScaffoldPlan({
    difficulty: input.difficulty,
    nextIdPlan,
    summary: input.summary,
    tags,
    title: input.title
  });
  const mediaId = input.mediaBundle.media?.frontmatter.id;

  if (!mediaId) {
    throw new DmLiveCardScaffoldFailure(
      `dm:live-card-scaffold failed: media '${dmMediaSlug}' is missing media.md id.`,
      2
    );
  }

  const textbookSource = renderTextbookScaffold({
    difficulty: input.difficulty,
    mediaId,
    nextIdPlan,
    summary: input.summary,
    tags,
    title: input.title
  });

  assertValidTextbookScaffoldSource(
    textbookSource,
    path.resolve(repositoryRoot, scaffoldPlan.files.textbook.path)
  );

  const scaffoldOutput = input.write
    ? await writeContentScaffold({
        plan: scaffoldPlan,
        repositoryRoot,
        textbookSource
      })
    : scaffoldPlan;

  return {
    asset: {
      action: "planned",
      path: buildAssetPath({
        assetExt: input.assetExt,
        baseSlug,
        mediaBundle: input.mediaBundle,
        repositoryRoot
      })
    },
    ...(input.officialId || input.url
      ? { card_fetch_command: buildCardFetchCommand(input) }
      : {}),
    commands: {
      editorial_lint: [
        "./scripts/with-node.sh",
        "pnpm",
        "content:editorial-lint",
        "--",
        "--content-root",
        nextIdPlan.content_root,
        "--media-slug",
        dmMediaSlug,
        "--lesson-slug",
        nextIdPlan.next.lesson_slug
      ].join(" "),
      import: null,
      validate: scaffoldOutput.commands.validate
    },
    files: scaffoldOutput.files,
    ground_truth: "user-input",
    next: scaffoldOutput.next,
    schema_version: 1,
    status: scaffoldOutput.status,
    warnings: [
      ...scaffoldOutput.warnings,
      "user screenshot/text remains ground truth",
      "cards and assets are not created by this helper"
    ],
    write: input.write ?? false
  };
}

export function formatDmLiveCardScaffoldResult(
  result: DmLiveCardScaffoldResult
) {
  const lines = [
    `DM_LIVE_CARD_SCAFFOLD ${result.status} write=${result.write}`,
    "GROUND_TRUTH user-input",
    `TEXTBOOK ${result.files.textbook.path}`,
    `CARDS ${result.files.cards.action} ${result.files.cards.path}`,
    `CARDS_REASON ${result.files.cards.reason}`,
    `ASSET ${result.asset.action} ${result.asset.path}`,
    `LESSON_ID ${result.next.lesson_id}`,
    `LESSON_SLUG ${result.next.lesson_slug}`,
    `ORDER ${result.next.order}`,
    `VALIDATE ${result.commands.validate}`,
    `EDITORIAL_LINT ${result.commands.editorial_lint}`,
    "IMPORT withheld; fill real lesson body/cards first, then run content:scope.",
    result.card_fetch_command
      ? `DM_CARD_FETCH ${result.card_fetch_command}`
      : null,
    ...result.warnings.map((warning) => `WARNING ${warning}`)
  ].filter((line): line is string => line !== null);

  return `${lines.join("\n")}\n`;
}

export class DmLiveCardScaffoldFailure extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

function assertDmMedia(mediaBundle: NormalizedMediaBundle) {
  if (mediaBundle.mediaSlug !== dmMediaSlug) {
    throw new DmLiveCardScaffoldFailure(
      `dm:live-card-scaffold only supports media '${dmMediaSlug}'.`,
      2
    );
  }
}

function assertSafeTags(tags: string[]) {
  for (const tag of tags) {
    if (!safeSlugPattern.test(tag)) {
      throw new Error("--tag values must be URL-safe lowercase slugs.");
    }
  }
}

function assertFetchHint(input: DmLiveCardScaffoldInput) {
  if (input.officialId && input.url) {
    throw new Error("--official-id cannot be combined with --url.");
  }

  if (input.officialId && !safeOfficialIdPattern.test(input.officialId)) {
    throw new Error(
      "--official-id must be a safe Duel Masters official card id."
    );
  }

  if (input.url && !isOfficialDetailUrl(input.url)) {
    throw new Error(
      "--url must point to https://dm.takaratomy.co.jp/card/detail/ with a safe id."
    );
  }
}

function mergeTags(tags: string[]) {
  return Array.from(new Set([...defaultTags, ...tags]));
}

function buildAssetPath(input: {
  assetExt?: DmLiveCardAssetExt;
  baseSlug: string;
  mediaBundle: NormalizedMediaBundle;
  repositoryRoot: string;
}) {
  return relativeSource(
    path.join(
      input.mediaBundle.mediaDirectory,
      "assets",
      "cards",
      "live-duel",
      `${input.baseSlug}.${input.assetExt ?? "<ext>"}`
    ),
    input.repositoryRoot
  );
}

function buildCardFetchCommand(input: DmLiveCardScaffoldInput) {
  const source = input.officialId
    ? ["--official-id", input.officialId]
    : ["--url", input.url!];

  return ["./scripts/with-node.sh", "pnpm", "dm:card-fetch", "--", ...source]
    .map(quoteShellToken)
    .join(" ");
}

function quoteShellToken(value: string) {
  if (/^[A-Za-z0-9_./:=-]+$/u.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isOfficialDetailUrl(value: string) {
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
      safeOfficialIdPattern.test(officialId)
    );
  } catch {
    return false;
  }
}

function relativeSource(filePath: string, repositoryRoot = process.cwd()) {
  const relative = path.relative(repositoryRoot, filePath);

  return (relative.length > 0 ? relative : filePath).replaceAll("\\", "/");
}
