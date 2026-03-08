import { relations } from "drizzle-orm";

import {
  contentImport,
  lesson,
  lessonContent,
  media,
  segment
} from "./content.ts";
import { grammarAlias, grammarPattern, term, termAlias } from "./glossary.ts";
import { lessonProgress, mediaProgress } from "./progress.ts";
import { card, cardEntryLink, reviewLog, reviewState } from "./review.ts";

export const mediaRelations = relations(media, ({ many, one }) => ({
  segments: many(segment),
  lessons: many(lesson),
  terms: many(term),
  grammarPatterns: many(grammarPattern),
  cards: many(card),
  progress: one(mediaProgress, {
    fields: [media.id],
    references: [mediaProgress.mediaId]
  })
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

export const lessonRelations = relations(lesson, ({ one }) => ({
  media: one(media, {
    fields: [lesson.mediaId],
    references: [media.id]
  }),
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
  segment: one(segment, {
    fields: [card.segmentId],
    references: [segment.id]
  }),
  entryLinks: many(cardEntryLink),
  reviewState: one(reviewState, {
    fields: [card.id],
    references: [reviewState.cardId]
  }),
  reviewLogs: many(reviewLog)
}));

export const cardEntryLinkRelations = relations(cardEntryLink, ({ one }) => ({
  card: one(card, {
    fields: [cardEntryLink.cardId],
    references: [card.id]
  })
}));

export const reviewStateRelations = relations(reviewState, ({ one }) => ({
  card: one(card, {
    fields: [reviewState.cardId],
    references: [card.id]
  })
}));

export const reviewLogRelations = relations(reviewLog, ({ one }) => ({
  card: one(card, {
    fields: [reviewLog.cardId],
    references: [card.id]
  })
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  lesson: one(lesson, {
    fields: [lessonProgress.lessonId],
    references: [lesson.id]
  })
}));

export const mediaProgressRelations = relations(mediaProgress, ({ one }) => ({
  media: one(media, {
    fields: [mediaProgress.mediaId],
    references: [media.id]
  })
}));
