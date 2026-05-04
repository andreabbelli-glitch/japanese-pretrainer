import { scoreKatakanaSpeedRanGrid } from "./scoring.ts";

export type KatakanaSpeedRanGridSourceCell = {
  readonly itemId: string;
  readonly surface: string;
};

export type KatakanaSpeedRanGridCellSnapshot = {
  readonly column: number;
  readonly index: number;
  readonly itemId: string;
  readonly row: number;
  readonly surface: string;
};

export type KatakanaSpeedRanGridMetrics = {
  readonly adjustedItemsPerSecond: number;
  readonly cells: readonly KatakanaSpeedRanGridCellSnapshot[];
  readonly cellItemIds: readonly string[];
  readonly cellSurfaces: readonly string[];
  readonly columns: number;
  readonly correctItems: number;
  readonly durationMs: number;
  readonly errorRate: number;
  readonly errors: number;
  readonly itemsPerSecond: number;
  readonly rows: number;
  readonly schemaVersion: 1;
  readonly totalItems: number;
  readonly wrongCellIndexes?: readonly number[];
  readonly wrongCells?: readonly KatakanaSpeedRanGridCellSnapshot[];
};

export function buildKatakanaSpeedRanGridCellSnapshots(input: {
  readonly cells: readonly KatakanaSpeedRanGridSourceCell[];
  readonly columns?: number;
  readonly totalItems?: number;
}): readonly KatakanaSpeedRanGridCellSnapshot[] {
  const columns = Math.max(1, Math.round(input.columns ?? 5));
  const totalItems = Math.max(
    0,
    Math.round(input.totalItems ?? input.cells.length)
  );

  return Array.from({ length: totalItems }, (_, index) => {
    const cell = input.cells[index];

    return {
      column: (index % columns) + 1,
      index,
      itemId: cell?.itemId ?? "",
      row: Math.floor(index / columns) + 1,
      surface: cell?.surface ?? ""
    };
  });
}

export function uniqueSortedKatakanaSpeedRanGridIndexes(
  indexes: readonly number[],
  totalItems: number
): readonly number[] {
  return [
    ...new Set(
      indexes
        .map((index) => Math.round(index))
        .filter(
          (index) => Number.isFinite(index) && index >= 0 && index < totalItems
        )
    )
  ].sort((left, right) => left - right);
}

export function buildKatakanaSpeedRanGridMetrics(input: {
  readonly cells: readonly KatakanaSpeedRanGridCellSnapshot[];
  readonly columns?: number;
  readonly durationMs: number;
  readonly errors?: number;
  readonly extraMetrics?: Readonly<Record<string, unknown>>;
  readonly rows?: number;
  readonly wrongCellIndexes?: readonly number[] | null;
}): KatakanaSpeedRanGridMetrics & Readonly<Record<string, unknown>> {
  const totalItems = input.cells.length;
  const columns = Math.max(1, Math.round(input.columns ?? 5));
  const rows = Math.max(1, Math.round(input.rows ?? 5));
  const wrongCellIndexes =
    input.wrongCellIndexes === undefined || input.wrongCellIndexes === null
      ? null
      : uniqueSortedKatakanaSpeedRanGridIndexes(
          input.wrongCellIndexes,
          totalItems
        );
  const hasWrongCellIndexes = wrongCellIndexes !== null;
  const errors = hasWrongCellIndexes
    ? wrongCellIndexes.length
    : Math.max(0, Math.min(totalItems, Math.round(input.errors ?? 0)));
  const correctItems = totalItems - errors;
  const durationMs = Math.max(0, Math.round(input.durationMs));
  const score = scoreKatakanaSpeedRanGrid({
    correctItems,
    responseMs: durationMs,
    totalItems
  });
  const canonical: KatakanaSpeedRanGridMetrics &
    Readonly<Record<string, unknown>> = {
    ...(input.extraMetrics ?? {}),
    adjustedItemsPerSecond: score.adjustedItemsPerSecond,
    cells: input.cells,
    cellItemIds: input.cells.map((cell) => cell.itemId),
    cellSurfaces: input.cells.map((cell) => cell.surface),
    columns,
    correctItems,
    durationMs,
    errorRate: totalItems > 0 ? roundTo(errors / totalItems, 3) : 0,
    errors,
    itemsPerSecond: score.itemsPerSecond,
    rows,
    schemaVersion: 1,
    totalItems
  };

  if (hasWrongCellIndexes) {
    return {
      ...canonical,
      wrongCellIndexes,
      wrongCells: wrongCellIndexes.flatMap((index) => {
        const cell = input.cells[index];
        return cell ? [cell] : [];
      })
    };
  }

  return canonical;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
