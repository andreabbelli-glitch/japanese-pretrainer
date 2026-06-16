import { createIssue } from "./parser/utils.ts";
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
  TermDefinitionBlock,
  ValidationIssue
} from "./types.ts";

type EditorialTextContext = {
  filePath: string;
  path: string;
  range?: SourceRange;
};

const internalAuthoringNoteMatchers: Array<{
  reason: string;
  pattern: RegExp;
}> = [
  {
    reason: "lesson-meta",
    pattern: /\bquesta\s+lesson\b/u
  },
  {
    reason: "review-workflow",
    pattern: /\b(?:mandare|mettere)\s+in\s+review\b/u
  },
  {
    reason: "review-workflow",
    pattern: /\bcosa\s+mandare\s+in\s+review\b/u
  },
  {
    reason: "batch-workflow",
    pattern: /\b(?:batch|workflow|per\s+questo\s+test|in\s+questo\s+seed|questo\s+seed|corpus\s+iniziale)\b/u
  },
  {
    reason: "curation-term",
    pattern: /\b(?:entry|card)\s+canonic[ae]\b/u
  },
  {
    reason: "curation-term",
    pattern: /\bentry\s+gia\s+presente\b/u
  },
  {
    reason: "duplicate-card-rationale",
    pattern: /\b(?:creare|aggiungere|produrre)\s+(?:una\s+)?(?:nuova\s+)?card\b/u
  },
  {
    reason: "duplicate-card-rationale",
    pattern: /\b(?:questa|la)\s+card\s+non\s+duplica\b/u
  },
  {
    reason: "duplicate-card-rationale",
    pattern: /\bnuova\s+card\b/u
  },
  {
    reason: "curation-rationale",
    pattern: /\bvalore\s+didattico\b/u
  },
  {
    reason: "curation-rationale",
    pattern: /\bpunto\s+nuovo\b/u
  },
  {
    reason: "curation-rationale",
    pattern: /\bqui\s+il\s+punto\s+e\b/u
  },
  {
    reason: "curation-rationale",
    pattern: /\bconviene\s+(?:fissare|mettere)\b/u
  },
  {
    reason: "external-audit-note",
    pattern: /\b(?:deepl|audit|reviewer|curation)\b/u
  }
];

export function validateLearnerFacingEditorialText(
  bundle: NormalizedMediaBundle,
  issues: ValidationIssue[]
) {
  if (bundle.media) {
    validateMediaDocument(bundle.media, issues);
  }

  for (const lesson of bundle.lessons) {
    validateLessonDocument(lesson, issues);
  }

  for (const cardsDocument of bundle.cardFiles) {
    validateCardsDocument(cardsDocument, issues);
  }
}

function validateMediaDocument(
  document: NormalizedMediaDocument,
  issues: ValidationIssue[]
) {
  reportInternalAuthoringNote(document.frontmatter.description, {
    filePath: document.sourceFile,
    path: "frontmatter.description"
  }, issues);
  reportInternalAuthoringNote(document.frontmatter.notes, {
    filePath: document.sourceFile,
    path: "frontmatter.notes"
  }, issues);
  validateMarkdownDocument(document.body, document.sourceFile, issues);
}

function validateLessonDocument(
  document: NormalizedLessonDocument,
  issues: ValidationIssue[]
) {
  reportInternalAuthoringNote(document.frontmatter.summary, {
    filePath: document.sourceFile,
    path: "frontmatter.summary"
  }, issues);
  validateMarkdownDocument(document.body, document.sourceFile, issues);
}

function validateCardsDocument(
  document: NormalizedCardsDocument,
  issues: ValidationIssue[]
) {
  validateMarkdownDocument(document.body, document.sourceFile, issues);
  validateSwappedLearnerNotes(document, issues);
}

type LearnerNoteOwner = {
  ownerType: "entry" | "card";
  id: string;
  label: string;
  note: RichTextFragment;
  context: EditorialTextContext;
};

function validateSwappedLearnerNotes(
  document: NormalizedCardsDocument,
  issues: ValidationIssue[]
) {
  const entryNotes: LearnerNoteOwner[] = [];
  const cardNotes: LearnerNoteOwner[] = [];

  for (const [index, block] of document.body.blocks.entries()) {
    const baseContext = {
      filePath: document.sourceFile,
      path: `body.blocks[${index}].notes_it`,
      range: block.position
    };

    switch (block.type) {
      case "termDefinition":
        if (block.entry.notesIt) {
          entryNotes.push({
            context: baseContext,
            id: block.entry.id,
            label: block.entry.lemma,
            note: block.entry.notesIt,
            ownerType: "entry"
          });
        }
        break;
      case "grammarDefinition":
        if (block.entry.notesIt) {
          entryNotes.push({
            context: baseContext,
            id: block.entry.id,
            label: block.entry.pattern,
            note: block.entry.notesIt,
            ownerType: "entry"
          });
        }
        break;
      case "cardDefinition":
        if (block.card.notesIt) {
          cardNotes.push({
            context: baseContext,
            id: block.card.id,
            label: inlineNodesToComparableText(block.card.front.nodes),
            note: block.card.notesIt,
            ownerType: "card"
          });
        }
        break;
      default:
        break;
    }
  }

  reportSwappedLearnerNotes(entryNotes, issues);
  reportSwappedLearnerNotes(cardNotes, issues);
}

