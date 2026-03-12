import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET } from "@/app/media/[mediaSlug]/assets/[...assetPath]/route";
import { getMediaAssetContentType } from "@/lib/media-assets";

describe("media asset serving", () => {
  let originalCwd = "";
  let tempDir = "";

  beforeEach(async () => {
    originalCwd = process.cwd();
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
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
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
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
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
