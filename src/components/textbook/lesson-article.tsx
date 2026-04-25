"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode, useRef, useState } from "react";

import { cx } from "@/lib/classnames";
import type {
  ContentBlock,
  InlineNode,
  MarkdownDocument
} from "@/lib/content/types";
import { renderFurigana, splitMonoRuby } from "@/lib/render-furigana";
import { mediaAssetHref } from "@/lib/site";
import type {
  FuriganaMode,
  TextbookEntryTooltip
} from "@/features/textbook/types";

import { EmptyState } from "../ui/empty-state";
import { PronunciationAudio } from "../ui/pronunciation-audio";

export type TooltipTarget = {
  id: string;
  kind: TextbookEntryTooltip["kind"];
};

type ImagePresentation = {
  height: number;
  sizes: string;
  variantClassName: string;
  width: number;
};

export type ExpandedImageState = {
  alt: string;
  captionText: string | null;
  presentation: ImagePresentation;
  src: string;
};

function resolveImagePresentation(src: string): ImagePresentation {
  if (src.startsWith("assets/cards/")) {
    return {
      height: 908,
      sizes: "(max-width: 960px) min(100vw - 3rem, 24rem), 26rem",
      variantClassName: "reader-image--card",
      width: 650
    };
  }

  if (src.startsWith("assets/ui/")) {
    return {
      height: 900,
      sizes: "(max-width: 960px) 100vw, 56rem",
      variantClassName: "reader-image--ui",
      width: 1600
    };
  }

  return {
    height: 1000,
    sizes: "(max-width: 960px) 100vw, 48rem",
    variantClassName: "reader-image--default",
    width: 1400
  };
}

function extractInlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
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
          return extractInlineText(node.children);
        case "break":
          return " ";
      }
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function getTooltipEntryKey(target: TooltipTarget) {
  return `${target.kind}:${target.id}`;
}

export function hasLessonTooltipTargets(document: MarkdownDocument | null) {
  return document ? blocksHaveTooltipTargets(document.blocks) : false;
}

type LessonArticleProps = {
  activeEntryKey: string | null;
  document: MarkdownDocument | null;
  furiganaMode: FuriganaMode;
  isTouchLayout: boolean;
  mediaSlug: string;
  onReferenceBlur: () => void;
  onReferenceClick: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceFocus: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceHover: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onReferenceLeave: () => void;
  onImageExpand: (image: ExpandedImageState) => void;
};

