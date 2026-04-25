import { notFound } from "next/navigation";

import { TextbookIndexPage } from "@/components/textbook/textbook-index-page";
import { getTextbookIndexData } from "@/features/textbook/server";

type StudyAreaRouteProps = {
  params: Promise<{
    mediaSlug: string;
  }>;
};

export default async function MediaTextbookRoute({
  params
}: StudyAreaRouteProps) {
  const { mediaSlug } = await params;
  const data = await getTextbookIndexData(mediaSlug);

  if (!data) {
    notFound();
  }

  return <TextbookIndexPage data={data} />;
}
