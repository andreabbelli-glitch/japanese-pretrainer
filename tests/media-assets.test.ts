import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/media/[mediaSlug]/assets/[...assetPath]/route";
import { getMediaAssetContentType } from "@/lib/media-assets";

describe("media asset serving", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-media-assets-"));
    await mkdir(
      path.join(tempDir, "content", "media", "fixture", "assets", "audio"),
      {
        recursive: true
      }
    );
    await writeFile(
      path.join(
        tempDir,
        "content",
        "media",
        "fixture",
        "assets",
        "audio",
        "sample.mp3"
      ),
      "ID3-fixture"
    );
    await writeFile(
      path.join(
        tempDir,
        "content",
        "media",
        "fixture",
        "assets",
        "audio",
        "sample.oga"
      ),
      "OggS-fixture"
    );
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns the correct MIME type for supported audio assets", async () => {
    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({
        assetPath: ["audio", "sample.mp3"],
        mediaSlug: "fixture"
      })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Length")).toBe("11");
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(await response.text()).toBe("ID3-fixture");
  });

  it("serves byte-range requests for audio assets", async () => {
    const response = await GET(
      new Request("https://example.test", {
        headers: {
          Range: "bytes=0-2"
        }
      }),
      {
        params: Promise.resolve({
          assetPath: ["audio", "sample.mp3"],
          mediaSlug: "fixture"
        })
      }
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Length")).toBe("3");
    expect(response.headers.get("Content-Range")).toBe("bytes 0-2/11");
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(await response.text()).toBe("ID3");
  });

  it("serves open-ended byte ranges for audio assets", async () => {
    const response = await GET(
      new Request("https://example.test", {
        headers: {
          Range: "bytes=4-"
        }
      }),
      {
        params: Promise.resolve({
          assetPath: ["audio", "sample.mp3"],
          mediaSlug: "fixture"
        })
      }
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Length")).toBe("7");
    expect(response.headers.get("Content-Range")).toBe("bytes 4-10/11");
    expect(await response.text()).toBe("fixture");
  });

  it("rejects unsatisfiable byte ranges for audio assets", async () => {
    const response = await GET(
      new Request("https://example.test", {
        headers: {
          Range: "bytes=99-120"
        }
      }),
      {
        params: Promise.resolve({
          assetPath: ["audio", "sample.mp3"],
          mediaSlug: "fixture"
        })
      }
    );

    expect(response.status).toBe(416);
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Range")).toBe("bytes */11");
  });

  it("ignores unsupported range units instead of rejecting the asset", async () => {
    const response = await GET(
      new Request("https://example.test", {
        headers: {
          Range: "items=0-2"
        }
      }),
      {
        params: Promise.resolve({
          assetPath: ["audio", "sample.mp3"],
          mediaSlug: "fixture"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe("11");
    expect(response.headers.get("Content-Range")).toBeNull();
    expect(await response.text()).toBe("ID3-fixture");
  });

  it("ignores multipart byte ranges when serving local assets", async () => {
    const response = await GET(
      new Request("https://example.test", {
        headers: {
          Range: "bytes=0-2,4-6"
        }
      }),
      {
        params: Promise.resolve({
          assetPath: ["audio", "sample.mp3"],
          mediaSlug: "fixture"
        })
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe("11");
    expect(response.headers.get("Content-Range")).toBeNull();
    expect(await response.text()).toBe("ID3-fixture");
  });

  it("rejects unsupported asset extensions and keeps traversal blocked", async () => {
    expect(getMediaAssetContentType("assets/audio/sample.wav")).toBe(
      "audio/wav"
    );
    expect(getMediaAssetContentType("assets/audio/sample.oga")).toBe(
      "audio/ogg"
    );

    const unsupported = await GET(new Request("https://example.test"), {
      params: Promise.resolve({
        assetPath: ["audio", "sample.flac"],
        mediaSlug: "fixture"
      })
    });
    const traversal = await GET(new Request("https://example.test"), {
      params: Promise.resolve({
        assetPath: ["..", "secret.mp3"],
        mediaSlug: "fixture"
      })
    });

    expect(unsupported.status).toBe(400);
    expect(traversal.status).toBe(400);
  });

  it("rejects traversal through the media slug parameter", async () => {
    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({
        assetPath: ["audio", "sample.mp3"],
        mediaSlug: ".."
      })
    });

    expect(response.status).toBe(400);
  });

  it("serves .oga audio assets with the correct MIME type", async () => {
    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({
        assetPath: ["audio", "sample.oga"],
        mediaSlug: "fixture"
      })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/ogg");
    expect(await response.text()).toBe("OggS-fixture");
  });
});
