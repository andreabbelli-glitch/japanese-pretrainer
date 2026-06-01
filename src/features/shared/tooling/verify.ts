import path from "node:path";

export type AgentVerifyMode =
  | "agent"
  | "check"
  | "content"
  | "none"
  | "release"
  | "targeted";

export type AgentVerifyPlan = {
  commands: string[];
  ignoredPaths: string[];
  mode: AgentVerifyMode;
  notes: string[];
  paths: string[];
  reasons: string[];
  schema_version: 1;
  warnings: string[];
};

export type AgentVerifyContentScopeInput = {
  commands: string[];
  notes: string[];
  warnings: string[];
};

const checkCommand = "./scripts/with-node.sh pnpm check";
const releaseCheckCommand = "./scripts/with-node.sh pnpm release:check";
const agentCheckCommand =
  "./scripts/with-node.sh pnpm agent:check -- --allow-protected-paths";
const targetedTestCommandPrefix = "./scripts/with-node.sh pnpm test --";

export function buildAgentVerifyPlan(input: {
  contentScope?: AgentVerifyContentScopeInput | null;
  paths: string[];
}) {
  const normalizedPaths = normalizePaths(input.paths);
  const commands: string[] = [];
  const notes = new Set<string>();
  const reasons = new Set<string>();
  const warnings = new Set<string>();
  const contentPaths = normalizedPaths.filter(isContentMediaPath);
  const testPaths = normalizedPaths.filter(isTestPath);
  const hasTestSupportChange = normalizedPaths.some(isTestSupportPath);
  const hasNonDirectTestSupportChange = normalizedPaths.some(
    (candidate) => isTestSupportPath(candidate) && !isTestPath(candidate)
  );
  const ignoredPaths: string[] = [];

  if (contentPaths.length > 0) {
    if (input.contentScope) {
      commands.push(...input.contentScope.commands);
    } else {
      warnings.add("content media paths require resolved content gates");
    }

    reasons.add("content media files changed");
    notes.add("follow the relevant repo-scoped skill Verification section");

    for (const note of input.contentScope?.notes ?? []) {
      notes.add(note);
    }

    for (const warning of input.contentScope?.warnings ?? []) {
      warnings.add(warning);
    }
  }

  if (normalizedPaths.some(isReleaseSensitivePath)) {
    commands.push(checkCommand, releaseCheckCommand);
    reasons.add("application code or tooling changed");
    reasons.add("release-sensitive app surface changed");
  } else if (normalizedPaths.some(isApplicationCodeOrToolingPath)) {
    commands.push(checkCommand);
    reasons.add("application code or tooling changed");
  } else if (hasNonDirectTestSupportChange) {
    commands.push(checkCommand);
    reasons.add("test support changed");
  } else if (hasTestSupportChange && testPaths.length > 0) {
    commands.push(buildTargetedTestCommand(testPaths));
    reasons.add(
      testPaths.length === normalizedPaths.length
        ? "test-only change"
        : "direct test file changed"
    );
  }

  if (normalizedPaths.some(isAgentFacingPath)) {
    commands.push(agentCheckCommand);
    reasons.add("agent-facing docs or skills changed");
  }

  if (normalizedPaths.some(isAgentOrientationGeneratorPath)) {
    commands.push("./scripts/with-node.sh pnpm docs:agent-orientation:check");
    reasons.add("agent orientation generator changed");
  }

  if (normalizedPaths.some(isGeneratedDatabasePath)) {
    warnings.add(
      "drizzle files are generated; use db:generate instead of hand edits"
    );
  }

  if (
    normalizedPaths.length > 0 &&
    commands.length === 0 &&
    normalizedPaths.every(isDocumentationPath)
  ) {
    reasons.add("documentation-only change");
  }

  for (const candidate of normalizedPaths) {
    if (
      !isContentMediaPath(candidate) &&
      !isDocumentationPath(candidate) &&
      !isTestPath(candidate) &&
      !isTestSupportPath(candidate) &&
      !isApplicationCodeOrToolingPath(candidate) &&
      !isAgentFacingPath(candidate) &&
      !isGeneratedDatabasePath(candidate)
    ) {
      ignoredPaths.push(candidate);
    }
  }

  return {
    commands: unique(commands),
    ignoredPaths,
    mode: resolveMode({
      commands,
      contentPaths,
      normalizedPaths,
      testPaths
    }),
    notes: [...notes].sort(),
    paths: normalizedPaths,
    reasons:
      reasons.size > 0
        ? [...reasons].sort()
        : normalizedPaths.length === 0
          ? ["no changed paths"]
          : [],
    schema_version: 1,
    warnings: [...warnings].sort()
  } satisfies AgentVerifyPlan;
}

export function formatAgentVerifyPlan(plan: AgentVerifyPlan) {
  const lines = [`VERIFY ${plan.mode}`];

  if (plan.commands.length === 0) {
    lines.push("COMMAND none");
  } else {
    for (const command of plan.commands) {
      lines.push(`COMMAND ${command}`);
    }
  }

  for (const reason of plan.reasons) {
    lines.push(`REASON ${reason}`);
  }

  for (const note of plan.notes) {
    lines.push(`NOTE ${note}`);
  }

  for (const warning of plan.warnings) {
    lines.push(`WARNING ${warning}`);
  }

  for (const ignoredPath of plan.ignoredPaths.slice(0, 5)) {
    lines.push(`IGNORED ${ignoredPath}`);
  }

  return `${lines.join("\n")}\n`;
}

