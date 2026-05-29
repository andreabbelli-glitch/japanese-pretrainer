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

const supportedAudioExtensions = new Set([
  ".mp3",
  ".ogg",
  ".oga",
  ".wav",
  ".m4a"
]);

export function normalizeMediaAssetPath(assetPath: string) {
  return assetPath.replaceAll("\\", "/").trim();
}

export function isValidMediaSlugSegment(mediaSlug: string) {
  const normalized = mediaSlug.trim();

  return (
    normalized.length > 0 &&
    !normalized.includes("/") &&
    !normalized.includes("\\") &&
    normalized !== "." &&
    normalized !== ".."
  );
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

  return (
    supportedImageExtensions.has(extension) ||
    supportedAudioExtensions.has(extension)
  );
}

export function isSupportedAudioAssetPath(assetPath: string) {
  const extension = path.extname(normalizeMediaAssetPath(assetPath)).toLowerCase();

  return supportedAudioExtensions.has(extension);
}

export function isSupportedImageAssetPath(assetPath: string) {
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
    case ".mp3":
      return "audio/mpeg";
    case ".ogg":
    case ".oga":
      return "audio/ogg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}
