import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AddToReviewForm,
  AttentionCallout,
  QuickRecognitionBox,
  RelatedCardsList,
  RelatedItemsList,
  RevealTranslation,
  SentenceBreakdown,
} from "@/src/components/learning";
import { getCards, getExamples, getLessonBySlug, getLessons, getItems } from "@/src/domain/content";
import { createClient } from "@/src/lib/supabase/server";
import { LessonProgressControls } from "./lesson-progress-controls";

function renderLessonBody(body: string) {
  const sections = body
    .split("## ")
    .map((block) => block.trim())
    .filter(Boolean);

  return sections.map((section) => {
    const [title, ...lines] = section.split("\n").filter(Boolean);
    return (
      <section key={title} className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {lines.map((line, index) => (
          <p key={`${title}-${index}`} className="text-sm text-slate-700">
            {line}
          </p>
        ))}
      </section>
    );
  });
}

export default async function LessonDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = getLessonBySlug(slug);

  if (!lesson) {
    notFound();
  }

  const lessons = getLessons();
  const currentIndex = lessons.findIndex((candidate) => candidate.id === lesson.id);
  const previousLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  const items = getItems().filter((item) => lesson.itemIds.includes(item.id));
  const cards = getCards().filter((card) => lesson.cardIds.includes(card.id));
  const examples = getExamples().filter((example) => example.lessonIds.includes(lesson.id)).slice(0, 3);

  let lessonStatus: "not_started" | "in_progress" | "completed" = "not_started";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = (await supabase
        .from("lesson_progress")
        .select("status")
        .eq("user_id", user.id)
        .eq("lesson_id", lesson.id)
        .maybeSingle()) as { data: { status: "not_started" | "in_progress" | "completed" } | null };

      if (data) {
        lessonStatus = data.status;
      }
    }
  } catch {
    lessonStatus = "not_started";
  }

  return (
    <article className="space-y-5">
      <header className="space-y-2 rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{lesson.id}</p>
        <h1 className="text-2xl font-semibold text-slate-900">{lesson.title}</h1>
        <p className="text-sm text-slate-700">{lesson.summary}</p>
      </header>

      <LessonProgressControls lessonId={lesson.id} lessonSlug={lesson.slug} currentStatus={lessonStatus} />

      {renderLessonBody(lesson.body)}

      <QuickRecognitionBox
        prompt="Quando leggi una carta, cerca prima i 5 segnali chiave."
        clues={[
          "Trigger: 出た時 / 攻撃する時 / ターンのはじめに",
          "Bersaglio: 相手のクリーチャーを1体",
          "Movimento: 山札→墓地 / 墓地→バトルゾーン",
          "Limite numerico: 以上 / 以下 / 合計",
          "Vincoli: ただし / できない / なければ",
        ]}
      />

      {cards[0] ? (
        <SentenceBreakdown
          sentence={cards[0].keySentenceJa}
          chunks={cards[0].keySentenceJa.split("/").map((part) => ({
            part: part.trim(),
            explanation: "Individua questo blocco e collegalo a trigger, target o vincolo della carta.",
          }))}
        />
      ) : null}

      {cards[0] ? <RevealTranslation translation={cards[0].quickSenseIt} /> : null}

      <AttentionCallout title="Errore comune da evitare">
        Non tradurre parola per parola dall&apos;inizio alla fine. Prima individua struttura (trigger/target/movimento) e solo dopo
        completa il significato.
      </AttentionCallout>

      {examples.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Micro-drill rapido</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            {examples.map((example) => (
              <li key={example.id} className="rounded-md bg-slate-50 p-3">
                <p className="font-medium text-slate-900">{example.textJa}</p>
                <p>{example.glossIt}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}


      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">CTA review rapida</h2>
        <p className="text-sm text-slate-700">Aggiungi 3 item chiave della lezione alla review di oggi.</p>
        <div className="flex flex-wrap gap-2">
          {items.slice(0, 3).map((item) => (
            <AddToReviewForm key={item.id} itemId={item.id} compact />
          ))}
        </div>
      </section>

      <RelatedItemsList items={items.slice(0, 10)} />
      <RelatedCardsList cards={cards} />

      <nav className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        {previousLesson ? (
          <Link href={`/lessons/${previousLesson.slug}` as Route} className="rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-100">
            ← Lezione precedente
          </Link>
        ) : (
          <span className="text-slate-400">Inizio percorso</span>
        )}
        {nextLesson ? (
          <Link href={`/lessons/${nextLesson.slug}` as Route} className="rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-100">
            Lezione successiva →
          </Link>
        ) : (
          <span className="text-slate-400">Fine percorso</span>
        )}
      </nav>
    </article>
  );
}
