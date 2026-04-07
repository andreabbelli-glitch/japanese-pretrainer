import { describe, expect, it } from "vitest";

import {
  computeReaderTooltipPosition,
  READER_TOOLTIP_MAX_WIDTH_PX,
  READER_TOOLTIP_OFFSET_PX,
  READER_TOOLTIP_VIEWPORT_MARGIN_PX
} from "@/components/textbook/tooltip-position";

describe("computeReaderTooltipPosition", () => {
  it("keeps the tooltip below the anchor when there is enough space", () => {
    const position = computeReaderTooltipPosition({
      anchorRect: {
        top: 120,
        left: 280,
        bottom: 152,
        width: 80
      },
      tooltipSize: {
        width: 280,
        height: 180
      },
      viewport: {
        width: 1280,
        height: 900
      }
    });

    expect(position.placement).toBe("bottom");
    expect(position.top).toBe(152 + READER_TOOLTIP_OFFSET_PX);
  });

  it("flips the tooltip above the anchor when the bottom would overflow", () => {
    const position = computeReaderTooltipPosition({
      anchorRect: {
        top: 660,
        left: 320,
        bottom: 692,
        width: 96
      },
      tooltipSize: {
        width: READER_TOOLTIP_MAX_WIDTH_PX,
        height: 220
      },
      viewport: {
        width: 1280,
        height: 820
      }
    });

    expect(position.placement).toBe("top");
    expect(position.top).toBe(660 - READER_TOOLTIP_OFFSET_PX - 220);
  });

  it("clamps the tooltip inside the viewport when neither side can fit fully", () => {
    const position = computeReaderTooltipPosition({
      anchorRect: {
        top: 300,
        left: 24,
        bottom: 332,
        width: 40
      },
      tooltipSize: {
        width: 420,
        height: 520
      },
      viewport: {
        width: 360,
        height: 640
      }
    });

    expect(position.left).toBe(READER_TOOLTIP_VIEWPORT_MARGIN_PX);
    expect(position.placement).toBe("bottom");
    expect(position.top).toBe(
      640 - 520 - READER_TOOLTIP_VIEWPORT_MARGIN_PX
    );
    expect(position.maxHeight).toBe(
      640 - READER_TOOLTIP_VIEWPORT_MARGIN_PX * 2
    );
  });
});
