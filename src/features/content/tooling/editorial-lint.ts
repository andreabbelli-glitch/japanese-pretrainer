import path from "node:path";

import type {
  CardDefinitionBlock,
  ContentBlock,
  GrammarDefinitionBlock,
  ImageBlock,
  InlineNode,
  MarkdownDocument,
  NormalizedCard,
  NormalizedCardsDocument,
  NormalizedGrammarPattern,
  NormalizedLessonDocument,
  NormalizedMediaBundle,
  NormalizedMediaDocument,
  NormalizedTerm,
  RichTextFragment,
  SourceRange,
  TermDefinitionBlock
} from "../types.ts";

export type EditorialLintSeverity = "P0" | "P1";

export type EditorialLintWarning = {
  code: string;
  column?: number;
  filePath: string;
  hint: string;
  line?: number;
  message: string;
  path: string;
  severity: EditorialLintSeverity;
  snippet: string;
  sourcePath: string;
};

export type EditorialLintResult = {
  counts: Record<EditorialLintSeverity, number> & { total: number };
  schema_version: 1;
  scope: {
    lessonSlugs: string[];
    mediaSlugs: string[];
    paths: string[];
  };
  truncated: boolean;
  warnings: EditorialLintWarning[];
};

type EditorialTextSpan = {
  filePath: string;
  lessonId?: string;
  lessonSlug?: string;
  mediaSlug: string;
  path: string;
  range?: SourceRange;
  text: string;
};

type EditorialLintRule = {
  code: string;
  hint: string;
  message: string;
  severity: EditorialLintSeverity;
  test: (span: EditorialTextSpan) => boolean;
};

export function lintEditorialContent(input: {
  bundles: NormalizedMediaBundle[];
  lessonSlugs?: string[];
  limit?: number;
  paths?: string[];
  repositoryRoot?: string;
}) {
  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const limit = Math.max(1, input.limit ?? 100);
  const lessonSlugs = new Set(input.lessonSlugs ?? []);
  const pathFilters = new Set(
    (input.paths ?? []).map((candidate) => path.resolve(candidate))
  );
  const lessonIdToSlug = buildLessonIdToSlug(input.bundles);
  const rawWarnings: EditorialLintWarning[] = [];

  for (const span of input.bundles.flatMap(collectBundleTextSpans)) {
    if (!matchesFilters({ lessonIdToSlug, lessonSlugs, pathFilters, span })) {
      continue;
    }

    const spanWarnings = lintTextSpan(span, repositoryRoot);
    rawWarnings.push(...spanWarnings);
  }

  const warnings = dedupeWarnings(rawWarnings).sort(compareWarnings);
  const limitedWarnings = warnings.slice(0, limit);
  const counts = countWarnings(warnings);

  return {
    counts,
    schema_version: 1,
    scope: {
      lessonSlugs: [...lessonSlugs].sort(),
      mediaSlugs: input.bundles.map((bundle) => bundle.mediaSlug).sort(),
      paths: [...pathFilters].sort()
    },
    truncated: limitedWarnings.length < warnings.length,
    warnings: limitedWarnings
  } satisfies EditorialLintResult;
}

export function formatEditorialLintResult(result: EditorialLintResult) {
  const lines = [
    `EDITORIAL_LINT warnings=${result.counts.total} P0=${result.counts.P0} P1=${result.counts.P1}`
  ];

  for (const warning of result.warnings) {
    lines.push(
      [
        "WARNING",
        warning.severity,
        warning.code,
        formatLocation(warning),
        `path=${warning.path}`,
        `message=${quoteForLine(warning.message)}`,
        `hint=${quoteForLine(warning.hint)}`,
        `snippet=${quoteForLine(warning.snippet)}`
      ].join(" ")
    );
  }

  if (result.truncated) {
    lines.push("NOTE warnings truncated; rerun with --limit for more.");
  }

  return `${lines.join("\n")}\n`;
}