export function LessonArticle({
  activeEntryKey,
  document,
  furiganaMode,
  isTouchLayout,
  mediaSlug,
  onReferenceBlur,
  onReferenceClick,
  onReferenceFocus,
  onReferenceHover,
  onReferenceLeave,
  onImageExpand
}: LessonArticleProps) {
  if (!document) {
    return (
      <EmptyState
        description="Questa lesson non ha un contenuto strutturato valido da mostrare."
        eyebrow="Lesson reader"
        title="Contenuto non disponibile"
      />
    );
  }

  const renderInlineNodes = (nodes: InlineNode[]): ReactNode =>
    nodes.map((node, index) => {
      switch (node.type) {
        case "text":
          return <Fragment key={index}>{node.value}</Fragment>;
        case "furigana":
          return (
            <FuriganaRuby
              base={node.base}
              furiganaMode={furiganaMode}
              isTouchLayout={isTouchLayout}
              key={index}
              reading={node.reading}
            />
          );
        case "reference": {
          const target = {
            id: node.targetId,
            kind: node.targetType
          } satisfies TooltipTarget;

          return (
            <ReferenceToken
              active={activeEntryKey === getTooltipEntryKey(target)}
              kind={target.kind}
              key={index}
              onBlur={onReferenceBlur}
              onClick={onReferenceClick}
              onFocus={onReferenceFocus}
              onHover={onReferenceHover}
              onLeave={onReferenceLeave}
              target={target}
            >
              {renderInlineNodes(node.children)}
            </ReferenceToken>
          );
        }
        case "emphasis":
          return <em key={index}>{renderInlineNodes(node.children)}</em>;
        case "strong":
          return (
            <strong key={index}>{renderInlineNodes(node.children)}</strong>
          );
        case "inlineCode":
          return <code key={index}>{renderInlineNodes(node.children)}</code>;
        case "link":
          return (
            <a href={node.url} key={index} title={node.title ?? undefined}>
              {renderInlineNodes(node.children)}
            </a>
          );
        case "break":
          return <br key={index} />;
      }
    });

  const renderBlocks = (blocks: ContentBlock[]) =>
    blocks.map((block, index) => renderBlock(block, index));

  const renderBlock = (block: ContentBlock, index: number): ReactNode => {
    switch (block.type) {
      case "paragraph":
        return (
          <p className="reader-paragraph" key={index}>
            {renderInlineNodes(block.children)}
          </p>
        );
      case "heading":
        return block.depth === 1 ? (
          <h2 className="reader-heading reader-heading--h1" key={index}>
            {renderInlineNodes(block.children)}
          </h2>
        ) : block.depth === 2 ? (
          <h3 className="reader-heading reader-heading--h2" key={index}>
            {renderInlineNodes(block.children)}
          </h3>
        ) : (
          <h4 className="reader-heading reader-heading--h3" key={index}>
            {renderInlineNodes(block.children)}
          </h4>
        );
      case "list":
        return block.ordered ? (
          <ol className="reader-list reader-list--ordered" key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderBlocks(item.children)}</li>
            ))}
          </ol>
        ) : (
          <ul className="reader-list" key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderBlocks(item.children)}</li>
            ))}
          </ul>
        );
      case "blockquote":
        return (
          <blockquote className="reader-blockquote" key={index}>
            {renderBlocks(block.children)}
          </blockquote>
        );
      case "code":
        return (
          <pre className="reader-code" key={index}>
            <code>{block.value}</code>
          </pre>
        );
      case "thematicBreak":
        return <hr className="reader-divider" key={index} />;
      case "image":
        const imagePresentation = resolveImagePresentation(block.src);
        const expandedImage = {
          alt: block.alt,
          captionText: block.caption
            ? extractInlineText(block.caption.nodes)
            : null,
          presentation: imagePresentation,
          src: mediaAssetHref(mediaSlug, block.src)
        } satisfies ExpandedImageState;

        return (
          <figure
            className={cx(
              "reader-image",
              imagePresentation.variantClassName,
              "reader-image--zoomable"
            )}
            key={index}
          >
            <button
              aria-label={`Apri immagine ingrandita: ${block.alt}`}
              className="reader-image__button reader-image__button--zoom"
              onClick={() => onImageExpand(expandedImage)}
              type="button"
            >
              <Image
                alt={block.alt}
                className="reader-image__asset"
                decoding="async"
                height={imagePresentation.height}
                loading="lazy"
                sizes={imagePresentation.sizes}
                src={mediaAssetHref(mediaSlug, block.src)}
                unoptimized
                width={imagePresentation.width}
              />
            </button>
            {block.caption ? (
              <figcaption className="reader-image__caption">
                {renderInlineNodes(block.caption.nodes)}
              </figcaption>
            ) : null}
          </figure>
        );
      case "exampleSentence":
        if (block.revealMode === "sentence") {
          return (
            <section
              className="reader-example-sentence reader-example-sentence--sentence-toggle"
              key={index}
            >
              <details className="reader-example-sentence__translation reader-example-sentence__translation--sentence">
                <summary className="reader-example-sentence__summary">
                  <span className="reader-example-sentence__summary-text jp-inline">
                    {renderInlineNodes(block.sentence.nodes)}
                  </span>
                </summary>
                <div className="reader-example-sentence__translation-body">
                  <p>{renderInlineNodes(block.translationIt.nodes)}</p>
                </div>
              </details>
            </section>
          );
        }

        return (
          <section className="reader-example-sentence" key={index}>
            <p className="reader-example-sentence__jp jp-inline">
              {renderInlineNodes(block.sentence.nodes)}
            </p>
            <details className="reader-example-sentence__translation">
              <summary>Mostra traduzione italiana</summary>
              <div className="reader-example-sentence__translation-body">
                <p>{renderInlineNodes(block.translationIt.nodes)}</p>
              </div>
            </details>
          </section>
        );
      case "termDefinition":
        return (
          <section className="reader-definition-card" key={index}>
            <div className="reader-definition-card__eyebrow">
              <span className="chip">Termine</span>
              {block.entry.levelHint ? (
                <span className="meta-pill">{block.entry.levelHint}</span>
              ) : null}
            </div>
            <h3 className="reader-definition-card__jp jp-inline">
              {block.entry.lemma}
            </h3>
            <p className="reader-definition-card__reading jp-inline">
              {block.entry.reading} · {block.entry.romaji}
            </p>
            <p className="reader-definition-card__meaning">
              {block.entry.meaningIt}
            </p>
            {block.entry.notesIt ? (
              <p className="reader-definition-card__notes">
                {renderInlineNodes(block.entry.notesIt.nodes)}
              </p>
            ) : null}
          </section>
        );
      case "grammarDefinition":
        return (
          <section
            className="reader-definition-card reader-definition-card--grammar"
            key={index}
          >
            <div className="reader-definition-card__eyebrow">
              <span className="chip chip--grammar">Grammatica</span>
              {block.entry.levelHint ? (
                <span className="meta-pill">{block.entry.levelHint}</span>
              ) : null}
            </div>
            <h3 className="reader-definition-card__jp jp-inline">
              {block.entry.pattern}
            </h3>
            <p className="reader-definition-card__meaning">
              {block.entry.meaningIt}
            </p>
            {block.entry.notesIt ? (
              <p className="reader-definition-card__notes">
                {renderInlineNodes(block.entry.notesIt.nodes)}
              </p>
            ) : null}
          </section>
        );
      case "cardDefinition":
        return (
          <section className="reader-card-inline" key={index}>
            <div className="reader-card-inline__face">
              <span className="eyebrow">Fronte</span>
              <div>{renderInlineNodes(block.card.front.nodes)}</div>
            </div>
            <div className="reader-card-inline__face reader-card-inline__face--back">
              <span className="eyebrow">Retro</span>
              <div>{renderInlineNodes(block.card.back.nodes)}</div>
            </div>
          </section>
        );
    }
  };

  return (
    <article className="reader-article">
      {renderBlocks(document.blocks)}
    </article>
  );
}

