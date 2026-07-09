import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteShell } from "@/components/site-shell";
import { SurfaceCard } from "@/components/ui/surface-card";

const navigationState = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname
}));

vi.mock("@/components/site-shell-primary-nav", () => ({
  SiteShellPrimaryNav: () => null
}));

const PROJECT_ROOT = process.cwd();

describe("shared UI foundations", () => {
  beforeEach(() => {
    navigationState.pathname = "/";
  });

  it("renders the flat SurfaceCard variant without changing its semantic element", () => {
    const markup = renderToStaticMarkup(
      SurfaceCard({
        as: "section",
        children: "Contenuto",
        variant: "flat"
      })
    );

    expect(markup).toBe(
      '<section class="surface-card surface-card--flat">Contenuto</section>'
    );
  });

  it.each(["/", "/katakana-speed/session/round-1", "/login"])(
    "provides a skip link and focusable main target on %s",
    (pathname) => {
      navigationState.pathname = pathname;

      const markup = renderToStaticMarkup(
        createElement(SiteShell, null, createElement("p", null, "Contenuto"))
      );

      expect(markup).toContain(
        '<a class="skip-link" href="#main-content">Salta al contenuto principale</a>'
      );
      expect(markup).toMatch(/<main[^>]*id="main-content"[^>]*tabindex="-1"/);
    }
  );

  it("loads the focused stylesheet after the existing global bundle", async () => {
    const layout = await readFile(
      path.join(PROJECT_ROOT, "src/app/layout.tsx"),
      "utf8"
    );
    const css = await readFile(
      path.join(PROJECT_ROOT, "src/styles/ui-foundations.css"),
      "utf8"
    );

    expect(
      layout.indexOf('import "../styles/ui-foundations.css"')
    ).toBeGreaterThan(layout.indexOf('import "./globals.css"'));
    expect(css).toContain(".surface-card--flat");
    expect(css).toContain(".skip-link:focus-visible");
    expect(css).toContain("scrollbar-width: thin");
    expect(css).toMatch(/\.app-shell\s+:is\(/u);
    expect(css).toContain("min-block-size: var(--touch-target-min)");
    expect(css).toContain("@media (forced-colors: active)");
  });

  it("keeps a single main landmark when the reader is inside SiteShell", async () => {
    const reader = await readFile(
      path.join(
        PROJECT_ROOT,
        "src/components/textbook/lesson-reader-client.tsx"
      ),
      "utf8"
    );

    expect(reader).toContain('<div className="reader-main">');
    expect(reader).not.toContain('<main className="reader-main">');
  });
});