function reportSwappedLearnerNotes(
  owners: LearnerNoteOwner[],
  issues: ValidationIssue[]
) {
  for (let leftIndex = 0; leftIndex < owners.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < owners.length;
      rightIndex += 1
    ) {
      const left = owners[leftIndex]!;
      const right = owners[rightIndex]!;

      if (!areLearnerNotesSwapped(left, right)) {
        continue;
      }

      reportSwappedLearnerNote(left, right, issues);
      reportSwappedLearnerNote(right, left, issues);
    }
  }
}

function areLearnerNotesSwapped(
  left: LearnerNoteOwner,
  right: LearnerNoteOwner
) {
  return (
    richTextStartsWithLabel(left.note, right.label) &&
    richTextStartsWithLabel(right.note, left.label) &&
    !richTextStartsWithLabel(left.note, left.label) &&
    !richTextStartsWithLabel(right.note, right.label)
  );
}

function reportSwappedLearnerNote(
  current: LearnerNoteOwner,
  matched: LearnerNoteOwner,
  issues: ValidationIssue[]
) {
  issues.push(
    createIssue({
      code: "editorial.swapped-notes",
      category: "schema",
      message:
        "Learner-facing notes appear to be swapped with another entry or card in the same cards document.",
      filePath: current.context.filePath,
      path: current.context.path,
      range: current.context.range,
      hint: "Move notes_it back under the matching entry/card, or rewrite the note so it starts from the current label.",
      details: {
        currentId: current.id,
        currentLabel: current.label,
        matchedId: matched.id,
        matchedLabel: matched.label,
        ownerType: current.ownerType
      }
    })
  );
}

function richTextStartsWithLabel(fragment: RichTextFragment, label: string) {
  const normalizedLabel = normalizeComparableJapaneseText(label);

  return (
    normalizedLabel.length >= 2 &&
    normalizeComparableJapaneseText(
      inlineNodesToComparableText(fragment.nodes)
    ).startsWith(normalizedLabel)
  );
}

function validateMarkdownDocument(
  document: MarkdownDocument,
  filePath: string,
  issues: ValidationIssue[]
) {
  for (const [index, block] of document.blocks.entries()) {
    validateContentBlock(block, {
      filePath,
      path: `body.blocks[${index}]`,
      range: block.position
    }, issues);
  }
}

function validateContentBlock(
  block: ContentBlock,
  context: EditorialTextContext,
  issues: ValidationIssue[]
) {
  switch (block.type) {
    case "paragraph":
    case "heading":
      reportInternalAuthoringNote(inlineNodesToText(block.children), context, issues);
      return;
    case "list":
      for (const [itemIndex, item] of block.items.entries()) {
        for (const [childIndex, child] of item.children.entries()) {
          validateContentBlock(child, {
            filePath: context.filePath,
            path: `${context.path}.items[${itemIndex}].children[${childIndex}]`,
            range: child.position ?? item.position ?? block.position
          }, issues);
        }
      }
      return;
    case "blockquote":
      for (const [childIndex, child] of block.children.entries()) {
        validateContentBlock(child, {
          filePath: context.filePath,
          path: `${context.path}.children[${childIndex}]`,
          range: child.position ?? block.position
        }, issues);
      }
      return;
    case "code":
      reportInternalAuthoringNote(block.value, context, issues);
      return;
    case "exampleSentence":
      reportInternalAuthoringNote(block.sentence.raw, {
        ...context,
        path: `${context.path}.jp`
      }, issues);
      reportInternalAuthoringNote(block.translationIt.raw, {
        ...context,
        path: `${context.path}.translation_it`
      }, issues);
      return;
    case "image":
      validateImageBlock(block, context, issues);
      return;
    case "termDefinition":
      validateTermBlock(block, context, issues);
      return;
    case "grammarDefinition":
      validateGrammarBlock(block, context, issues);
      return;
    case "cardDefinition":
      validateCardBlock(block, context, issues);
      return;
    case "thematicBreak":
      return;
  }
}