export function formatCrossMediaHintLabel(otherMediaCount: number) {
  return otherMediaCount === 1
    ? "Compare anche in 1 altro media."
    : `Compare anche in altri ${otherMediaCount} media.`;
}

type ReferenceTokenProps = {
  active: boolean;
  children: ReactNode;
  kind: "term" | "grammar";
  onBlur: () => void;
  onClick: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onFocus: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onHover: (
    target: TooltipTarget,
    element: HTMLElement,
    intent: "hover" | "focus" | "click"
  ) => void;
  onLeave: () => void;
  target: TooltipTarget;
};

function ReferenceToken({
  active,
  children,
  kind,
  onBlur,
  onClick,
  onFocus,
  onHover,
  onLeave,
  target
}: ReferenceTokenProps) {
  const ref = useRef<HTMLButtonElement | null>(null);

  return (
    <button
      className={cx(
        "reader-ref",
        kind === "grammar" ? "reader-ref--grammar" : "reader-ref--term",
        active && "reader-ref--active"
      )}
      onBlur={onBlur}
      onClick={() => {
        if (ref.current) {
          onClick(target, ref.current, "click");
        }
      }}
      onFocus={() => {
        if (ref.current) {
          onFocus(target, ref.current, "focus");
        }
      }}
      onMouseEnter={() => {
        if (ref.current) {
          onHover(target, ref.current, "hover");
        }
      }}
      onMouseLeave={onLeave}
      ref={ref}
      type="button"
    >
      {children}
    </button>
  );
}

function blocksHaveTooltipTargets(blocks: ContentBlock[]): boolean {
  return blocks.some((block) => {
    switch (block.type) {
      case "paragraph":
      case "heading":
        return inlineNodesHaveTooltipTargets(block.children);
      case "list":
        return block.items.some((item) => blocksHaveTooltipTargets(item.children));
      case "blockquote":
        return blocksHaveTooltipTargets(block.children);
      case "image":
        return block.caption
          ? inlineNodesHaveTooltipTargets(block.caption.nodes)
          : false;
      case "exampleSentence":
        return (
          inlineNodesHaveTooltipTargets(block.sentence.nodes) ||
          inlineNodesHaveTooltipTargets(block.translationIt.nodes)
        );
      case "termDefinition":
      case "grammarDefinition":
        return block.entry.notesIt
          ? inlineNodesHaveTooltipTargets(block.entry.notesIt.nodes)
          : false;
      case "cardDefinition":
        return (
          inlineNodesHaveTooltipTargets(block.card.front.nodes) ||
          inlineNodesHaveTooltipTargets(block.card.back.nodes)
        );
      case "code":
      case "thematicBreak":
        return false;
    }
  });
}

function inlineNodesHaveTooltipTargets(nodes: InlineNode[]): boolean {
  return nodes.some((node) => {
    switch (node.type) {
      case "reference":
        return true;
      case "emphasis":
      case "strong":
      case "inlineCode":
      case "link":
        return inlineNodesHaveTooltipTargets(node.children);
      case "text":
      case "furigana":
      case "break":
        return false;
    }
  });
}

