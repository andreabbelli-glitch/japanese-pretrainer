import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  agentOrientationPath,
  checkAgentOrientation
} from "./generate-agent-orientation.ts";

const execFileAsync = promisify(execFile);

export type SkillDocument = {
  path: string;
  source: string;
};

export type AgentCheckFailure = {
  label: string;
  message: string;
  details?: string[];
};

export type AgentCheckOptions = {
  allowProtectedPaths?: boolean;
};

export type AgentCheckResult = {
  ok: boolean;
  failures: AgentCheckFailure[];
};

export const trackedDiffArgs = [
  "diff",
  "--name-only",
  "--diff-filter=ACDMRTUXB",
  "HEAD"
];

const contentFormatPath = path.join("docs", "content-format.md");
const llmKitContentFormatPath = path.join(
  "docs",
  "llm-kit",
  "general",
  "01-content-format.md"
);

export function hasExactVerificationHeading(source: string) {
  return /^## Verification$/m.test(source);
}

export function findMissingSkillVerificationSections(skills: SkillDocument[]) {
  return skills
    .filter((skill) => !hasExactVerificationHeading(skill.source))
    .map((skill) => normalizeGitPath(skill.path));
}

export function findProtectedPathChanges(paths: string[]) {
  const seen = new Set<string>();
  const protectedPaths: string[] = [];

  for (const candidate of paths) {
    const normalized = normalizeGitPath(candidate);

    if (seen.has(normalized) || !isProtectedPath(normalized)) {
      continue;
    }

    seen.add(normalized);
    protectedPaths.push(normalized);
  }

  return protectedPaths;
}

export function contentsMatchByteForByte(left: string, right: string) {
  return left === right;
}

export async function runAgentChecks(
  repositoryRoot: string,
  options: AgentCheckOptions = {}
): Promise<AgentCheckResult> {
  const failures: AgentCheckFailure[] = [];

  if (!(await checkAgentOrientation(repositoryRoot))) {
    failures.push({
      label: "agent orientation",
      message: `${agentOrientationPath} is out of date. Run ./scripts/with-node.sh pnpm docs:agent-orientation.`
    });
  }

  const missingSkillVerification = findMissingSkillVerificationSections(
    await readRepoScopedSkills(repositoryRoot)
  );

  if (missingSkillVerification.length > 0) {
    failures.push({
      label: "skill verification",
      message: "Repo-scoped skills must include an exact ## Verification heading.",
      details: missingSkillVerification
    });
  }

  const protectedPathChanges = findProtectedPathChanges(
    await readChangedGitPaths(repositoryRoot)
  );

  if (protectedPathChanges.length > 0 && !options.allowProtectedPaths) {
    failures.push({
      label: "protected paths",
      message:
        "Protected paths changed. Pass --allow-protected-paths only for explicit content, workflow, or generated DB tasks.",
      details: protectedPathChanges
    });
  }

  const [contentFormat, llmKitContentFormat] = await Promise.all([
    readFile(path.join(repositoryRoot, contentFormatPath), "utf8"),
    readFile(path.join(repositoryRoot, llmKitContentFormatPath), "utf8")
  ]);

  if (!contentsMatchByteForByte(contentFormat, llmKitContentFormat)) {
    failures.push({
      label: "LLM kit drift",
      message: `${llmKitContentFormatPath} must match ${contentFormatPath} byte-for-byte.`
    });
  }

  return {
    ok: failures.length === 0,
    failures
  };
}

async function readRepoScopedSkills(repositoryRoot: string) {
  const skillsRoot = path.join(repositoryRoot, ".agents", "skills");
  let entries: string[];

  try {
    entries = await readdir(skillsRoot);
  } catch {
    return [];
  }

  const skills = await Promise.all(
    entries.map(async (entry): Promise<SkillDocument | null> => {
      const skillPath = path.join(".agents", "skills", entry, "SKILL.md");

      try {
        return {
          path: skillPath,
          source: await readFile(path.join(repositoryRoot, skillPath), "utf8")
        };
      } catch {
        return null;
      }
    })
  );

  return skills
    .filter((skill): skill is SkillDocument => skill !== null)
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function readChangedGitPaths(repositoryRoot: string) {
  const [tracked, untracked] = await Promise.all([
    execGit(repositoryRoot, trackedDiffArgs),
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

function isProtectedPath(candidate: string) {
  return (
    candidate === "content" ||
    candidate.startsWith("content/") ||
    candidate === "drizzle" ||
    candidate.startsWith("drizzle/")
  );
}

function normalizeGitPath(candidate: string) {
  return candidate.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

async function runCli() {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
  );
  const result = await runAgentChecks(repositoryRoot, {
    allowProtectedPaths: process.argv.includes("--allow-protected-paths")
  });

  if (result.ok) {
    console.info("agent:check passed.");
    return;
  }

  for (const failure of result.failures) {
    console.error(`[${failure.label}] ${failure.message}`);

    for (const detail of failure.details ?? []) {
      console.error(`- ${detail}`);
    }
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
