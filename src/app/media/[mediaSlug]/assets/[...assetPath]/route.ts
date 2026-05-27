import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  getMediaAssetContentType,
  isSupportedMediaAssetPath,
  isValidMediaAssetPath,
  isValidMediaSlugSegment,
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

type ByteRange = {
  end: number;
  start: number;
};

type ByteRangeParseResult =
  | {
      kind: "ignore";
    }
  | {
      kind: "range";
      range: ByteRange;
    }
  | {
      kind: "unsatisfiable";
    };

const CACHE_CONTROL_HEADER = "public, max-age=31536000, immutable";

export async function GET(request: Request, context: RouteContext) {
  const { assetPath, mediaSlug } = await context.params;

  if (!isValidMediaSlugSegment(mediaSlug)) {
    return new Response("Invalid media slug.", {
      status: 400
    });
  }

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
    const contentType = getMediaAssetContentType(joinedAssetPath);
    const fileSize = file.byteLength;
    const headers = {
      "Accept-Ranges": "bytes",
      "Cache-Control": CACHE_CONTROL_HEADER,
      "Content-Type": contentType
    };
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const rangeResult = parseSingleByteRange(rangeHeader, fileSize);

      if (rangeResult.kind === "unsatisfiable") {
        return new Response("Range not satisfiable.", {
          headers: {
            ...headers,
            "Cache-Control": "no-store",
            "Content-Range": `bytes */${fileSize}`
          },
          status: 416
        });
      }

      if (rangeResult.kind === "range") {
        const { range } = rangeResult;
        const partial = file.subarray(range.start, range.end + 1);

        return new Response(partial, {
          headers: {
            ...headers,
            "Content-Length": String(partial.byteLength),
            "Content-Range": `bytes ${range.start}-${range.end}/${fileSize}`
          },
          status: 206
        });
      }
    }

    return new Response(file, {
      headers: {
        ...headers,
        "Content-Length": String(fileSize)
      }
    });
  } catch {
    return new Response("Not found.", {
      status: 404
    });
  }
}

function parseSingleByteRange(
  rangeHeader: string,
  fileSize: number
): ByteRangeParseResult {
  const trimmedRangeHeader = rangeHeader.trim();

  if (!trimmedRangeHeader.toLowerCase().startsWith("bytes=")) {
    return { kind: "ignore" };
  }

  const rangeSet = trimmedRangeHeader.slice("bytes=".length);

  if (rangeSet.includes(",")) {
    return { kind: "ignore" };
  }

  const match = /^(\d*)-(\d*)$/.exec(rangeSet);

  if (!match) {
    return { kind: "ignore" };
  }

  const [, startRaw, endRaw] = match;

  if (startRaw === "" && endRaw === "") {
    return { kind: "ignore" };
  }

  if (startRaw === "") {
    const suffixLength = parseRangeNumber(endRaw);

    if (suffixLength === null || suffixLength <= 0 || fileSize === 0) {
      return { kind: "unsatisfiable" };
    }

    return {
      kind: "range",
      range: {
        end: fileSize - 1,
        start: Math.max(fileSize - suffixLength, 0)
      }
    };
  }

  const start = parseRangeNumber(startRaw);

  if (start === null || start >= fileSize) {
    return { kind: "unsatisfiable" };
  }

  const requestedEnd = endRaw === "" ? fileSize - 1 : parseRangeNumber(endRaw);

  if (requestedEnd === null || requestedEnd < start) {
    return { kind: "unsatisfiable" };
  }

  return {
    kind: "range",
    range: {
      end: Math.min(requestedEnd, fileSize - 1),
      start
    }
  };
}

function parseRangeNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
