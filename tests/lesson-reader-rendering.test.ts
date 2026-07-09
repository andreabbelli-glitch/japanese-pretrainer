import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LessonArticle } from "@/components/textbook/lesson-article";
import {
  LessonReaderFooter,
  LessonReaderHeader
} from "@/components/textbook/lesson-reader-ui";
import type { MarkdownDocument } from "@/features/content/types";
import type { TextbookLessonData } from "@/features/textbook/types";

const noOp = () => {};

describe("lesson reader rendering", () => {
  it("suppresses only the first matching depth-one Markdown heading", () => {
    const markup = renderArticle(
      {
        raw: "stub",
        blocks: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "Introduzione" }]
          },
          {
            type: "heading",
            depth: 1,
            children: [{ type: "text", value: "Titolo   Lesson" }]
          },
          {
            type: "heading",
            depth: 1,
            children: [{ type: "text", value: "Titolo Lesson" }]
          },
          {
            type: "heading",
            depth: 2,
            children: [{ type: "text", value: "Approfondimento" }]
          }
        ]
      },
      "titolo lesson"
    );

    expect(markup.match(/Titolo Lesson/gu)).toHaveLength(1);
    expect(markup).not.toContain("Titolo   Lesson");
    expect(markup).toContain("Approfondimento");
  });

  it("keeps headings when the first depth-one heading does not match", () => {
    const markup = renderArticle(
      {
        raw: "stub",
        blocks: [
          {
            type: "heading",
            depth: 1,
            children: [{ type: "text", value: "Introduzione" }]
          },
          {
            type: "heading",
            depth: 1,
            children: [{ type: "text", value: "Titolo Lesson" }]
          }
        ]
      },
      "Titolo Lesson"
    );

    expect(markup).toContain("Introduzione");
    expect(markup).toContain("Titolo Lesson");
  });

  it("uses one completion label and explains the consolidation handoff", () => {
    const lesson = buildLesson();
    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(LessonReaderHeader, {
          completedLessons: 2,
          furiganaMode: "hover",
          isSavingFurigana: false,
          isSavingLesson: false,
          lesson,
          lessonStatus: "in_progress",
          media: buildMedia(),
          onFuriganaModeChange: noOp,
          onToggleLessonCompletion: noOp,
          totalLessons: 5
        }),
        createElement(LessonReaderFooter, {
          isSavingLesson: false,
          lessonStatus: "in_progress",
          mediaSlug: "sample-media",
          nextLesson: null,
          onToggleLessonCompletion: noOp,
          previousLesson: null,
          reviewHref: "/review"
        })
      )
    );

    expect(markup.match(/Completa lesson/gu)).toHaveLength(2);
    expect(
      markup.match(/Se ci sono nuove card, passerai al Consolidamento\./gu)
    ).toHaveLength(2);
    expect(markup).not.toContain("Segna completata");
    expect(markup).not.toContain("Chiudi lesson");
  });

  it("marks straightforward Japanese reading surfaces with the right language", () => {
    const markup = renderArticle({
      raw: "stub",
      blocks: [
        {
          type: "exampleSentence",
          sentence: {
            raw: "日本語",
            nodes: [{ type: "text", value: "日本語" }]
          },
          translationIt: {
            raw: "giapponese",
            nodes: [{ type: "text", value: "giapponese" }]
          },
          revealMode: "default"
        }
      ]
    });

    expect(markup).toContain(
      'class="reader-example-sentence__jp jp-inline" lang="ja"'
    );
  });

  it("does not mark romaji as Japanese inside mixed reading lines", () => {
    const markup = renderArticle({
      raw: "stub",
      blocks: [
        {
          type: "termDefinition",
          entry: {
            aliases: [],
            id: "term-taberu",
            kind: "term",
            lemma: "食べる",
            meaningIt: "mangiare",
            pos: "verbo",
            reading: "たべる",
            romaji: "taberu",
            source: {
              documentId: "lesson-1",
              documentKind: "lesson",
              filePath: "content/media/sample/textbook/001.md",
              sequence: 0
            }
          }
        }
      ]
    });

    expect(markup).toContain('<span lang="ja">たべる</span> · taberu');
    expect(markup).not.toContain(
      'class="reader-definition-card__reading jp-inline" lang="ja"'
    );
  });
});

function renderArticle(document: MarkdownDocument, lessonTitle?: string) {
  return renderToStaticMarkup(
    createElement(LessonArticle, {
      activeEntryKey: null,
      document,
      furiganaMode: "hover",
      isTouchLayout: false,
      lessonTitle,
      mediaSlug: "sample-media",
      onImageExpand: noOp,
      onReferenceBlur: noOp,
      onReferenceClick: noOp,
      onReferenceFocus: noOp,
      onReferenceHover: noOp,
      onReferenceLeave: noOp
    })
  );
}

function buildLesson(): TextbookLessonData["lesson"] {
  return {
    ast: null,
    completedAt: null,
    difficulty: "N4",
    excerpt: null,
    id: "lesson-1",
    segmentTitle: "Capitolo 1",
    slug: "intro",
    status: "in_progress",
    statusLabel: "In corso",
    summary: "Introduzione",
    title: "Titolo Lesson"
  };
}

function buildMedia(): TextbookLessonData["media"] {
  return {
    description: "Media di esempio",
    id: "media-1",
    mediaTypeLabel: "Anime",
    segmentKindLabel: "Capitolo",
    slug: "sample-media",
    title: "Sample Media"
  };
}
