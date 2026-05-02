import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("review mobile layout css", () => {
  it("allows review chips and Japanese card text to wrap inside narrow screens", async () => {
    const css = await readFile(
      path.join(PROJECT_ROOT, "src/styles/base.css"),
      "utf8"
    );

    expect(css).toMatch(
      /\.review-stage__chips,\n\.review-entry-card__chips\s*\{[^}]*min-width:\s*0;/s
    );
    expect(css).toMatch(
      /\.review-stage__front\.jp-inline,\n\.review-stage__back\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*word-break:\s*normal;/s
    );
    expect(css).toMatch(
      /\.review-stage__front\.jp-inline \.app-ruby,\n\.review-stage__back \.app-ruby\s*\{[^}]*overflow-wrap:\s*anywhere;/s
    );
  });
});
