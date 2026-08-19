import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("base css modules", () => {
  it("loads every base CSS module in cascade order", async () => {
    const css = await readFile(
      path.join(PROJECT_ROOT, "src/styles/base.css"),
      "utf8"
    );

    expect(css.trim().split("\n")).toEqual([
      '@import "./base-shell-drills.css";',
      '@import "./base-katakana-loading.css";',
      '@import "./base-reader.css";',
      '@import "./base-review-glossary.css";',
      '@import "./base-responsive.css";'
    ]);
  });
});
