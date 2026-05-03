import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("review mobile layout css", () => {
  it("keeps long review phrases on natural mobile wrap points", async () => {
    const css = await readFile(
      path.join(PROJECT_ROOT, "src/styles/base.css"),
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
  });
});
