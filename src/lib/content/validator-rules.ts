import { createIssue } from "./parser/utils.ts";
import type {
  ContentBlock,
  NormalizedMediaBundle,
  SourceRange,
  ValidationIssue
} from "./types.ts";
import type { RawStructuredBlock } from "./parser/internal.ts";

type ParsedDocumentStateLite = {
  draft: {
    sourceFile: string;
  };
  rawId?: string;
  structuredBlocks: RawStructuredBlock[];
};

type CardRecordLike = {
  position?: SourceRange;
  sourcePath: string;
  value: {
    entryId: string;
    entryType: "grammar" | "term";
    id: string;
    source: {
      filePath: string;
    };
  };
};

type GrammarRecordLike = {
  value: {
    id: string;
  };
};

type TermRecordLike = {
  value: {
    id: string;
  };
};

export function validateDuplicateIds(
  input: {
    cardFiles: ParsedDocumentStateLite[];
    lessons: ParsedDocumentStateLite[];
    media: ParsedDocumentStateLite[];
  },
  issues: ValidationIssue[]
) {
  const registry = new Map<
    string,
    Array<{ filePath: string; path: string; range?: SourceRange }>
  >();

  const register = (
    namespace: string,
    id: string | undefined,
    filePath: string,
    idPath: string,
    range?: SourceRange
  ) => {
    if (!id) {
      return;
    }

    const key = `${namespace}:${id}`;
    const occurrences = registry.get(key) ?? [];
    occurrences.push({ filePath, path: idPath, range });
    registry.set(key, occurrences);
  };

  for (const state of input.media) {
    register("media", state.rawId, state.draft.sourceFile, "frontmatter.id");
  }

  for (const state of input.lessons) {
    register("lesson", state.rawId, state.draft.sourceFile, "frontmatter.id");

    for (const block of state.structuredBlocks) {
      if (block.blockType === "term") {
        register(
          "term",
          asString(block.data?.id),
          state.draft.sourceFile,
          `structuredBlocks[${block.index}].id`,
          block.position
        );
      }

      if (block.blockType === "grammar") {
        register(
          "grammar",
          asString(block.data?.id),
          state.draft.sourceFile,
          `structuredBlocks[${block.index}].id`,
          block.position
        );
      }
    }
  }

  for (const state of input.cardFiles) {
    register(
      "cards-file",
      state.rawId,
      state.draft.sourceFile,
      "frontmatter.id"
    );

    for (const block of state.structuredBlocks) {
      if (block.blockType === "term") {
        register(
          "term",
          asString(block.data?.id),
          state.draft.sourceFile,
          `structuredBlocks[${block.index}].id`,
          block.position
        );
      }

      if (block.blockType === "grammar") {
        register(
          "grammar",
          asString(block.data?.id),
          state.draft.sourceFile,
          `structuredBlocks[${block.index}].id`,
          block.position
        );
      }

      if (block.blockType === "card") {
        register(
          "card",
          asString(block.data?.id),
          state.draft.sourceFile,
          `structuredBlocks[${block.index}].id`,
          block.position
        );
      }
    }
  }

  for (const [key, occurrences] of registry.entries()) {
    if (occurrences.length < 2) {
      continue;
    }

    const [namespace, id] = key.split(":");
    const first = occurrences[0];

    issues.push(
      createIssue({
        code: "id.duplicate",
        category: "integrity",
        message: `Duplicate ${namespace} id '${id}' found in content files.`,
        filePath: first?.filePath ?? "",
        path: first?.path,
        range: first?.range,
        hint: "Keep IDs unique within their content namespace.",
        details: {
          namespace,
          id,
          count: occurrences.length
        }
      })
    );
  }
}