function collectBundleTextSpans(bundle: NormalizedMediaBundle) {
  const spans: EditorialTextSpan[] = [];

  if (bundle.media) {
    collectMediaDocumentTextSpans(bundle.media, bundle.mediaSlug, spans);
  }

  for (const lesson of bundle.lessons) {
    collectLessonDocumentTextSpans(lesson, bundle.mediaSlug, spans);
  }

  for (const cardsDocument of bundle.cardFiles) {
    collectCardsDocumentTextSpans(cardsDocument, bundle.mediaSlug, spans);
  }

  return spans;
}

function collectMediaDocumentTextSpans(
  document: NormalizedMediaDocument,
  mediaSlug: string,
  spans: EditorialTextSpan[]
) {
  addPlainTextSpan(spans, document.frontmatter.description, {
    filePath: document.sourceFile,
    mediaSlug,
    path: "frontmatter.description"
  });
  addPlainTextSpan(spans, document.frontmatter.notes, {
    filePath: document.sourceFile,
    mediaSlug,
    path: "frontmatter.notes"
  });
  collectMarkdownDocumentTextSpans(
    document.body,
    {
      filePath: document.sourceFile,
      mediaSlug,
      path: "body"
    },
    spans
  );
}

function collectLessonDocumentTextSpans(
  document: NormalizedLessonDocument,
  mediaSlug: string,
  spans: EditorialTextSpan[]
) {
  const baseContext = {
    filePath: document.sourceFile,
    lessonId: document.frontmatter.id,
    lessonSlug: document.frontmatter.slug,
    mediaSlug
  };

  addPlainTextSpan(spans, document.frontmatter.title, {
    ...baseContext,
    path: "frontmatter.title"
  });
  addPlainTextSpan(spans, document.frontmatter.summary, {
    ...baseContext,
    path: "frontmatter.summary"
  });
  collectMarkdownDocumentTextSpans(
    document.body,
    {
      ...baseContext,
      path: "body"
    },
    spans
  );
}

function collectCardsDocumentTextSpans(
  document: NormalizedCardsDocument,
  mediaSlug: string,
  spans: EditorialTextSpan[]
) {
  const baseContext = {
    filePath: document.sourceFile,
    lessonSlug: document.frontmatter.slug,
    mediaSlug
  };

  addPlainTextSpan(spans, document.frontmatter.title, {
    ...baseContext,
    path: "frontmatter.title"
  });
  collectMarkdownDocumentTextSpans(
    document.body,
    {
      ...baseContext,
      path: "body"
    },
    spans
  );
}

function collectMarkdownDocumentTextSpans(
  document: MarkdownDocument,
  context: Omit<EditorialTextSpan, "text">,
  spans: EditorialTextSpan[]
) {
  for (const [index, block] of document.blocks.entries()) {
    collectContentBlockTextSpans(
      block,
      {
        ...context,
        path: `${context.path}.blocks[${index}]`,
        range: block.position
      },
      spans
    );
  }
}

function collectContentBlockTextSpans(
  block: ContentBlock,
  context: Omit<EditorialTextSpan, "text">,
  spans: EditorialTextSpan[]
) {
  switch (block.type) {
    case "paragraph":
    case "heading":
      addPlainTextSpan(spans, inlineNodesToText(block.children), context);
      return;
    case "list":
      for (const [itemIndex, item] of block.items.entries()) {
        for (const [childIndex, child] of item.children.entries()) {
          collectContentBlockTextSpans(
            child,
            {
              ...context,
              path: `${context.path}.items[${itemIndex}].children[${childIndex}]`,
              range: child.position ?? item.position ?? block.position
            },
            spans
          );
        }
      }
      return;
    case "blockquote":
      for (const [childIndex, child] of block.children.entries()) {
        collectContentBlockTextSpans(
          child,
          {
            ...context,
            path: `${context.path}.children[${childIndex}]`,
            range: child.position ?? block.position
          },
          spans
        );
      }
      return;
    case "exampleSentence":
      addPlainTextSpan(spans, block.sentence.raw, {
        ...context,
        path: `${context.path}.jp`
      });
      addPlainTextSpan(spans, block.translationIt.raw, {
        ...context,
        path: `${context.path}.translation_it`
      });
      return;
    case "image":
      collectImageBlockTextSpans(block, context, spans);
      return;
    case "termDefinition":
      collectTermBlockTextSpans(block, context, spans);
      return;
    case "grammarDefinition":
      collectGrammarBlockTextSpans(block, context, spans);
      return;
    case "cardDefinition":
      collectCardBlockTextSpans(block, context, spans);
      return;
    case "code":
    case "thematicBreak":
      return;
  }
}

