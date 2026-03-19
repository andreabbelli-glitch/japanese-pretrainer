import { connection } from "next/server";

import { MediaLibraryPage } from "@/components/media/media-library-page";

export default async function MediaPage() {
  await connection();

  return <MediaLibraryPage />;
}
