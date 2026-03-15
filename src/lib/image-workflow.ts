import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseDocument } from "yaml";

import { parseFrontmatter } from "./content/parser/frontmatter.ts";
import {
  isValidMediaAssetPath,
  resolveMediaAssetAbsolutePath
} from "./media-assets.ts";

export const imageWorkflowDirectoryName = "workflow";
export const imageRequestsFileName = "image-requests.yaml";
export const imageAssetsFileName = "image-assets.yaml";

export interface ImageRequestRecord {
  id: string;
  lessonSlug: string;
  anchor: string;
  kind: string;
  altIt: string;
  captionIt?: string;
  avoid?: string;
  mustShow?: string;
  placementRationale?: string;
  priority?: "low" | "medium" | "high";
  sourcePreference?: string;
  searchHint?: string;
  captureInstructions?: string;
  notes?: string;
  visualGoal?: string;
}

export interface ImageAssetRecord {
  id: string;
  src: string;
  sourceType?: string;
  width?: number;
  height?: number;
  cardId?: string;
  lessonSlug?: string;
  anchor?: string;
  altIt?: string;
  captionIt?: string;
  notes?: string;
}

export interface MediaImageWorkflow {
  assetsFilePath: string;
  assets: ImageAssetRecord[];
  mediaDirectory: string;
  requestsFilePath: string;
  requests: ImageRequestRecord[];
}

export interface MediaImageWorkflowStatus {
  mediaSlug: string;
  requestsTotal: number;
  assetsTotal: number;
  pendingRequestIds: string[];
  readyToApplyIds: string[];
  appliedIds: string[];
  orphanedAssetIds: string[];
}

export interface ApplyImageBlocksResult {
  applied: Array<{ assetId: string; lessonFile: string }>;
  missingAsset: Array<{ assetId: string; src: string }>;
  missingAnchor: Array<{ assetId: string; anchor: string; lessonFile: string }>;
  missingLesson: Array<{ assetId: string; lessonSlug: string }>;
  orphanedAssets: string[];
  skippedExisting: Array<{ assetId: string; lessonFile: string }>;
}

export async function loadMediaImageWorkflow(
  mediaDirectory: string
): Promise<MediaImageWorkflow> {
  const workflowDirectory = path.join(mediaDirectory, imageWorkflowDirectoryName);
  const requestsFilePath = path.join(workflowDirectory, imageRequestsFileName);
  const assetsFilePath = path.join(workflowDirectory, imageAssetsFileName);
  const [requestsSource, assetsSource] = await Promise.all([
    readTextFileIfExists(requestsFilePath),
    readTextFileIfExists(assetsFilePath)
  ]);

  return {
    assets: assetsSource ? parseImageAssets(assetsSource, assetsFilePath) : [],
    assetsFilePath,
    mediaDirectory,
    requests: requestsSource
      ? parseImageRequests(requestsSource, requestsFilePath)
      : [],
    requestsFilePath
  };
}

export async function summarizeMediaImageWorkflow(
  mediaDirectory: string
): Promise<MediaImageWorkflowStatus> {
  const workflow = await loadMediaImageWorkflow(mediaDirectory);
  const mediaSlug = path.basename(mediaDirectory);
  const lessonFileBySlug = await buildLessonFileMap(mediaDirectory);
  const assetById = new Map(workflow.assets.map((asset) => [asset.id, asset]));
  const pendingRequestIds: string[] = [];
  const readyToApplyIds: string[] = [];
  const appliedIds: string[] = [];

  for (const request of workflow.requests) {
    const asset = assetById.get(request.id);

    if (!asset) {
      pendingRequestIds.push(request.id);
      continue;
    }

    const lessonFile = lessonFileBySlug.get(asset.lessonSlug ?? request.lessonSlug);

    if (!lessonFile) {
      readyToApplyIds.push(request.id);
      continue;
    }

    const lessonSource = await readFile(lessonFile, "utf8");

    if (lessonSource.includes(`src: ${asset.src}`)) {
      appliedIds.push(request.id);
    } else {
      readyToApplyIds.push(request.id);
    }
  }

  const requestIds = new Set(workflow.requests.map((request) => request.id));
  const orphanedAssetIds = workflow.assets
    .map((asset) => asset.id)
    .filter((assetId) => !requestIds.has(assetId));

  return {
    appliedIds,
    assetsTotal: workflow.assets.length,
    mediaSlug,
    orphanedAssetIds,
    pendingRequestIds,
    readyToApplyIds,
    requestsTotal: workflow.requests.length
  };
}