export function validateWorkspaceDuplicateIds(
  bundles: NormalizedMediaBundle[],
  issues: ValidationIssue[]
) {
  const registry = new Map<
    string,
    Array<{
      mediaDirectory: string;
      filePath: string;
      path: string;
      range?: SourceRange;
    }>
  >();

  const register = (
    mediaDirectory: string,
    namespace: string,
    id: string | undefined,
    filePath: string,
    idPath: string,
    range?: SourceRange
  ) => {
    if (!id) {
      return;
    }

    const key = `${namespace}:${id}`;
    const occurrences = registry.get(key) ?? [];
    occurrences.push({
      mediaDirectory,
      filePath,
      path: idPath,
      range
    });
    registry.set(key, occurrences);
  };

  for (const bundle of bundles) {
    if (bundle.media) {
      register(
        bundle.mediaDirectory,
        "media",
        bundle.media.frontmatter.id,
        bundle.media.sourceFile,
        "frontmatter.id"
      );
    }

    for (const lesson of bundle.lessons) {
      register(
        bundle.mediaDirectory,
        "lesson",
        lesson.frontmatter.id,
        lesson.sourceFile,
        "frontmatter.id"
      );
      registerDefinitionIds(
        bundle.mediaDirectory,
        lesson.sourceFile,
        lesson.body.blocks,
        registry
      );
    }

    for (const cardsFile of bundle.cardFiles) {
      register(
        bundle.mediaDirectory,
        "cards-file",
        cardsFile.frontmatter.id,
        cardsFile.sourceFile,
        "frontmatter.id"
      );
      registerDefinitionIds(
        bundle.mediaDirectory,
        cardsFile.sourceFile,
        cardsFile.body.blocks,
        registry
      );
    }
  }

  for (const [key, occurrences] of registry.entries()) {
    if (occurrences.length < 2) {
      continue;
    }

    const mediaDirectories = new Set(
      occurrences.map((occurrence) => occurrence.mediaDirectory)
    );

    if (mediaDirectories.size < 2) {
      continue;
    }

    const separatorIndex = key.indexOf(":");
    const namespace = key.slice(0, separatorIndex);
    const id = key.slice(separatorIndex + 1);

    if (namespace === "term" || namespace === "grammar") {
      continue;
    }

    const first = occurrences[0];

    issues.push(
      createIssue({
        code: "id.duplicate",
        category: "integrity",
        message: `Duplicate ${namespace} id '${id}' found across media bundles.`,
        filePath: first?.filePath ?? "",
        path: first?.path,
        range: first?.range,
        hint: "Keep IDs unique across the entire content workspace.",
        details: {
          namespace,
          id,
          count: occurrences.length,
          mediaBundleCount: mediaDirectories.size
        }
      })
    );
  }

  validateCrossMediaGroupUsage(bundles, issues);
}

export function validateCrossMediaGroupUsage(
  bundles: NormalizedMediaBundle[],
  issues: ValidationIssue[]
) {
  const registry = new Map<
    string,
    Array<{
      entryId: string;
      filePath: string;
      mediaId: string | undefined;
      mediaSlug: string;
      path: string;
      range?: SourceRange;
    }>
  >();

  const register = (input: {
    entryId: string;
    entryType: "term" | "grammar";
    filePath: string;
    groupKey?: string;
    mediaId: string | undefined;
    mediaSlug: string;
    path: string;
    range?: SourceRange;
  }) => {
    if (!input.groupKey) {
      return;
    }

    const key = `${input.entryType}:${input.groupKey}`;
    const occurrences = registry.get(key) ?? [];
    occurrences.push({
      entryId: input.entryId,
      filePath: input.filePath,
      mediaId: input.mediaId,
      mediaSlug: input.mediaSlug,
      path: input.path,
      range: input.range
    });
    registry.set(key, occurrences);
  };

  for (const bundle of bundles) {
    const mediaId = bundle.media?.frontmatter.id;

    for (const lesson of bundle.lessons) {
      for (const [index, block] of lesson.body.blocks.entries()) {
        if (block.type === "termDefinition") {
          register({
            entryId: block.entry.id,
            entryType: "term",
            filePath: lesson.sourceFile,
            groupKey: block.entry.crossMediaGroup,
            mediaId,
            mediaSlug: bundle.mediaSlug,
            path: `body.blocks[${index}].entry.cross_media_group`,
            range: block.position
          });
        }

        if (block.type === "grammarDefinition") {
          register({
            entryId: block.entry.id,
            entryType: "grammar",
            filePath: lesson.sourceFile,
            groupKey: block.entry.crossMediaGroup,
            mediaId,
            mediaSlug: bundle.mediaSlug,
            path: `body.blocks[${index}].entry.cross_media_group`,
            range: block.position
          });
        }
      }
    }

    for (const cardsFile of bundle.cardFiles) {
      for (const [index, block] of cardsFile.body.blocks.entries()) {
        if (block.type === "termDefinition") {
          register({
            entryId: block.entry.id,
            entryType: "term",
            filePath: cardsFile.sourceFile,
            groupKey: block.entry.crossMediaGroup,
            mediaId,
            mediaSlug: bundle.mediaSlug,
            path: `body.blocks[${index}].entry.cross_media_group`,
            range: block.position
          });
        }

        if (block.type === "grammarDefinition") {
          register({
            entryId: block.entry.id,
            entryType: "grammar",
            filePath: cardsFile.sourceFile,
            groupKey: block.entry.crossMediaGroup,
            mediaId,
            mediaSlug: bundle.mediaSlug,
            path: `body.blocks[${index}].entry.cross_media_group`,
            range: block.position
          });
        }
      }
    }
  }

  const groupKeyTypes = new Map<string, Set<"term" | "grammar">>();

  for (const key of registry.keys()) {
    const separatorIndex = key.indexOf(":");
    const entryType = key.slice(0, separatorIndex) as "term" | "grammar";
    const groupKey = key.slice(separatorIndex + 1);
    const types = groupKeyTypes.get(groupKey) ?? new Set<"term" | "grammar">();

    types.add(entryType);
    groupKeyTypes.set(groupKey, types);
  }

  for (const [groupKey, entryTypes] of groupKeyTypes.entries()) {
    if (entryTypes.size < 2) {
      continue;
    }

    const firstType = [...entryTypes][0];
    const firstOccurrence = registry.get(`${firstType}:${groupKey}`)?.[0];

    issues.push(
      createIssue({
        code: "cross-media-group.entry-type-mismatch",
        category: "integrity",
        message: `Cross-media group '${groupKey}' cannot mix term and grammar entries.`,
        filePath: firstOccurrence?.filePath ?? "",
        path: firstOccurrence?.path,
        range: firstOccurrence?.range,
        hint: "Reuse the same cross_media_group only for the same entry kind across different media."
      })
    );
  }

  for (const [key, occurrences] of registry.entries()) {
    const [entryType, groupKey] = key.split(":");
    const mediaKeys = new Map<string, (typeof occurrences)[number][]>();

    for (const occurrence of occurrences) {
      const mediaKey = occurrence.mediaId ?? occurrence.mediaSlug;
      const rows = mediaKeys.get(mediaKey) ?? [];
      rows.push(occurrence);
      mediaKeys.set(mediaKey, rows);
    }

    for (const mediaOccurrences of mediaKeys.values()) {
      if (mediaOccurrences.length < 2) {
        continue;
      }

      const first = mediaOccurrences[0];

      issues.push(
        createIssue({
          code: "cross-media-group.duplicate-media-entry",
          category: "integrity",
          message: `Cross-media group '${groupKey}' has multiple ${entryType} entries in the same media.`,
          filePath: first?.filePath ?? "",
          path: first?.path,
          range: first?.range,
          hint: "Keep at most one local entry per media inside the same cross-media group."
        })
      );
    }
  }
}

