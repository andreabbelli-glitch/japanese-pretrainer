import { readFileSync } from "node:fs";

import type { CollectedReference } from "../types.ts";

export type SourceLineResolver = (
  reference: CollectedReference
) => number | undefined;

export function createSourceLineResolver(
  references: CollectedReference[]
): SourceLineResolver {
  const cache = new Map<string, CachedSourceFile>();
  const resolvedLines = resolveReferenceLines(references, cache);

  return (reference) => {
    const resolvedLine = resolvedLines.get(reference);

    if (resolvedLine !== undefined) {
      return resolvedLine;
    }

    const reportedLine = reference.location?.start.line;

    if (reportedLine === undefined) {
      return undefined;
    }

    const source = readCachedSource(reference.sourceFile, cache);
    const targetToken = buildReferenceTargetToken(reference);
    const candidates = buildCandidateLines(reference, source);
    const verifiedLine = resolveVerifiedReferenceLine(
      reference,
      source,
      targetToken
    );

    if (verifiedLine !== undefined) {
      return verifiedLine;
    }

    return (
      findNearestSourceLine(source, targetToken, candidates) ?? reportedLine
    );
  };
}

function resolveReferenceLines(
  references: CollectedReference[],
  cache: Map<string, CachedSourceFile>
) {
  const lineByReference = new WeakMap<CollectedReference, number>();
  const referencesByToken = new Map<string, CollectedReference[]>();

  for (const reference of references) {
    const token = buildReferenceTargetToken(reference);
    const key = `${reference.sourceFile}\0${token}`;
    const existing = referencesByToken.get(key) ?? [];

    existing.push(reference);
    referencesByToken.set(key, existing);
  }

  for (const [key, groupedReferences] of referencesByToken) {
    const [sourceFile, token] = key.split("\0") as [string, string];
    const source = readCachedSource(sourceFile, cache);
    const occurrences = collectTokenLineOccurrences(source, token);
    const unresolvedReferences: CollectedReference[] = [];

    for (const reference of groupedReferences) {
      const verifiedLine = resolveVerifiedReferenceLine(
        reference,
        source,
        token
      );

      if (verifiedLine === undefined) {
        unresolvedReferences.push(reference);
        continue;
      }

      lineByReference.set(reference, verifiedLine);
      consumeLineOccurrence(occurrences, verifiedLine);
    }

    const orderedReferences = unresolvedReferences
      .slice()
      .sort(compareSourcePaths);

    for (const [index, reference] of orderedReferences.entries()) {
      const line = occurrences[index];

      if (line !== undefined) {
        lineByReference.set(reference, line);
      }
    }
  }

  return lineByReference;
}

function buildCandidateLines(
  reference: CollectedReference,
  source: CachedSourceFile
) {
  const reportedLine = reference.location?.start.line;

  if (reportedLine === undefined) {
    return [];
  }

  return [reportedLine, reportedLine + source.frontmatterLineOffset];
}

function resolveVerifiedReferenceLine(
  reference: CollectedReference,
  source: CachedSourceFile,
  token: string
) {
  return buildCandidateLines(reference, source).find((candidate) =>
    sourceLineContains(source.lines, candidate, token)
  );
}

function consumeLineOccurrence(occurrences: number[], line: number) {
  const index = occurrences.indexOf(line);

  if (index >= 0) {
    occurrences.splice(index, 1);
  }
}

function buildReferenceTargetToken(reference: CollectedReference) {
  return `(${reference.referenceType}:${reference.targetId})`;
}

type CachedSourceFile = {
  frontmatterLineOffset: number;
  lines: string[];
  tokenLineCache: Map<string, number[]>;
};

function readCachedSource(
  filePath: string,
  cache: Map<string, CachedSourceFile>
) {
  const cached = cache.get(filePath);

  if (cached) {
    return cached;
  }

  try {
    const source = readFileSync(filePath, "utf8").replaceAll("\r\n", "\n");
    const result = {
      frontmatterLineOffset: readFrontmatterLineOffset(source),
      lines: source.split("\n"),
      tokenLineCache: new Map<string, number[]>()
    };

    cache.set(filePath, result);
    return result;
  } catch {
    const result = {
      frontmatterLineOffset: 0,
      lines: [],
      tokenLineCache: new Map<string, number[]>()
    };

    cache.set(filePath, result);
    return result;
  }
}

function findNearestSourceLine(
  source: CachedSourceFile,
  token: string,
  candidateLines: number[]
) {
  const matchingLines = collectTokenLines(source, token);

  if (matchingLines.length === 0) {
    return undefined;
  }

  return matchingLines.slice().sort((left, right) => {
    const leftDistance = readClosestDistance(left, candidateLines);
    const rightDistance = readClosestDistance(right, candidateLines);

    return leftDistance - rightDistance || left - right;
  })[0];
}

function collectTokenLines(source: CachedSourceFile, token: string) {
  const cached = source.tokenLineCache.get(token);

  if (cached) {
    return cached;
  }

  const lines = collectTokenLineOccurrences(source, token);

  source.tokenLineCache.set(token, lines);
  return lines;
}

function collectTokenLineOccurrences(source: CachedSourceFile, token: string) {
  const lines: number[] = [];

  for (const [index, line] of source.lines.entries()) {
    let searchStart = 0;

    while (searchStart < line.length) {
      const matchIndex = line.indexOf(token, searchStart);

      if (matchIndex < 0) {
        break;
      }

      lines.push(index + 1);
      searchStart = matchIndex + token.length;
    }
  }

  return lines;
}

function compareSourcePaths(
  left: CollectedReference,
  right: CollectedReference
) {
  return (
    compareNaturalText(left.sourcePath, right.sourcePath) ||
    readReferenceLine(left) - readReferenceLine(right)
  );
}

function compareNaturalText(left: string, right: string) {
  const leftParts = left.split(/(\d+)/u);
  const rightParts = right.split(/(\d+)/u);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? "";
    const rightPart = rightParts[index] ?? "";
    const leftNumber = readNumericPart(leftPart);
    const rightNumber = readNumericPart(rightPart);
    const difference =
      leftNumber !== null && rightNumber !== null
        ? leftNumber - rightNumber
        : leftPart.localeCompare(rightPart);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function readNumericPart(value: string) {
  return /^\d+$/u.test(value) ? Number.parseInt(value, 10) : null;
}

function readClosestDistance(line: number, candidates: number[]) {
  return Math.min(...candidates.map((candidate) => Math.abs(line - candidate)));
}

function readReferenceLine(reference: CollectedReference) {
  return reference.location?.start.line ?? Number.MAX_SAFE_INTEGER;
}

function readFrontmatterLineOffset(source: string) {
  const lines = source.split("\n");

  if (lines[0] !== "---") {
    return 0;
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---"
  );

  return closingIndex >= 0 ? closingIndex + 1 : 0;
}

function sourceLineContains(lines: string[], line: number, token: string) {
  return lines[line - 1]?.includes(token) ?? false;
}