export async function applyMediaImageBlocks(
  mediaDirectory: string,
  dryRun = false
): Promise<ApplyImageBlocksResult> {
  const workflow = await loadMediaImageWorkflow(mediaDirectory);
  const lessonFileBySlug = await buildLessonFileMap(mediaDirectory);
  const requestById = new Map(workflow.requests.map((request) => [request.id, request]));
  const result: ApplyImageBlocksResult = {
    applied: [],
    missingAsset: [],
    missingAnchor: [],
    missingLesson: [],
    orphanedAssets: [],
    skippedExisting: []
  };

  for (const asset of workflow.assets) {
    const request = requestById.get(asset.id);

    if (!request) {
      result.orphanedAssets.push(asset.id);
      continue;
    }

    const lessonSlug = asset.lessonSlug ?? request.lessonSlug;
    const anchor = asset.anchor ?? request.anchor;
    const altIt = asset.altIt ?? request.altIt;
    const captionIt = asset.captionIt ?? request.captionIt;
    const lessonFile = lessonFileBySlug.get(lessonSlug);
    const resolvedAssetPath = resolveMediaAssetAbsolutePath(mediaDirectory, asset.src);

    if (!lessonFile) {
      result.missingLesson.push({
        assetId: asset.id,
        lessonSlug
      });
      continue;
    }

    if (!(await fileExists(resolvedAssetPath.absolutePath))) {
      result.missingAsset.push({
        assetId: asset.id,
        src: asset.src
      });
      continue;
    }

    const lessonSource = await readFile(lessonFile, "utf8");

    if (lessonSource.includes(`src: ${asset.src}`)) {
      result.skippedExisting.push({
        assetId: asset.id,
        lessonFile
      });
      continue;
    }

    const nextSource = insertImageBlockAfterAnchor(
      lessonSource,
      anchor,
      buildImageBlock({
        alt: altIt,
        caption: captionIt,
        cardId: asset.cardId,
        src: asset.src
      })
    );

    if (!nextSource) {
      result.missingAnchor.push({
        assetId: asset.id,
        anchor,
        lessonFile
      });
      continue;
    }

    if (!dryRun) {
      await writeFile(lessonFile, nextSource);
    }

    result.applied.push({
      assetId: asset.id,
      lessonFile
    });
  }

  return result;
}

export function buildImageBlock(input: {
  alt: string;
  caption?: string;
  cardId?: string;
  src: string;
}) {
  const lines = [
    ":::image",
    `src: ${input.src}`,
    `alt: ${JSON.stringify(input.alt)}`
  ];

  if (typeof input.cardId === "string" && input.cardId.trim().length > 0) {
    lines.push(`card_id: ${input.cardId}`);
  }

  if (typeof input.caption === "string" && input.caption.trim().length > 0) {
    lines.push("caption: >-");
    lines.push(...input.caption.split("\n").map((line) => `  ${line}`));
  }

  lines.push(":::");

  return lines.join("\n");
}

