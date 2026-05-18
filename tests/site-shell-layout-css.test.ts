import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();

describe("site shell layout css", () => {
  it("keeps the desktop brand column from collapsing under the primary nav", async () => {
    const css = await readFile(
      path.join(PROJECT_ROOT, "src/styles/base.css"),
      "utf8"
    );
    const headerInnerRule = readRule(css, ".site-header__inner");
    const brandRule = readRule(css, ".brand");
    const navRule = readRule(css, ".site-nav");
    const navLinkRule = readRule(css, ".site-nav__link");
    const tabletCss = readMediaBlock(
      css,
      "@media (min-width: 768px) and (max-width: 1199px)"
    );
    const tabletHeaderInnerRule = readRule(tabletCss, ".site-header__inner");
    const tabletNavRule = readRule(tabletCss, ".site-nav");
    const tabletNavLinkRule = readRule(tabletCss, ".site-nav__link");
    const mobileCss = readMediaBlock(css, "@media (max-width: 767px)");
    const mobileNavRule = readRule(mobileCss, ".site-nav");
    const mobileNavLinkRule = readRule(mobileCss, ".site-nav__link");

    expect(css).not.toContain("grid-template-columns: minmax(0, auto) 1fr auto");
    expect(headerInnerRule).toContain(
      "grid-template-columns: max-content minmax(0, 1fr)"
    );
    expect(brandRule).toContain("inline-size: clamp");
    expect(navRule).toContain("min-width: 0");
    expect(navRule).toContain("justify-content: flex-end");
    expect(navLinkRule).toContain("flex: 0 0 auto");
    expect(navLinkRule).toContain("min-width: 7rem");
    expect(navLinkRule).toContain("overflow-wrap: normal");
    expect(tabletHeaderInnerRule).toContain("grid-template-columns: 1fr");
    expect(tabletNavRule).toContain("display: grid");
    expect(tabletNavRule).toContain(
      "grid-template-columns: repeat(4, minmax(0, 1fr))"
    );
    expect(tabletNavLinkRule).toContain("min-width: 0");
    expect(mobileNavRule).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr))"
    );
    expect(mobileNavLinkRule).toContain("min-width: 0");
  });
});

function readRule(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, "s").exec(
    css
  );

  expect(match?.groups?.body).toBeDefined();
  return normalizeDeclarations(match?.groups?.body ?? "");
}

function readMediaBlock(css: string, mediaQuery: string) {
  const start = css.indexOf(mediaQuery);

  expect(start).toBeGreaterThanOrEqual(0);

  const openBrace = css.indexOf("{", start);
  let depth = 0;

  for (let index = openBrace; index < css.length; index += 1) {
    const char = css[index];

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return css.slice(openBrace + 1, index);
      }
    }
  }

  throw new Error(`Missing closing brace for ${mediaQuery}.`);
}

function normalizeDeclarations(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
