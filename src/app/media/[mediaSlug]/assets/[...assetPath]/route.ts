import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  getMediaAssetContentType,
  isSupportedMediaAssetPath,
  isValidMediaAssetPath,
  isWithinMediaAssetRoot,
  normalizeMediaAssetPath,
  resolveMediaAssetAbsolutePath
} from "@/lib/media-assets";

type RouteContext = {
  params: Promise<{
    mediaSlug: string;
    assetPath: string[];
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { assetPath, mediaSlug } = await context.params;
  const joinedAssetPath = normalizeMediaAssetPath(assetPath.join("/"));

  if (!isValidMediaAssetPath(joinedAssetPath)) {
    return new Response("Invalid asset path.", {
      status: 400
    });
  }

  if (!isSupportedMediaAssetPath(joinedAssetPath)) {
    return new Response("Unsupported asset type.", {
      status: 400
    });
  }

  const mediaDirectory = path.resolve(
    process.cwd(),
    "content",
    "media",
    mediaSlug
  );
  const resolvedPath = resolveMediaAssetAbsolutePath(
    mediaDirectory,
    joinedAssetPath
  );

  if (
    !isWithinMediaAssetRoot(
      resolvedPath.assetRoot,
      resolvedPath.absolutePath
    )
  ) {
    return new Response("Invalid asset path.", {
      status: 400
    });
  }

  try {
    const file = await readFile(resolvedPath.absolutePath);

    return new Response(file, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": getMediaAssetContentType(joinedAssetPath)
      }
    });
  } catch {
    return new Response("Not found.", {
      status: 404
    });
  }
}
