import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const sourceLineLimit = 1000;
const testLineLimit = 1500;
const cssLineLimit = 1600;

export type FileSizeViolation = {
  limit: number;
  lineCount: number;
  path: string;
};

export type FileSizeCheckOptions = {
  baseRef?: string;
};

export function getLineLimitForPath(candidate: string) {
  const normalized = normalizeGitPath(candidate);

  if (/\.css$/u.test(normalized)) {
    return cssLineLimit;
  }

  if (normalized.startsWith("tests/")) {
    return testLineLimit;
  }

  return sourceLineLimit;
}

export function isFileSizeCheckedPath(candidate: string) {
  const normalized = normalizeGitPath(candidate);

  if (
    !(
      normalized.startsWith("src/") ||
      normalized.startsWith("scripts/") ||
      normalized.startsWith("tests/")
    )
  ) {
    return false;
  }

  if (
    normalized.endsWith(".d.ts") ||
    /\.generated\.[^/]+$/u.test(normalized) ||
    /(?:^|\/)generated\//u.test(normalized)
  ) {
    return false;
  }

  return /\.(?:css|cjs|js|mjs|ts|tsx)$/u.test(normalized);
}

export async function findLargeTouchedFiles(
  repositoryRoot: string,
  changedPaths?: string[],
  options: FileSizeCheckOptions = {}
) {
  const candidates =
    changedPaths ?? (await readChangedGitPaths(repositoryRoot, options));
  const violations: FileSizeViolation[] = [];

  for (const candidate of dedupeNormalizedPaths(candidates)) {
    if (!isFileSizeCheckedPath(candidate)) {
      continue;
    }

    const absolutePath = path.join(repositoryRoot, candidate);
    let source: string;

    try {
      source = await readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    const lineCount = countLines(source);
    const limit = getLineLimitForPath(candidate);

    if (lineCount > limit) {
      violations.push({
        limit,
        lineCount,
        path: candidate
      });
    }
  }

  return violations.sort((left, right) => left.path.localeCompare(right.path));
}

async function readChangedGitPaths(
  repositoryRoot: string,
  options: FileSizeCheckOptions
) {
  const baseRef = options.baseRef ?? "HEAD";
  const [tracked, untracked] = await Promise.all([
    execGit(repositoryRoot, [
      "diff",
      "--name-only",
      "--diff-filter=ACMRTUXB",
      baseRef
    ]),
    execGit(repositoryRoot, ["ls-files", "--others", "--exclude-standard"])
  ]);

  return [...splitGitPaths(tracked), ...splitGitPaths(untracked)];
}

async function execGit(repositoryRoot: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: repositoryRoot,
    maxBuffer: 10 * 1024 * 1024
  });

  return stdout;
}

function splitGitPaths(stdout: string) {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function dedupeNormalizedPaths(paths: string[]) {
  return [...new Set(paths.map(normalizeGitPath))];
}

function normalizeGitPath(candidate: string) {
  return candidate.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function countLines(source: string) {
  if (source.length === 0) {
    return 0;
  }

  return source.replace(/(?:\r\n|\r|\n)$/u, "").split(/\r\n|\r|\n/u).length;
}

function readCliOptions(argv: string[]): FileSizeCheckOptions {
  const options: FileSizeCheckOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--base") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("Missing value for --base.");
      }

      options.baseRef = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

async function runCli() {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
  );
  const violations = await findLargeTouchedFiles(
    repositoryRoot,
    undefined,
    readCliOptions(process.argv.slice(2))
  );

  if (violations.length === 0) {
    console.info("file-size:check passed.");
    return;
  }

  console.error(
    "Large touched files exceed the agentic maintainability limit. Split the touched file into focused modules before landing the change."
  );

  for (const violation of violations) {
    console.error(
      `- ${violation.path}: ${violation.lineCount} lines, limit ${violation.limit}`
    );
  }

  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
