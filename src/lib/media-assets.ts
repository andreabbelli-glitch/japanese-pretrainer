import path from "node:path";

const supportedImageExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".avif"
]);

export function normalizeMediaAssetPath(assetPath: string) {
  return assetPath.replaceAll("\\", "/").trim();
}

export function isValidMediaAssetPath(assetPath: string) {
  const normalized = normalizeMediaAssetPath(assetPath);

  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.startsWith("./") ||
    normalized.includes("?") ||
    normalized.includes("#")
  ) {
    return false;
  }

  const segments = normalized.split("/");

  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== ".."
  );
}

export function isSupportedMediaAssetPath(assetPath: string) {
  const extension = path.extname(normalizeMediaAssetPath(assetPath)).toLowerCase();

  return supportedImageExtensions.has(extension);
}

export function resolveMediaAssetAbsolutePath(
  mediaDirectory: string,
  assetPath: string
) {
  const normalized = normalizeMediaAssetPath(assetPath);
  const assetRoot = path.resolve(mediaDirectory, "assets");
  const absolutePath = path.resolve(
    assetRoot,
    normalized.startsWith("assets/") ? normalized.slice("assets/".length) : normalized
  );

  return {
    assetRoot,
    absolutePath
  };
}

export function isWithinMediaAssetRoot(
  assetRoot: string,
  absolutePath: string
) {
  return (
    absolutePath === assetRoot ||
    absolutePath.startsWith(`${assetRoot}${path.sep}`)
  );
}

export function getMediaAssetContentType(assetPath: string) {
  switch (path.extname(normalizeMediaAssetPath(assetPath)).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}
