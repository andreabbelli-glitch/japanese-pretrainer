import { relations } from "drizzle-orm";

import {
  contentImport,
  lesson,
  lessonContent,
  media,
  segment
} from "./content.ts";
import {
  crossMediaGroup,
  grammarAlias,
  grammarPattern,
  term,
  termAlias
} from "./glossary.ts";
import { lessonProgress } from "./progress.ts";
import {
  kanjiClashPairLog,
  kanjiClashPairState,
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundLog,
  kanjiClashManualContrastRoundState
} from "./kanji-clash.ts";
import {
  katakanaAttemptLog,
  katakanaConfusionEdge,
  katakanaExerciseBlock,
  katakanaExerciseResult,
  katakanaItemState,
  katakanaSession,
  katakanaTrial
} from "./katakana-speed.ts";
import {
  card,
  cardEntryLink,
  reviewSubjectLog,
  reviewSubjectState
} from "./review.ts";

export const mediaRelations = relations(media, ({ many }) => ({
  segments: many(segment),
  lessons: many(lesson),
  terms: many(term),
  grammarPatterns: many(grammarPattern),
  cards: many(card)
}));

export const segmentRelations = relations(segment, ({ many, one }) => ({
  media: one(media, {
    fields: [segment.mediaId],
    references: [media.id]
  }),
  lessons: many(lesson),
  terms: many(term),
  grammarPatterns: many(grammarPattern),
  cards: many(card)
}));

export const lessonRelations = relations(lesson, ({ many, one }) => ({
  media: one(media, {
    fields: [lesson.mediaId],
    references: [media.id]
  }),
  cards: many(card),
  segment: one(segment, {
    fields: [lesson.segmentId],
    references: [segment.id]
  }),
  content: one(lessonContent, {
    fields: [lesson.id],
    references: [lessonContent.lessonId]
  }),
  progress: one(lessonProgress, {
    fields: [lesson.id],
    references: [lessonProgress.lessonId]
  })
}));

export const lessonContentRelations = relations(lessonContent, ({ one }) => ({
  lesson: one(lesson, {
    fields: [lessonContent.lessonId],
    references: [lesson.id]
  }),
  lastImport: one(contentImport, {
    fields: [lessonContent.lastImportId],
    references: [contentImport.id]
  })
}));

export const contentImportRelations = relations(contentImport, ({ many }) => ({
  lessonContents: many(lessonContent)
}));

export const termRelations = relations(term, ({ many, one }) => ({
  crossMediaGroup: one(crossMediaGroup, {
    fields: [term.crossMediaGroupId],
    references: [crossMediaGroup.id]
  }),
  media: one(media, {
    fields: [term.mediaId],
    references: [media.id]
  }),
  segment: one(segment, {
    fields: [term.segmentId],
    references: [segment.id]
  }),
  aliases: many(termAlias)
}));

export const termAliasRelations = relations(termAlias, ({ one }) => ({
  term: one(term, {
    fields: [termAlias.termId],
    references: [term.id]
  })
}));

export const grammarPatternRelations = relations(
  grammarPattern,
  ({ many, one }) => ({
    crossMediaGroup: one(crossMediaGroup, {
      fields: [grammarPattern.crossMediaGroupId],
      references: [crossMediaGroup.id]
    }),
    media: one(media, {
      fields: [grammarPattern.mediaId],
      references: [media.id]
    }),
    segment: one(segment, {
      fields: [grammarPattern.segmentId],
      references: [segment.id]
    }),
    aliases: many(grammarAlias)
  })
);

export const crossMediaGroupRelations = relations(
  crossMediaGroup,
  ({ many }) => ({
    grammarPatterns: many(grammarPattern),
    terms: many(term)
  })
);

export const grammarAliasRelations = relations(grammarAlias, ({ one }) => ({
  grammarPattern: one(grammarPattern, {
    fields: [grammarAlias.grammarId],
    references: [grammarPattern.id]
  })
}));

export const cardRelations = relations(card, ({ many, one }) => ({
  media: one(media, {
    fields: [card.mediaId],
    references: [media.id]
  }),
  lesson: one(lesson, {
    fields: [card.lessonId],
    references: [lesson.id]
  }),
  segment: one(segment, {
    fields: [card.segmentId],
    references: [segment.id]
  }),
  entryLinks: many(cardEntryLink)
}));

export const cardEntryLinkRelations = relations(cardEntryLink, ({ one }) => ({
  card: one(card, {
    fields: [cardEntryLink.cardId],
    references: [card.id]
  })
}));

export const reviewSubjectStateRelations = relations(
  reviewSubjectState,
  ({ many, one }) => ({
    lastCard: one(card, {
      fields: [reviewSubjectState.cardId],
      references: [card.id]
    }),
    logs: many(reviewSubjectLog)
  })
);

export const reviewSubjectLogRelations = relations(
  reviewSubjectLog,
  ({ one }) => ({
    card: one(card, {
      fields: [reviewSubjectLog.cardId],
      references: [card.id]
    }),
    subjectState: one(reviewSubjectState, {
      fields: [reviewSubjectLog.subjectKey],
      references: [reviewSubjectState.subjectKey]
    })
  })
);

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  lesson: one(lesson, {
    fields: [lessonProgress.lessonId],
    references: [lesson.id]
  })
}));

