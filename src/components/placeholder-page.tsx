import type { PlaceholderSection } from "@/lib/site";

type PlaceholderPageProps = {
  kicker: string;
  title: string;
  summary: string;
  sections: readonly PlaceholderSection[];
};

export function PlaceholderPage({
  kicker,
  title,
  summary,
  sections
}: PlaceholderPageProps) {
  return (
    <div className="placeholder-page">
      <section className="panel panel--hero">
        <div className="eyebrow">{kicker}</div>
        <h1>{title}</h1>
        <p className="hero-summary">{summary}</p>
      </section>

      <section className="placeholder-grid">
        {sections.map((section) => (
          <article key={section.title} className="panel">
            <h2>{section.title}</h2>
            <p className="panel-note">{section.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