function collectImageBlockTextSpans(
  block: ImageBlock,
  context: Omit<EditorialTextSpan, "text">,
  spans: EditorialTextSpan[]
) {
  addPlainTextSpan(spans, block.alt, {
    ...context,
    path: `${context.path}.alt`
  });
  addRichTextSpan(spans, block.caption, {
    ...context,
    path: `${context.path}.caption`
  });
}

function collectTermBlockTextSpans(
  block: TermDefinitionBlock,
  context: Omit<EditorialTextSpan, "text">,
  spans: EditorialTextSpan[]
) {
  collectTermTextSpans(block.entry, context, spans);
}

function collectGrammarBlockTextSpans(
  block: GrammarDefinitionBlock,
  context: Omit<EditorialTextSpan, "text">,
  spans: EditorialTextSpan[]
) {
  collectGrammarTextSpans(block.entry, context, spans);
}

function collectCardBlockTextSpans(
  block: CardDefinitionBlock,
  context: Omit<EditorialTextSpan, "text">,
  spans: EditorialTextSpan[]
) {
  collectCardTextSpans(block.card, context, spans);
}

function collectTermTextSpans(
  term: NormalizedTerm,
  context: Omit<EditorialTextSpan, "text">,
  spans: EditorialTextSpan[]
) {
  addPlainTextSpan(spans, term.meaningIt, {
    ...context,
    path: `${context.path}.term(${term.id}).meaning_it`
  });
  addRichTextSpan(spans, term.notesIt, {
    ...context,
    path: `${context.path}.term(${term.id}).notes_it`
  });
}

function collectGrammarTextSpans(
  grammar: NormalizedGrammarPattern,
  context: Omit<EditorialTextSpan, "text">,
  spans: EditorialTextSpan[]
) {
  addPlainTextSpan(spans, grammar.title, {
    ...context,
    path: `${context.path}.grammar(${grammar.id}).title`
  });
  addPlainTextSpan(spans, grammar.meaningIt, {
    ...context,
    path: `${context.path}.grammar(${grammar.id}).meaning_it`
  });
  addRichTextSpan(spans, grammar.notesIt, {
    ...context,
    path: `${context.path}.grammar(${grammar.id}).notes_it`
  });
}

function collectCardTextSpans(
  card: NormalizedCard,
  context: Omit<EditorialTextSpan, "text">,
  spans: EditorialTextSpan[]
) {
  const cardContext = {
    ...context,
    lessonId: card.lessonId
  };

  addRichTextSpan(spans, card.back, {
    ...cardContext,
    path: `${context.path}.card(${card.id}).back`
  });
  addRichTextSpan(spans, card.exampleJp, {
    ...cardContext,
    path: `${context.path}.card(${card.id}).example_jp`
  });
  addRichTextSpan(spans, card.exampleIt, {
    ...cardContext,
    path: `${context.path}.card(${card.id}).example_it`
  });
  addRichTextSpan(spans, card.notesIt, {
    ...cardContext,
    path: `${context.path}.card(${card.id}).notes_it`
  });
}

