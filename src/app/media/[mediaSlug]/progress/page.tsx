import { redirect } from "next/navigation";

import { mediaHref } from "@/lib/site";

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