export function validateReferences(
  terms: TermRecordLike[],
  grammarPatterns: GrammarRecordLike[],
  cards: CardRecordLike[],
  references: Array<{
    location?: SourceRange;
    referenceType: "grammar" | "term";
    sourceFile: string;
    sourcePath: string;
    targetId: string;
  }>,
  issues: ValidationIssue[]
) {
  const termIds = new Set(terms.map((record) => record.value.id));
  const grammarIds = new Set(grammarPatterns.map((record) => record.value.id));

  for (const reference of references) {
    const exists =
      reference.referenceType === "term"
        ? termIds.has(reference.targetId)
        : grammarIds.has(reference.targetId);

    if (!exists) {
      issues.push(
        createIssue({
          code: "reference.missing-target",
          category: "reference",
          message: `Reference target '${reference.referenceType}:${reference.targetId}' does not exist.`,
          filePath: reference.sourceFile,
          path: reference.sourcePath,
          range: reference.location,
          hint: "Declare the target entry with a matching :::term or :::grammar block."
        })
      );
    }
  }

  for (const card of cards) {
    const exists =
      card.value.entryType === "term"
        ? termIds.has(card.value.entryId)
        : grammarIds.has(card.value.entryId);

    if (!exists) {
      issues.push(
        createIssue({
          code: "card.missing-entry",
          category: "reference",
          message: `Card '${card.value.id}' points to missing entry '${card.value.entryType}:${card.value.entryId}'.`,
          filePath: card.value.source.filePath,
          path: `${card.sourcePath}.entry_id`,
          range: card.position,
          hint: "Create the referenced entry or point the card to an existing term/grammar ID."
        })
      );
    }
  }
}

function registerDefinitionIds(
  mediaDirectory: string,
  sourceFile: string,
  blocks: ContentBlock[],
  registry: Map<
    string,
    Array<{
      mediaDirectory: string;
      filePath: string;
      path: string;
      range?: SourceRange;
    }>
  >
) {
  for (const [index, block] of blocks.entries()) {
    let namespace: string | null = null;
    let id: string | undefined;
    let idPath: string | undefined;

    if (block.type === "termDefinition") {
      namespace = "term";
      id = block.entry.id;
      idPath = `body.blocks[${index}].entry.id`;
    } else if (block.type === "grammarDefinition") {
      namespace = "grammar";
      id = block.entry.id;
      idPath = `body.blocks[${index}].entry.id`;
    } else if (block.type === "cardDefinition") {
      namespace = "card";
      id = block.card.id;
      idPath = `body.blocks[${index}].card.id`;
    }

    if (!namespace || !id || !idPath) {
      continue;
    }

    const key = `${namespace}:${id}`;
    const occurrences = registry.get(key) ?? [];
    occurrences.push({
      mediaDirectory,
      filePath: sourceFile,
      path: idPath,
      range: block.position
    });
    registry.set(key, occurrences);
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}
