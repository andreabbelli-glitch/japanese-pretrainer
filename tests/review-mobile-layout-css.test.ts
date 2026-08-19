import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("review mobile layout css", () => {
  it("keeps long review phrases on natural mobile wrap points", async () => {
    const css = await readFile(
      path.join(PROJECT_ROOT, "src/styles/base-review-glossary.css"),
      "utf8"
    );
    const responsiveCss = await readFile(
      path.join(PROJECT_ROOT, "src/styles/ui-review-glossary.css"),
      "utf8"
    );

    expect(css).toMatch(
      /\.review-stage__chips,\n\.review-entry-card__chips\s*\{[^}]*min-width:\s*0;/s
    );
    expect(css).toMatch(
      /\.review-stage__front\.jp-inline,\n\.review-stage__back\s*\{[^}]*overflow-wrap:\s*break-word;[^}]*word-break:\s*normal;[^}]*line-break:\s*auto;/s
    );
    expect(css).toMatch(
      /\.review-stage__front\.jp-inline \.app-ruby,\n\.review-stage__back \.app-ruby\s*\{[^}]*overflow-wrap:\s*normal;[^}]*word-break:\s*normal;/s
    );
    expect(responsiveCss).toMatch(
      /\.review-stage__back\s*\{[^}]*overflow-wrap:\s*anywhere;/s
    );
  });

  it("prevents Safari audio controls from widening nested review grids", async () => {
    const css = await readFile(
      path.join(PROJECT_ROOT, "src/styles/ui-review-glossary.css"),
      "utf8"
    );

    expect(css).toMatch(
      /\.review-stage,\n\.review-sidebar,\n\.review-entry-card\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s
    );
    expect(css).toMatch(
      /\.review-stage__card,\n\.review-stage__veil,\n\.review-stage__answer,\n\.review-sidebar__notice\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s
    );
    expect(css).toMatch(
      /\.pronunciation-audio,\n\.reader-example-sentence,\n\.reader-example-sentence__translation\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/s
    );
    expect(css).toMatch(
      /\.pronunciation-audio__player\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*width:\s*100%;/s
    );
    expect(css).toContain("@media (max-width: 479px)");
  });
});