function validateImageBlock(
  block: ImageBlock,
  context: EditorialTextContext,
  issues: ValidationIssue[]
) {
  reportInternalAuthoringNote(block.alt, {
    ...context,
    path: `${context.path}.alt`
  }, issues);
  reportRichTextFragment(block.caption, {
    ...context,
    path: `${context.path}.caption`
  }, issues);
}

function validateTermBlock(
  block: TermDefinitionBlock,
  context: EditorialTextContext,
  issues: ValidationIssue[]
) {
  validateTerm(block.entry, context, issues);
}

function validateGrammarBlock(
  block: GrammarDefinitionBlock,
  context: EditorialTextContext,
  issues: ValidationIssue[]
) {
  validateGrammar(block.entry, context, issues);
}

function validateCardBlock(
  block: CardDefinitionBlock,
  context: EditorialTextContext,
  issues: ValidationIssue[]
) {
  validateCard(block.card, context, issues);
}

function validateTerm(
  term: NormalizedTerm,
  context: EditorialTextContext,
  issues: ValidationIssue[]
) {
  reportInternalAuthoringNote(term.meaningIt, {
    ...context,
    path: `${context.path}.meaning_it`
  }, issues);
  reportRichTextFragment(term.notesIt, {
    ...context,
    path: `${context.path}.notes_it`
  }, issues);
}

function validateGrammar(
  grammar: NormalizedGrammarPattern,
  context: EditorialTextContext,
  issues: ValidationIssue[]
) {
  reportInternalAuthoringNote(grammar.title, {
    ...context,
    path: `${context.path}.title`
  }, issues);
  reportInternalAuthoringNote(grammar.meaningIt, {
    ...context,
    path: `${context.path}.meaning_it`
  }, issues);
  reportRichTextFragment(grammar.notesIt, {
    ...context,
    path: `${context.path}.notes_it`
  }, issues);
}

function validateCard(
  card: NormalizedCard,
  context: EditorialTextContext,
  issues: ValidationIssue[]
) {
  reportRichTextFragment(card.front, {
    ...context,
    path: `${context.path}.front`
  }, issues);
  reportRichTextFragment(card.back, {
    ...context,
    path: `${context.path}.back`
  }, issues);
  reportRichTextFragment(card.exampleJp, {
    ...context,
    path: `${context.path}.example_jp`
  }, issues);
  reportRichTextFragment(card.exampleIt, {
    ...context,
    path: `${context.path}.example_it`
  }, issues);
  reportRichTextFragment(card.notesIt, {
    ...context,
    path: `${context.path}.notes_it`
  }, issues);
}

function reportRichTextFragment(
  fragment: RichTextFragment | undefined,
  context: EditorialTextContext,
  issues: ValidationIssue[]
) {
  reportInternalAuthoringNote(fragment?.raw, context, issues);
}

function reportInternalAuthoringNote(
  value: string | undefined,
  context: EditorialTextContext,
  issues: ValidationIssue[]
) {
  if (!value) {
    return;
  }

  const match = findInternalAuthoringNoteMatch(value);

  if (!match) {
    return;
  }

  issues.push(
    createIssue({
      code: "editorial.internal-authoring-note",
      category: "schema",
      message:
        "Learner-facing content contains internal authoring, curation, or review-workflow language.",
      filePath: context.filePath,
      path: context.path,
      range: context.range,
      hint:
        "Rewrite the field as direct learner-facing explanation of the Japanese form, meaning, context, and reading consequence.",
      details: {
        reason: match.reason,
        matcher: match.matcher
      }
    })
  );
}

function findInternalAuthoringNoteMatch(value: string) {
  const normalized = normalizeEditorialText(value);

  for (const matcher of internalAuthoringNoteMatchers) {
    if (matcher.pattern.test(normalized)) {
      return {
        matcher: matcher.pattern.source,
        reason: matcher.reason
      };
    }
  }

  return null;
}

function normalizeEditorialText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’`]/gu, "'")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("it");
}

function inlineNodesToText(nodes: InlineNode[]): string {
  return nodes.map(inlineNodeToText).join("");
}

function inlineNodesToComparableText(nodes: InlineNode[]): string {
  return nodes.map(inlineNodeToComparableText).join("");
}

function inlineNodeToComparableText(node: InlineNode): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "furigana":
      return node.base;
    case "reference":
    case "emphasis":
    case "strong":
    case "inlineCode":
    case "link":
      return inlineNodesToComparableText(node.children);
    case "break":
      return " ";
  }
}

function normalizeComparableJapaneseText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("it")
    .replace(/[\s\u3000]+/gu, "")
    .replace(
      /[「」『』【】\[\]（）()｛｝{}・,，、。.!！?？:：;；'"“”‘’`~〜～\-–—_]/gu,
      ""
    );
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