type FuriganaRubyProps = {
  base: string;
  furiganaMode: FuriganaMode;
  isTouchLayout: boolean;
  reading: string;
};

function FuriganaRuby({
  base,
  furiganaMode,
  isTouchLayout,
  reading
}: FuriganaRubyProps) {
  const [revealed, setRevealed] = useState(false);
  const segments = splitMonoRuby(base, reading);

  const sharedProps = {
    "data-revealed": furiganaMode === "hover" && revealed,
    onClick: () => {
      if (furiganaMode === "hover" && isTouchLayout) {
        setRevealed((current) => !current);
      }
    },
    onBlur: () => setRevealed(false),
    tabIndex: furiganaMode === "hover" ? 0 : -1
  } as const;

  if (segments.length === 1) {
    return (
      <ruby className="app-ruby reader-ruby" {...sharedProps}>
        <rb>{base}</rb>
        <rt>{reading}</rt>
      </ruby>
    );
  }

  return (
    <span {...sharedProps}>
      {segments.map(([segBase, segReading], i) => (
        <ruby className="app-ruby reader-ruby" key={i}>
          <rb>{segBase}</rb>
          <rt>{segReading}</rt>
        </ruby>
      ))}
    </span>
  );
}

type EntryTooltipCardProps = {
  audioPreload?: "auto" | "metadata" | "none";
  entry: TextbookEntryTooltip | null;
  isLoading?: boolean;
  mobile?: boolean;
  onRetry?: () => void;
};

export function EntryTooltipCard({
  audioPreload = "none",
  entry,
  isLoading = false,
  mobile = false,
  onRetry
}: EntryTooltipCardProps) {
  if (!entry) {
    return (
      <div
        className={cx(
          "entry-tooltip-card",
          mobile && "entry-tooltip-card--mobile"
        )}
      >
        <div className="entry-tooltip-card__top">
          <span className="chip chip--grammar">
            {isLoading ? "Caricamento" : "Dettagli"}
          </span>
        </div>
        <p className="entry-tooltip-card__meaning">
          {isLoading
            ? "Sto caricando i dettagli del riferimento."
            : "I dettagli del riferimento non sono disponibili al momento."}
        </p>
        {onRetry ? (
          <button className="text-link" onClick={onRetry} type="button">
            Riprova
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cx(
        "entry-tooltip-card",
        mobile && "entry-tooltip-card--mobile"
      )}
    >
      <div className="entry-tooltip-card__top">
        <span
          className={cx("chip", entry.kind === "grammar" && "chip--grammar")}
        >
          {entry.kind === "term" ? "Termine" : "Grammatica"}
        </span>
        <span className="meta-pill">{entry.statusLabel}</span>
      </div>
      <h2 className="entry-tooltip-card__title jp-inline">
        {renderFurigana(entry.label)}
      </h2>
      {"title" in entry && entry.title && entry.title !== entry.label ? (
        <p className="entry-tooltip-card__subtitle">{entry.title}</p>
      ) : null}
      {entry.reading || ("romaji" in entry && entry.romaji) ? (
        <p className="entry-tooltip-card__reading jp-inline">
          {[entry.reading, "romaji" in entry ? entry.romaji : undefined]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
      {entry.pronunciation ? (
        <PronunciationAudio
          audio={entry.pronunciation}
          compact
          preload={audioPreload}
        />
      ) : null}
      <p className="entry-tooltip-card__meaning">{entry.meaning}</p>
      {"literalMeaning" in entry && entry.literalMeaning ? (
        <p className="entry-tooltip-card__detail">
          Letterale: {entry.literalMeaning}
        </p>
      ) : null}
      {"pos" in entry && entry.pos ? (
        <p className="entry-tooltip-card__detail">Categoria: {entry.pos}</p>
      ) : null}
      {entry.notes ? (
        <p className="entry-tooltip-card__notes">
          {renderFurigana(entry.notes)}
        </p>
      ) : null}
      {"crossMediaHint" in entry && entry.crossMediaHint ? (
        <p className="entry-tooltip-card__detail">
          {formatCrossMediaHintLabel(entry.crossMediaHint.otherMediaCount)}
        </p>
      ) : null}
      <Link className="text-link" href={entry.glossaryHref}>
        Apri voce
      </Link>
    </div>
  );
}