function addRichTextSpan(
  spans: EditorialTextSpan[],
  fragment: RichTextFragment | undefined,
  context: Omit<EditorialTextSpan, "text">
) {
  addPlainTextSpan(spans, fragment?.raw, context);
}

function addPlainTextSpan(
  spans: EditorialTextSpan[],
  text: string | undefined,
  context: Omit<EditorialTextSpan, "text">
) {
  const normalizedText = text?.trim();

  if (!normalizedText) {
    return;
  }

  spans.push({
    ...context,
    text: normalizedText
  });
}

const p0Rules: EditorialLintRule[] = [
  {
    code: "meta.lesson-object",
    hint: "Rewrite the sentence around the scene, screen, card, dialogue, or Japanese form instead of the lesson object.",
    message: "Learner-facing text talks about the lesson/page as courseware.",
    severity: "P0",
    test: (span) => {
      const normalized = normalizeTextForMatching(span.text);
      return lessonObjectPatterns.some((pattern) => pattern.test(normalized));
    }
  },
  {
    code: "meta.card-rationale",
    hint: "Remove curation rationale and explain the Japanese form, function, and reading consequence directly.",
    message:
      "Learner-facing text exposes card, entry, review, or curation rationale.",
    severity: "P0",
    test: (span) => {
      const normalized = normalizeTextForMatching(span.text);
      return cardRationalePatterns.some((pattern) => pattern.test(normalized));
    }
  },
  {
    code: "meta.editorial-process",
    hint: "Remove workflow/source-process language unless it is an actual word from the media being explained.",
    message: "Learner-facing text mentions editorial workflow or tooling.",
    severity: "P0",
    test: (span) => {
      const normalized = normalizeTextForMatching(span.text);
      return editorialProcessPattern.test(normalized);
    }
  },
  {
    code: "typography.degraded-accents",
    hint: "Use proper Italian accents in final content: e.g. e', puo', piu', gia', perche' must become è, può, più, già, perché.",
    message:
      "Learner-facing Italian uses ASCII apostrophes instead of accents.",
    severity: "P0",
    test: (span) => degradedAccentPattern.test(span.text)
  },
  {
    code: "card.example-meta-jp",
    hint: "Rewrite example_jp as a natural Japanese sentence that uses the target, not a sentence explaining the word or pattern.",
    message:
      "Card example_jp is metalinguistic instead of a live usage example.",
    severity: "P0",
    test: (span) =>
      span.path.endsWith(".example_jp") &&
      japaneseMetaExamplePattern.test(stripFuriganaMarkup(span.text))
  }
];

const p1Rules: EditorialLintRule[] = [
  {
    code: "style.stock-contrast",
    hint: "Keep the contrast only if it corrects a real likely misreading; otherwise rewrite as direct form -> meaning -> consequence.",
    message: "Text uses a stock 'not X but Y' contrast scaffold.",
    severity: "P1",
    test: (span) => {
      const normalized = normalizeTextForMatching(span.text);
      return stockContrastPatterns.some((pattern) => pattern.test(normalized));
    }
  },
  {
    code: "style.low-density-utility",
    hint: "Make the sentence concrete: include the Japanese form, value, grammar frame, target/timing/result, or reading consequence.",
    message:
      "Text says an item is useful or important without enough concrete reading information.",
    severity: "P1",
    test: (span) => {
      const normalized = normalizeTextForMatching(span.text);
      return (
        utilityPattern.test(normalized) && !hasConcreteReadingAnchor(span.text)
      );
    }
  },
  {
    code: "style.page-meta-ambiguous",
    hint: "If this means the lesson page, rewrite around the real source page, screen, article, or Japanese text; if it means a real web page, make that source context explicit.",
    message:
      "Text says 'questa pagina', which may be courseware metadiscourse.",
    severity: "P1",
    test: (span) =>
      /\bquesta\s+pagina\b/u.test(normalizeTextForMatching(span.text))
  },
  {
    code: "style.title-batch-label",
    hint: "Use a learner-facing title centered on the real reading context, not a batch/job label.",
    message: "Title looks like an internal batch or workflow label.",
    severity: "P1",
    test: (span) =>
      span.path.endsWith("frontmatter.title") &&
      batchTitlePattern.test(span.text)
  }
];