export const kanjiClashPairStateRelations = relations(
  kanjiClashPairState,
  ({ many }) => ({
    logs: many(kanjiClashPairLog)
  })
);

export const kanjiClashPairLogRelations = relations(
  kanjiClashPairLog,
  ({ one }) => ({
    pairState: one(kanjiClashPairState, {
      fields: [kanjiClashPairLog.pairKey],
      references: [kanjiClashPairState.pairKey]
    })
  })
);

export const kanjiClashManualContrastRelations = relations(
  kanjiClashManualContrast,
  ({ many }) => ({
    roundStates: many(kanjiClashManualContrastRoundState)
  })
);

export const kanjiClashManualContrastRoundStateRelations = relations(
  kanjiClashManualContrastRoundState,
  ({ many, one }) => ({
    manualContrast: one(kanjiClashManualContrast, {
      fields: [kanjiClashManualContrastRoundState.contrastKey],
      references: [kanjiClashManualContrast.contrastKey]
    }),
    logs: many(kanjiClashManualContrastRoundLog)
  })
);

export const kanjiClashManualContrastRoundLogRelations = relations(
  kanjiClashManualContrastRoundLog,
  ({ one }) => ({
    manualContrast: one(kanjiClashManualContrast, {
      fields: [kanjiClashManualContrastRoundLog.contrastKey],
      references: [kanjiClashManualContrast.contrastKey]
    }),
    roundState: one(kanjiClashManualContrastRoundState, {
      fields: [kanjiClashManualContrastRoundLog.roundKey],
      references: [kanjiClashManualContrastRoundState.roundKey]
    })
  })
);

export const katakanaItemStateRelations = relations(
  katakanaItemState,
  ({ many }) => ({
    attempts: many(katakanaAttemptLog),
    trials: many(katakanaTrial)
  })
);

export const katakanaSessionRelations = relations(
  katakanaSession,
  ({ many }) => ({
    attempts: many(katakanaAttemptLog),
    blocks: many(katakanaExerciseBlock),
    confusionEdges: many(katakanaConfusionEdge),
    exerciseResults: many(katakanaExerciseResult),
    trials: many(katakanaTrial)
  })
);

export const katakanaExerciseBlockRelations = relations(
  katakanaExerciseBlock,
  ({ many, one }) => ({
    attempts: many(katakanaAttemptLog),
    confusionEdges: many(katakanaConfusionEdge),
    results: many(katakanaExerciseResult),
    session: one(katakanaSession, {
      fields: [katakanaExerciseBlock.sessionId],
      references: [katakanaSession.id]
    }),
    trials: many(katakanaTrial)
  })
);

export const katakanaTrialRelations = relations(
  katakanaTrial,
  ({ many, one }) => ({
    block: one(katakanaExerciseBlock, {
      fields: [katakanaTrial.blockId],
      references: [katakanaExerciseBlock.blockId]
    }),
    itemState: one(katakanaItemState, {
      fields: [katakanaTrial.itemId],
      references: [katakanaItemState.itemId]
    }),
    results: many(katakanaExerciseResult),
    session: one(katakanaSession, {
      fields: [katakanaTrial.sessionId],
      references: [katakanaSession.id]
    })
  })
);

export const katakanaAttemptLogRelations = relations(
  katakanaAttemptLog,
  ({ one }) => ({
    block: one(katakanaExerciseBlock, {
      fields: [katakanaAttemptLog.blockId],
      references: [katakanaExerciseBlock.blockId]
    }),
    itemState: one(katakanaItemState, {
      fields: [katakanaAttemptLog.itemId],
      references: [katakanaItemState.itemId]
    }),
    session: one(katakanaSession, {
      fields: [katakanaAttemptLog.sessionId],
      references: [katakanaSession.id]
    }),
    trial: one(katakanaTrial, {
      fields: [katakanaAttemptLog.trialId],
      references: [katakanaTrial.trialId]
    })
  })
);

export const katakanaExerciseResultRelations = relations(
  katakanaExerciseResult,
  ({ one }) => ({
    block: one(katakanaExerciseBlock, {
      fields: [katakanaExerciseResult.blockId],
      references: [katakanaExerciseBlock.blockId]
    }),
    session: one(katakanaSession, {
      fields: [katakanaExerciseResult.sessionId],
      references: [katakanaSession.id]
    }),
    trial: one(katakanaTrial, {
      fields: [katakanaExerciseResult.trialId],
      references: [katakanaTrial.trialId]
    })
  })
);

export const katakanaConfusionEdgeRelations = relations(
  katakanaConfusionEdge,
  ({ one }) => ({
    block: one(katakanaExerciseBlock, {
      fields: [katakanaConfusionEdge.blockId],
      references: [katakanaExerciseBlock.blockId]
    }),
    session: one(katakanaSession, {
      fields: [katakanaConfusionEdge.sessionId],
      references: [katakanaSession.id]
    })
  })
);
