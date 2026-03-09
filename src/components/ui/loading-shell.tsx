import { SurfaceCard } from "./surface-card";

type LoadingShellProps = {
  title: string;
  summary: string;
};

export function LoadingShell({ title, summary }: LoadingShellProps) {
  return (
    <div className="loading-shell">
      <SurfaceCard className="loading-shell__hero" variant="hero">
        <div className="loading-line loading-line--eyebrow" />
        <div className="loading-line loading-line--title" />
        <div className="loading-line loading-line--body" />
        <div className="loading-shell__sr">
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
      </SurfaceCard>
      <div className="loading-shell__grid">
        <SurfaceCard className="loading-shell__card">
          <div className="loading-line loading-line--title" />
          <div className="loading-line loading-line--body" />
          <div className="loading-line loading-line--body-short" />
        </SurfaceCard>
        <SurfaceCard className="loading-shell__card">
          <div className="loading-line loading-line--title" />
          <div className="loading-line loading-line--body" />
          <div className="loading-line loading-line--body-short" />
        </SurfaceCard>
      </div>
    </div>
  );
}
