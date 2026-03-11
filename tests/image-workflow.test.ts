import path from "node:path";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyMediaImageBlocks,
  summarizeMediaImageWorkflow
} from "@/lib/image-workflow";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.resolve(__dirname, "fixtures", "content");
const validContentRoot = path.join(fixturesRoot, "valid", "content");

describe("image workflow", () => {
  let tempDir = "";
  let contentRoot = "";
  let mediaDirectory = "";
  let workflowDirectory = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-image-workflow-"));
    contentRoot = path.join(tempDir, "content");
    mediaDirectory = path.join(contentRoot, "media", "frieren");
    workflowDirectory = path.join(mediaDirectory, "workflow");

    await cp(validContentRoot, contentRoot, { recursive: true });
    await mkdir(workflowDirectory, { recursive: true });
    await writeFile(
      path.join(mediaDirectory, "assets", "episode-01", "frieren-ui.svg"),
      "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" fill=\"#f3e7cd\"/></svg>\n"
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("summarizes pending and applied image workflow records", async () => {
    await writeWorkflowFiles();

    const initialSummary = await summarizeMediaImageWorkflow(mediaDirectory);

    expect(initialSummary.requestsTotal).toBe(1);
    expect(initialSummary.assetsTotal).toBe(1);
    expect(initialSummary.pendingRequestIds).toEqual([]);
    expect(initialSummary.readyToApplyIds).toEqual(["frieren-meal-ref"]);
    expect(initialSummary.appliedIds).toEqual([]);

    await applyMediaImageBlocks(mediaDirectory);

    const appliedSummary = await summarizeMediaImageWorkflow(mediaDirectory);

    expect(appliedSummary.readyToApplyIds).toEqual([]);
    expect(appliedSummary.appliedIds).toEqual(["frieren-meal-ref"]);
  });

  it("applies image blocks idempotently from workflow sidecars", async () => {
    await writeWorkflowFiles();

    const firstResult = await applyMediaImageBlocks(mediaDirectory);

    expect(firstResult.applied).toHaveLength(1);
    expect(firstResult.skippedExisting).toEqual([]);
    expect(firstResult.missingAsset).toEqual([]);
    expect(firstResult.missingAnchor).toEqual([]);
    expect(firstResult.missingLesson).toEqual([]);
    expect(firstResult.orphanedAssets).toEqual([]);

    const lessonPath = path.join(mediaDirectory, "textbook", "001-intro.md");
    const updatedLesson = await readFile(lessonPath, "utf8");

    expect(updatedLesson).toContain(":::image");
    expect(updatedLesson).toContain("src: assets/episode-01/frieren-ui.svg");
    expect(updatedLesson).toContain(
      'alt: "Frieren osserva una tavola apparecchiata."'
    );
    expect(updatedLesson).toContain(
      "Screenshot di riferimento per [食べる](term:term-taberu)."
    );

    const secondResult = await applyMediaImageBlocks(mediaDirectory);

    expect(secondResult.applied).toEqual([]);
    expect(secondResult.skippedExisting).toHaveLength(1);
  });

  async function writeWorkflowFiles() {
    await writeFile(
      path.join(workflowDirectory, "image-requests.yaml"),
      `requests:
  - id: frieren-meal-ref
    lesson_slug: ep01-intro
    anchor: "# Obiettivo"
    kind: app-screen
    priority: medium
    search_hint: >-
      Frieren meal scene
    capture_instructions: >-
      Usa lo screenshot gia presente nel bundle fixture.
    alt_it: >-
      Frieren osserva una tavola apparecchiata.
    caption_it: >-
      Screenshot di riferimento per [食べる](term:term-taberu).
`
    );
    await writeFile(
      path.join(workflowDirectory, "image-assets.yaml"),
      `assets:
  - id: frieren-meal-ref
    src: assets/episode-01/frieren-ui.svg
    source_type: screenshot
    width: 640
    height: 360
`
    );
  }
});
