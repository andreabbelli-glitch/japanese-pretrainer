import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { renderFurigana } from "@/lib/render-furigana";

describe("renderFurigana", () => {
  it("renders furigana in compact descriptions while flattening inline links", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        ...renderFurigana(
          "Capire {{用語|ようご}} chiave e [approfondimento](https://example.com).",
          {
            linkBehavior: "flatten"
          }
        )
      )
    );

    expect(markup).toContain(
      '<ruby class="app-ruby"><rb>用語</rb><rt>ようご</rt></ruby>'
    );
    expect(markup).toContain("approfondimento");
    expect(markup).not.toContain('<a href="https://example.com"');
    expect(markup).not.toContain("{{用語|ようご}}");
  });

  it("keeps default link rendering for richer inline text", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        ...renderFurigana("[approfondimento](https://example.com)")
      )
    );

    expect(markup).toContain('<a href="https://example.com">approfondimento</a>');
  });
});