function resolveMode(input: {
  commands: string[];
  contentPaths: string[];
  normalizedPaths: string[];
  testPaths: string[];
}): AgentVerifyMode {
  if (input.commands.includes(releaseCheckCommand)) {
    return "release";
  }

  if (input.commands.includes(checkCommand)) {
    return "check";
  }

  if (input.contentPaths.length > 0) {
    return "content";
  }

  if (input.commands.some(isTargetedTestCommand)) {
    return "targeted";
  }

  if (input.commands.includes(agentCheckCommand)) {
    return "agent";
  }

  return "none";
}

function buildTargetedTestCommand(testPaths: string[]) {
  return [targetedTestCommandPrefix, ...testPaths.slice().sort()].join(" ");
}

function isTargetedTestCommand(command: string) {
  return command.startsWith(targetedTestCommandPrefix);
}

function normalizePaths(paths: string[]) {
  return unique(paths.map(normalizePath).filter(Boolean)).sort();
}

function normalizePath(candidate: string) {
  const trimmed = candidate.trim();

  if (trimmed.length === 0) {
    return "";
  }

  const repositoryRoot = process.cwd();
  const resolvedCandidate = path.resolve(trimmed);
  const relativeCandidate = path
    .relative(repositoryRoot, resolvedCandidate)
    .replaceAll("\\", "/");

  if (
    relativeCandidate.length > 0 &&
    !relativeCandidate.startsWith("..") &&
    !path.isAbsolute(relativeCandidate)
  ) {
    return relativeCandidate.replace(/\/+$/, "");
  }

  return trimmed
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function isContentMediaPath(candidate: string) {
  return (
    candidate === "content/media" || candidate.startsWith("content/media/")
  );
}

function isDocumentationPath(candidate: string) {
  return candidate === "AGENTS.md" || candidate.startsWith("docs/");
}

function isTestPath(candidate: string) {
  return candidate.startsWith("tests/") && candidate.endsWith(".test.ts");
}

function isTestSupportPath(candidate: string) {
  return candidate.startsWith("tests/");
}

function isAgentFacingPath(candidate: string) {
  return (
    candidate === "AGENTS.md" ||
    candidate === "README.md" ||
    candidate === "docs/agent-orientation.md" ||
    candidate === "docs/dev-tooling.md" ||
    candidate.startsWith("docs/llm-kit/") ||
    candidate.startsWith(".agents/skills/") ||
    candidate === "scripts/agent-check.ts" ||
    candidate === "scripts/generate-agent-orientation.ts"
  );
}

function isAgentOrientationGeneratorPath(candidate: string) {
  return candidate === "scripts/generate-agent-orientation.ts";
}

function isGeneratedDatabasePath(candidate: string) {
  return candidate === "drizzle" || candidate.startsWith("drizzle/");
}

function isApplicationCodeOrToolingPath(candidate: string) {
  return (
    candidate.startsWith("src/") ||
    candidate.startsWith("scripts/") ||
    candidate === ".env.example" ||
    candidate === "eslint.config.mjs" ||
    candidate === "package.json" ||
    candidate === "pnpm-lock.yaml" ||
    candidate === "playwright.config.mjs" ||
    candidate === "prettier.config.mjs" ||
    candidate === "next.config.ts" ||
    candidate === "drizzle.config.ts" ||
    candidate === "tsconfig.json" ||
    candidate === "vitest.config.ts" ||
    isGeneratedDatabasePath(candidate)
  );
}

function isReleaseSensitivePath(candidate: string) {
  return (
    candidate.startsWith("src/components/consolidation/") ||
    candidate.startsWith("src/components/dashboard/") ||
    candidate.startsWith("src/components/glossary/") ||
    candidate.startsWith("src/components/kanji-clash/") ||
    candidate.startsWith("src/components/katakana-speed/") ||
    candidate.startsWith("src/components/media/") ||
    candidate.startsWith("src/components/pitch-accent/") ||
    candidate.startsWith("src/components/review/") ||
    candidate.startsWith("src/components/settings/") ||
    candidate.startsWith("src/components/textbook/") ||
    candidate === "src/components/site-shell.tsx" ||
    candidate === "src/components/site-shell-primary-nav.tsx" ||
    candidate.startsWith("src/app/") ||
    candidate.startsWith("src/db/") ||
    candidate === "src/actions/pitch-accent.ts" ||
    candidate === "src/actions/settings.ts" ||
    candidate.startsWith("src/features/consolidation/") ||
    candidate.startsWith("src/features/dashboard/") ||
    candidate.startsWith("src/features/glossary/") ||
    candidate.startsWith("src/features/kanji-clash/") ||
    candidate.startsWith("src/features/katakana-speed/") ||
    candidate.startsWith("src/features/media/") ||
    candidate.startsWith("src/features/pitch-accent/") ||
    candidate.startsWith("src/features/progress/") ||
    candidate.startsWith("src/features/review/") ||
    candidate.startsWith("src/features/settings/") ||
    candidate.startsWith("src/features/textbook/") ||
    candidate.startsWith("src/features/navigation/") ||
    candidate.startsWith("src/features/auth/") ||
    candidate.startsWith("src/features/cache/") ||
    candidate.startsWith("src/features/content/importer") ||
    candidate.startsWith("src/features/content/parser") ||
    candidate.startsWith("src/features/content/validator") ||
    candidate.startsWith("scripts/import-content") ||
    candidate.startsWith("scripts/db-") ||
    candidate.startsWith("drizzle/") ||
    candidate === "drizzle.config.ts"
  );
}
