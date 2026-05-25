import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  estimatePitchGraphFromPcm,
  validatePitchAccentMinimalPairsCorpus,
  type PitchAccentMinimalPairsCorpus,
  type PitchAccentPitchGraphManifest
} from "../model/index.ts";

const execFileAsync = promisify(execFile);
const defaultSampleRate = 16_000;

export type GeneratePitchGraphManifestResult = {
  readonly audioCount: number;
  readonly manifestPath: string;
  readonly outputPath: string;
};

export async function generatePitchGraphManifestForCorpus(input: {
  readonly concurrency?: number;
  readonly manifestPath: string;
  readonly outPath: string;
  readonly publicDir?: string;
  readonly requiredAudioSrcPrefix?: string;
  readonly sampleRate?: number;
}): Promise<GeneratePitchGraphManifestResult> {
  const corpus = await readPitchAccentCorpusManifest(input.manifestPath, {
    requiredAudioSrcPrefix: input.requiredAudioSrcPrefix
  });
  const publicDir = path.resolve(input.publicDir ?? "public");
  const sampleRate = input.sampleRate ?? defaultSampleRate;
  const audioSources = collectCorpusAudioSources(corpus);
  const entries = await mapWithConcurrency(
    audioSources,
    input.concurrency ?? 4,
    async (audioSrc) => {
      const audioPath = resolvePublicAudioPath(publicDir, audioSrc);
      const samples = await decodeAudioToFloat32Pcm(audioPath, sampleRate);
      const graph = estimatePitchGraphFromPcm(samples, sampleRate);

      return [audioSrc, graph] as const;
    }
  );
  const manifest: PitchAccentPitchGraphManifest = {
    graphs: Object.fromEntries(entries),
    version: 1
  };

  await mkdir(path.dirname(input.outPath), { recursive: true });
  await writeFile(input.outPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    audioCount: entries.length,
    manifestPath: input.manifestPath,
    outputPath: input.outPath
  };
}

async function readPitchAccentCorpusManifest(
  manifestPath: string,
  options: {
    readonly requiredAudioSrcPrefix?: string;
  }
) {
  const source = await readFile(manifestPath, "utf8");
  const corpus = JSON.parse(source) as PitchAccentMinimalPairsCorpus;
  const validation = validatePitchAccentMinimalPairsCorpus(corpus, {
    allowedAudioSrcPrefixes: options.requiredAudioSrcPrefix
      ? [options.requiredAudioSrcPrefix]
      : undefined
  });

  if (!validation.ok) {
    throw new Error(
      `Pitch accent corpus is invalid: ${validation.errors.join("; ")}`
    );
  }

  return corpus;
}

function collectCorpusAudioSources(corpus: PitchAccentMinimalPairsCorpus) {
  return [
    ...new Set(
      corpus.pairs.flatMap((pair) =>
        pair.options.map((option) => option.audioSrc)
      )
    )
  ].sort((left, right) => left.localeCompare(right));
}

function resolvePublicAudioPath(publicDir: string, audioSrc: string) {
  if (!audioSrc.startsWith("/")) {
    throw new Error(`${audioSrc} must be an absolute public audio source.`);
  }

  const resolvedPath = path.resolve(publicDir, audioSrc.slice(1));

  if (!isPathInsideDirectory(resolvedPath, publicDir)) {
    throw new Error(`${audioSrc} resolves outside the public directory.`);
  }

  return resolvedPath;
}

async function decodeAudioToFloat32Pcm(audioPath: string, sampleRate: number) {
  const { stdout } = (await execFileAsync(
    "ffmpeg",
    [
      "-nostdin",
      "-v",
      "error",
      "-i",
      audioPath,
      "-ac",
      "1",
      "-ar",
      String(sampleRate),
      "-f",
      "f32le",
      "-"
    ],
    {
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024
    }
  )) as { readonly stdout: Buffer };

  const pcmBytes = stdout.buffer.slice(
    stdout.byteOffset,
    stdout.byteOffset + stdout.byteLength
  );

  return new Float32Array(pcmBytes);
}

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<U>
) {
  const normalizedConcurrency = Math.max(1, Math.floor(concurrency));
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from(
      { length: Math.min(normalizedConcurrency, items.length) },
      async () => {
        for (;;) {
          const index = nextIndex;
          nextIndex += 1;

          if (index >= items.length) {
            return;
          }

          results[index] = await worker(items[index]!);
        }
      }
    )
  );

  return results;
}

function isPathInsideDirectory(candidatePath: string, directoryPath: string) {
  const relativePath = path.relative(directoryPath, candidatePath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}
