export const READER_TOOLTIP_OFFSET_PX = 14;
export const READER_TOOLTIP_VIEWPORT_MARGIN_PX = 18;
export const READER_TOOLTIP_MAX_WIDTH_PX = 320;

export type TooltipPlacement = "top" | "bottom";

type TooltipPositionInput = {
  anchorRect: {
    top: number;
    left: number;
    bottom: number;
    width: number;
  };
  tooltipSize: {
    width: number;
    height: number;
  };
  viewport: {
    width: number;
    height: number;
  };
};

export type TooltipPosition = {
  left: number;
  top: number;
  placement: TooltipPlacement;
  maxHeight: number;
};

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function computeReaderTooltipPosition(
  input: TooltipPositionInput
): TooltipPosition {
  const { anchorRect, tooltipSize, viewport } = input;
  const maxHeight = Math.max(
    0,
    viewport.height - READER_TOOLTIP_VIEWPORT_MARGIN_PX * 2
  );
  const maxWidth = Math.max(
    0,
    Math.min(
      READER_TOOLTIP_MAX_WIDTH_PX,
      viewport.width - READER_TOOLTIP_VIEWPORT_MARGIN_PX * 2
    )
  );
  const tooltipWidth =
    tooltipSize.width > 0 ? Math.min(tooltipSize.width, maxWidth) : maxWidth;
  const tooltipHeight = Math.min(tooltipSize.height, maxHeight);

  const left = clamp(
    anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2,
    READER_TOOLTIP_VIEWPORT_MARGIN_PX,
    viewport.width - tooltipWidth - READER_TOOLTIP_VIEWPORT_MARGIN_PX
  );

  const availableAbove = Math.max(
    0,
    anchorRect.top -
      READER_TOOLTIP_VIEWPORT_MARGIN_PX -
      READER_TOOLTIP_OFFSET_PX
  );
  const availableBelow = Math.max(
    0,
    viewport.height -
      anchorRect.bottom -
      READER_TOOLTIP_VIEWPORT_MARGIN_PX -
      READER_TOOLTIP_OFFSET_PX
  );
  const fitsAbove = tooltipHeight <= availableAbove;
  const fitsBelow = tooltipHeight <= availableBelow;

  const placement: TooltipPlacement = fitsBelow
    ? "bottom"
    : fitsAbove
      ? "top"
      : availableBelow >= availableAbove
        ? "bottom"
        : "top";

  const preferredTop =
    placement === "bottom"
      ? anchorRect.bottom + READER_TOOLTIP_OFFSET_PX
      : anchorRect.top - READER_TOOLTIP_OFFSET_PX - tooltipHeight;
  const top = clamp(
    preferredTop,
    READER_TOOLTIP_VIEWPORT_MARGIN_PX,
    viewport.height - tooltipHeight - READER_TOOLTIP_VIEWPORT_MARGIN_PX
  );

  return {
    left,
    top,
    placement,
    maxHeight
  };
}