const lessonObjectPatterns = [
  /\b(?:in\s+questa\s+)?(?:lesson|lezione)\b/u,
  /\bqui\s+(?:vediamo|vedremo|analizziamo|spieghiamo|impariamo|impareremo)\b/u
];

const cardRationalePatterns = [
  /\b(?:creare|aggiungere|produrre)\s+(?:una\s+)?(?:nuova\s+)?(?:card|flashcard|entry)\b/u,
  /\b(?:entry|card)\s+(?:gia\s+presente|canonic[aoae])\b/u,
  /\b(?:merita|vale)\s+(?:una\s+)?(?:card|flashcard)\b/u,
  /\b(?:mandare|mettere)\s+in\s+review\b/u,
  /\bvalore\s+didattic[oa]\b/u
];

const editorialProcessPattern =
  /\b(?:batch|workflow|seed|audit|reviewer|curation|validazione|deepl)\b/u;

const degradedAccentPattern =
  /(?<![\p{L}'’`])(?:e|puo|piu|gia|perche|cioe|cosi|meta|poiche)'(?!\p{L})/iu;

const japaneseMetaExamplePattern =
  /(?:という(?:言葉|表現)|は[^。！？\n]{0,40}(?:の)?意味|に[^。！？\n]{0,40}がつくと|これは[^。！？\n]{1,40}です)/u;

const stockContrastPatterns = [
  /\bnon\s+(?:e|è)\s+(?:solo|soltanto|semplicemente\s+)?[^.!?;:]{1,80}?(?:\s+(?:ma|bensi)\s+|,\s*(?:e|è)\s+)[^.!?;:]{1,80}/u,
  /\bnot\s+(?:just|only|simply\s+)?[^.!?;:]{1,80}?\s+but\s+[^.!?;:]{1,80}/u,
  /\b(?:it\s+is|it's)\s+[^.!?;:]{1,80}?\s+not\s+[^.!?;:]{1,80}/u,
  /\bnon\s+(?:dice|chiede|usa|indica|significa)\s+(?:solo|semplicemente\s+)?[^.!?;:]{1,80}/u
];

const utilityPattern =
  /\b(?:utile|importante|da\s+fissare|aiuta\s+a|serve\s+a|orienta|segnala)\b/u;

const batchTitlePattern =
  /\b(?:pre-study|anki\s+l\d+|keyword\s+effects\s+bank|batch|seed|ad\s+hoc)\b/iu;

function lintTextSpan(
  span: EditorialTextSpan,
  repositoryRoot: string
): EditorialLintWarning[] {
  const p0Matches = p0Rules.filter((rule) => rule.test(span));
  const matchingRules =
    p0Matches.length > 0
      ? p0Matches
      : p1Rules.filter((rule) => rule.test(span));

  return matchingRules.map((rule) => ({
    code: rule.code,
    column: span.range?.start.column,
    filePath: span.filePath,
    hint: rule.hint,
    line: span.range?.start.line,
    message: rule.message,
    path: span.path,
    severity: rule.severity,
    snippet: summarizeSnippet(span.text),
    sourcePath: relativeSource(span.filePath, repositoryRoot)
  }));
}

function matchesFilters(input: {
  lessonIdToSlug: Map<string, string>;
  lessonSlugs: Set<string>;
  pathFilters: Set<string>;
  span: EditorialTextSpan;
}) {
  const { lessonIdToSlug, lessonSlugs, pathFilters, span } = input;

  if (pathFilters.size > 0 && !pathFilters.has(path.resolve(span.filePath))) {
    return false;
  }

  if (lessonSlugs.size === 0) {
    return true;
  }

  if (span.lessonSlug && lessonSlugs.has(span.lessonSlug)) {
    return true;
  }

  if (span.lessonId) {
    const lessonSlug = lessonIdToSlug.get(span.lessonId);
    return Boolean(lessonSlug && lessonSlugs.has(lessonSlug));
  }

  return false;
}

function buildLessonIdToSlug(bundles: NormalizedMediaBundle[]) {
  const lessonIdToSlug = new Map<string, string>();

  for (const bundle of bundles) {
    for (const lesson of bundle.lessons) {
      lessonIdToSlug.set(lesson.frontmatter.id, lesson.frontmatter.slug);
    }
  }

  return lessonIdToSlug;
}

function dedupeWarnings(warnings: EditorialLintWarning[]) {
  const seen = new Set<string>();
  const deduped: EditorialLintWarning[] = [];

  for (const warning of warnings) {
    const key = [
      warning.filePath,
      warning.line ?? 0,
      warning.column ?? 0,
      warning.path,
      warning.code,
      warning.snippet
    ].join(":");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(warning);
  }

  return deduped;
}

function countWarnings(warnings: EditorialLintWarning[]) {
  const counts = {
    P0: 0,
    P1: 0,
    total: warnings.length
  };

  for (const warning of warnings) {
    counts[warning.severity] += 1;
  }

  return counts;
}

function compareWarnings(
  left: EditorialLintWarning,
  right: EditorialLintWarning
) {
  const severityOrder =
    severityRank(left.severity) - severityRank(right.severity);

  if (severityOrder !== 0) {
    return severityOrder;
  }

  return (
    left.sourcePath.localeCompare(right.sourcePath) ||
    (left.line ?? 0) - (right.line ?? 0) ||
    left.code.localeCompare(right.code)
  );
}

function severityRank(severity: EditorialLintSeverity) {
  return severity === "P0" ? 0 : 1;
}

function hasConcreteReadingAnchor(value: string) {
  return (
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}～〜]/u.test(value) ||
    /\]\((?:term|grammar):[^)]+\)/u.test(value) ||
    /(?:を|が|に|で|へ|から|まで|なら|ので|として|によって|って|という|ている)/u.test(
      value
    ) ||
    /\b(?:timing|target|bersaglio|condizione|risultato|effetto|lettura|frase|forma)\b/iu.test(
      value
    )
  );
}