export function insertImageBlockAfterAnchor(
  lessonSource: string,
  anchor: string,
  imageBlock: string
) {
  const lines = lessonSource.split("\n");
  const normalizedAnchor = anchor.trim();
  const anchorIndex = lines.findIndex(
    (line) => line.trim() === normalizedAnchor
  );

  if (anchorIndex === -1) {
    return null;
  }

  let blankRegionEnd = anchorIndex + 1;

  while (blankRegionEnd < lines.length && lines[blankRegionEnd]?.trim() === "") {
    blankRegionEnd += 1;
  }

  const blockLines = ["", ...imageBlock.split("\n"), ""];
  lines.splice(anchorIndex + 1, blankRegionEnd - (anchorIndex + 1), ...blockLines);

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

async function buildLessonFileMap(mediaDirectory: string) {
  const textbookDirectory = path.join(mediaDirectory, "textbook");
  const lessonFiles = (await readdir(textbookDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(textbookDirectory, entry.name));
  const lessonFileBySlug = new Map<string, string>();

  for (const filePath of lessonFiles) {
    const source = await readFile(filePath, "utf8");
    const parsed = parseFrontmatter(source, filePath);
    const slug = parsed.data?.slug;

    if (typeof slug !== "string" || slug.trim().length === 0) {
      throw new Error(`Lesson file '${filePath}' is missing a valid frontmatter.slug.`);
    }

    lessonFileBySlug.set(slug, filePath);
  }

  return lessonFileBySlug;
}

function parseImageRequests(source: string, filePath: string) {
  const document = parseDocument(source, {
    prettyErrors: false
  });
  const root = document.toJSON();

  if (!isRecord(root) || !Array.isArray(root.requests)) {
    throw new Error(
      `Image requests file '${filePath}' must contain a top-level requests array.`
    );
  }

  return root.requests.map((value, index) =>
    normalizeImageRequestRecord(value, filePath, index)
  );
}

function parseImageAssets(source: string, filePath: string) {
  const document = parseDocument(source, {
    prettyErrors: false
  });
  const root = document.toJSON();

  if (!isRecord(root) || !Array.isArray(root.assets)) {
    throw new Error(
      `Image assets file '${filePath}' must contain a top-level assets array.`
    );
  }

  return root.assets.map((value, index) =>
    normalizeImageAssetRecord(value, filePath, index)
  );
}

function normalizeImageRequestRecord(
  value: unknown,
  filePath: string,
  index: number
): ImageRequestRecord {
  if (!isRecord(value)) {
    throw new Error(
      `Image request #${index + 1} in '${filePath}' must be a YAML object.`
    );
  }

  return {
    altIt: readRequiredString(value, "alt_it", filePath, index),
    anchor: readRequiredString(value, "anchor", filePath, index),
    avoid: readOptionalString(value, "avoid"),
    captionIt: readOptionalString(value, "caption_it"),
    captureInstructions: readOptionalString(value, "capture_instructions"),
    id: readRequiredString(value, "id", filePath, index),
    kind: readRequiredString(value, "kind", filePath, index),
    lessonSlug: readRequiredString(value, "lesson_slug", filePath, index),
    mustShow: readOptionalString(value, "must_show"),
    notes: readOptionalString(value, "notes"),
    placementRationale: readOptionalString(value, "placement_rationale"),
    priority: readOptionalPriority(value, "priority", filePath, index),
    searchHint: readOptionalString(value, "search_hint"),
    sourcePreference: readOptionalString(value, "source_preference"),
    visualGoal: readOptionalString(value, "visual_goal")
  };
}

function normalizeImageAssetRecord(
  value: unknown,
  filePath: string,
  index: number
): ImageAssetRecord {
  if (!isRecord(value)) {
    throw new Error(
      `Image asset #${index + 1} in '${filePath}' must be a YAML object.`
    );
  }

  const src = readRequiredString(value, "src", filePath, index);

  if (!src.startsWith("assets/") || !isValidMediaAssetPath(src)) {
    throw new Error(
      `Image asset #${index + 1} in '${filePath}' must use a valid assets/ relative path.`
    );
  }

  return {
    altIt: readOptionalString(value, "alt_it"),
    anchor: readOptionalString(value, "anchor"),
    cardId: readOptionalString(value, "card_id"),
    captionIt: readOptionalString(value, "caption_it"),
    height: readOptionalNumber(value, "height", filePath, index),
    id: readRequiredString(value, "id", filePath, index),
    lessonSlug: readOptionalString(value, "lesson_slug"),
    notes: readOptionalString(value, "notes"),
    sourceType: readOptionalString(value, "source_type"),
    src,
    width: readOptionalNumber(value, "width", filePath, index)
  };
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
  filePath: string,
  index: number
) {
  const field = value[key];

  if (typeof field !== "string" || field.trim().length === 0) {
    throw new Error(
      `Field '${key}' is required for record #${index + 1} in '${filePath}'.`
    );
  }

  return field.trim();
}

function readOptionalString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  return typeof field === "string" && field.trim().length > 0
    ? field.trim()
    : undefined;
}

function readOptionalNumber(
  value: Record<string, unknown>,
  key: string,
  filePath: string,
  index: number
) {
  const field = value[key];

  if (field === undefined || field === null || field === "") {
    return undefined;
  }

  if (typeof field !== "number" || !Number.isFinite(field)) {
    throw new Error(
      `Field '${key}' must be a number for record #${index + 1} in '${filePath}'.`
    );
  }

  return field;
}

function readOptionalPriority(
  value: Record<string, unknown>,
  key: string,
  filePath: string,
  index: number
) {
  const field = value[key];

  if (field === undefined || field === null || field === "") {
    return undefined;
  }

  if (field !== "low" && field !== "medium" && field !== "high") {
    throw new Error(
      `Field '${key}' must be one of low, medium, high for record #${index + 1} in '${filePath}'.`
    );
  }

  return field;
}

async function readTextFileIfExists(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function fileExists(filePath: string) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
