/**
 * Shared sub-components and formatters used by both the hub page and the recap
 * page of the Katakana Speed feature.
 */

type FamilyCardItem = {
  readonly accuracyPercent: number | null;
  readonly family: string;
  readonly focusSurfaces: readonly string[];
  readonly label: string;
  readonly medianRtMs: number | null;
  readonly status: "new" | "repair" | "stable" | "watch";
};

type ConfusionItem = {
  readonly avgRtMs: number;
  readonly count: number;
  readonly expectedSurface: string;
  readonly observedSurface: string;
};

type SlowItem = {
  readonly count: number;
  readonly itemId: string;
  readonly medianRtMs: number;
  readonly surface: string;
};

export function FamilyCards({ items }: { items: readonly FamilyCardItem[] }) {
  return (
    <div className="katakana-speed-family-grid">
      {items.map((item) => (
        <article className="katakana-speed-family-card" key={item.family}>
          <div className="katakana-speed-family-card__top">
            <strong>{item.label}</strong>
            <span
              className={`katakana-speed-status katakana-speed-status--${item.status}`}
            >
              {formatFamilyStatus(item.status)}
            </span>
          </div>
          <p className="katakana-speed-family-card__metric">
            {formatPercent(item.accuracyPercent)} ·{" "}
            {formatDuration(item.medianRtMs)}
          </p>
          <p className="katakana-speed-family-card__focus">
            {item.focusSurfaces.length > 0
              ? item.focusSurfaces.join(" · ")
              : "-"}
          </p>
        </article>
      ))}
    </div>
  );
}

export function ConfusionList({
  items
}: {
  items: readonly ConfusionItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="katakana-speed-muted">Nessuna confusione dominante.</p>
    );
  }

  return (
    <div className="katakana-speed-diagnostic-list">
      {items.map((item) => (
        <article
          className="katakana-speed-diagnostic-row"
          key={`${item.expectedSurface}-${item.observedSurface}`}
        >
          <span className="jp-inline">
            {item.expectedSurface} → {item.observedSurface}
          </span>
          <strong>
            {item.count} · {formatDuration(item.avgRtMs)}
          </strong>
        </article>
      ))}
    </div>
  );
}

export function SlowList({ items }: { items: readonly SlowItem[] }) {
  if (items.length === 0) {
    return <p className="katakana-speed-muted">Nessuna lentezza dominante.</p>;
  }

  return (
    <div className="katakana-speed-diagnostic-list">
      {items.map((item) => (
        <article className="katakana-speed-diagnostic-row" key={item.itemId}>
          <span className="jp-inline">{item.surface}</span>
          <strong>
            {item.count} · {formatDuration(item.medianRtMs)}
          </strong>
        </article>
      ))}
    </div>
  );
}

export function formatPercent(value: number | null) {
  return value === null ? "-" : `${value}%`;
}

/**
 * Formats a duration in milliseconds for user display.
 * - null → "-"
 * - ≥ 1000 ms → "X,X s" (Italian decimal comma)
 * - < 1000 ms → "X ms"
 */
export function formatDuration(value: number | null) {
  if (value === null) {
    return "-";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(".", ",")} s`;
  }

  return `${value} ms`;
}

export function formatFamilyStatus(
  status: "new" | "repair" | "stable" | "watch"
) {
  if (status === "repair") {
    return "Ripara";
  }
  if (status === "watch") {
    return "Osserva";
  }
  if (status === "stable") {
    return "Stabile";
  }

  return "Nuova";
}
