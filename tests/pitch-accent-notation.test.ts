import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PitchAccentNotation } from "@/components/ui/pitch-accent-notation";
import { buildPitchAccentData } from "@/lib/pitch-accent";

describe("PitchAccentNotation", () => {
  it("starts the low rail after the drop for atamadaka words", () => {
    const markup = renderToStaticMarkup(
      createElement(PitchAccentNotation, {
        pitchAccent: buildPitchAccentData("しんか", 1)!
      })
    );

    expect(markup.match(/pitch-accent__rail--upper/g)).toHaveLength(1);
    expect(markup.match(/pitch-accent__connector--drop/g)).toHaveLength(1);
    expect(markup.match(/pitch-accent__rail--lower/g)).toHaveLength(1);
    expect(markup).toContain("--pitch-accent-span-offset:1");
    expect(markup).toContain("--pitch-accent-span-width:2");
  });

  it("starts the low rail after the accented mora for nakadaka words", () => {
    const markup = renderToStaticMarkup(
      createElement(PitchAccentNotation, {
        pitchAccent: buildPitchAccentData("ちけっと", 2)!
      })
    );

    expect(markup.match(/pitch-accent__rail--upper/g)).toHaveLength(1);
    expect(markup.match(/pitch-accent__connector--rise/g)).toHaveLength(1);
    expect(markup.match(/pitch-accent__connector--drop/g)).toHaveLength(1);
    expect(markup.match(/pitch-accent__rail--lower/g)).toHaveLength(2);
    expect(markup).toContain("--pitch-accent-span-offset:0");
    expect(markup).toContain("--pitch-accent-span-width:1");
    expect(markup).toContain("--pitch-accent-span-offset:1");
    expect(markup).toContain("--pitch-accent-span-width:1");
    expect(markup).toContain("--pitch-accent-span-offset:2");
    expect(markup).toContain("--pitch-accent-span-width:2");
  });

  it("gives compound morae more space so rails align with readings like shinryaku", () => {
    const markup = renderToStaticMarkup(
      createElement(PitchAccentNotation, {
        pitchAccent: buildPitchAccentData("しんりゃく", 0)!
      })
    );

    expect(markup).toContain(
      'grid-template-columns:calc(1 * var(--pitch-accent-cell-size)) calc(1 * var(--pitch-accent-cell-size)) calc(1.38 * var(--pitch-accent-cell-size)) calc(1 * var(--pitch-accent-cell-size))'
    );
    expect(markup).toContain("--pitch-accent-boundary-offset:1");
    expect(markup).toContain("--pitch-accent-span-offset:1");
    expect(markup).toContain("--pitch-accent-span-width:3.38");
    expect(markup).toContain('<span class="pitch-accent__mora">りゃ</span>');
  });
});
