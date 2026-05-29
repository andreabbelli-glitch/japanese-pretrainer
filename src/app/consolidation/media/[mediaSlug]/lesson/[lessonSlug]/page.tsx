import { notFound } from "next/navigation";

import { ConsolidationSessionClient } from "@/components/consolidation/consolidation-session-client";
import { getConsolidationSessionData } from "@/features/consolidation/server";

export const dynamic = "force-dynamic";

type ConsolidationLessonRouteProps = {
  params: Promise<{
    lessonSlug: string;
    mediaSlug: string;
  }>;
};

export default async function ConsolidationLessonRoute({
  params
}: ConsolidationLessonRouteProps) {
  const { lessonSlug, mediaSlug } = await params;
  const data = await getConsolidationSessionData({ lessonSlug, mediaSlug });

  if (!data) {
    notFound();
  }

  return (
    <ConsolidationSessionClient
      data={data}
      key={`${data.media.id}:${data.lesson.id}`}
    />
  );
}
