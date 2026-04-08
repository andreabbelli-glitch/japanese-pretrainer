import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseFrontmatter } from "./content/parser/frontmatter.ts";
import {
  type ImageAssetRecord,
  type ImageRequestRecord,
  parseImageAssets,
  parseImageRequests
} from "./image-workflow-records.ts";
import {
  resolveMediaAssetAbsolutePath
} from "./media-assets.ts";

export type {
  ImageAssetRecord,
  ImageRequestRecord
} from "./image-workflow-records.ts";

export const imageWorkflowDirectoryName = "workflow";
export const imageRequestsFileName = "image-requests.yaml";
export const imageAssetsFileName = "image-assets.yaml";

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
  src: string;
}) {
  const lines = [
    ":::image",
    `src: ${input.src}`,
    `alt: ${JSON.stringify(input.alt)}`
  ];

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
