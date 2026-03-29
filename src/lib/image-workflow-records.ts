import { parseDocument } from "yaml";

import { isValidMediaAssetPath } from "./media-assets.ts";

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

export function parseImageRequests(source: string, filePath: string) {
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

export function parseImageAssets(source: string, filePath: string) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
