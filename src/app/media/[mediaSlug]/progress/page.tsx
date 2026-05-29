import { redirect } from "next/navigation";

import { mediaHref } from "@/features/navigation";

type StudyAreaRouteProps = {
  params: Promise<{
    mediaSlug: string;
  }>;
};

export default async function MediaProgressRoute({
  params
}: StudyAreaRouteProps) {
  const { mediaSlug } = await params;

  redirect(`${mediaHref(mediaSlug)}#overview`);
}
