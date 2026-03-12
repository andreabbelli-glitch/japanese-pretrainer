import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PitchAccentNotation } from "@/components/ui/pitch-accent-notation";
import { buildPitchAccentData } from "@/lib/pitch-accent";

describe("PitchAccentNotation", () => {
  it("starts the low rail after the drop for atamadaka words", () => {
    const markup = renderToStaticMarkup(
      PitchAccentNotation({
        pitchAccent: buildPitchAccentData("しんか", 1)!
      })
    );

    expect(markup.match(/pitch-accent__rail--upper/g)).toHaveLength(1);
    expect(markup.match(/pitch-accent__connector--drop/g)).toHaveLength(1);
    expect(markup.match(/pitch-accent__rail--lower/g)).toHaveLength(1);
    expect(markup).toContain("--pitch-accent-span-start:1");
    expect(markup).toContain("--pitch-accent-span-length:2");
  });

  it("starts the low rail after the accented mora for nakadaka words", () => {
    const markup = renderToStaticMarkup(
      PitchAccentNotation({
        pitchAccent: buildPitchAccentData("しんか", 2)!
      })
    );

    expect(markup.match(/pitch-accent__rail--upper/g)).toHaveLength(1);
    expect(markup.match(/pitch-accent__connector--drop/g)).toHaveLength(1);
    expect(markup.match(/pitch-accent__rail--lower/g)).toHaveLength(1);
    expect(markup).toContain("--pitch-accent-span-start:0");
    expect(markup).toContain("--pitch-accent-span-length:2");
    expect(markup).toContain("--pitch-accent-span-start:2");
    expect(markup).toContain("--pitch-accent-span-length:1");
  });
});