function normalizeTextForMatching(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’`]/gu, "'")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("it");
}

function stripFuriganaMarkup(value: string) {
  return value.replace(/\{\{([^|{}]+)\|[^{}]+\}\}/gu, "$1");
}

function summarizeSnippet(value: string) {
  const compact = value.replace(/\s+/gu, " ").trim();

  if (compact.length <= 120) {
    return compact;
  }

  return `${compact.slice(0, 117)}...`;
}

function formatLocation(warning: EditorialLintWarning) {
  const line = warning.line ? `:${warning.line}` : "";
  const column = warning.line && warning.column ? `:${warning.column}` : "";

  return `${warning.sourcePath}${line}${column}`;
}

function quoteForLine(value: string) {
  return JSON.stringify(value);
}

function relativeSource(filePath: string, repositoryRoot: string) {
  const relative = path
    .relative(repositoryRoot, filePath)
    .replaceAll("\\", "/");

  return relative.startsWith("..") ? filePath : relative;
}

function inlineNodesToText(nodes: InlineNode[]): string {
  return nodes.map(inlineNodeToText).join("");
}

function inlineNodeToText(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "furigana":
      return node.raw;
    case "reference":
      return node.raw;
    case "emphasis":
    case "strong":
    case "inlineCode":
    case "link":
      return inlineNodesToText(node.children);
    case "break":
      return "\n";
  }
}
