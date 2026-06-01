import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  buildAgentVerifyPlan,
  formatAgentVerifyPlan
} from "../src/features/shared/tooling/verify.ts";
import {
  buildContentScopePlan,
  type ContentScopeChange,
  type ContentScopeChangeStatus
} from "../src/features/content/tooling/scope.ts";

const execFileAsync = promisify(execFile);

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const changes =
    cliOptions.paths.length > 0
      ? await resolveExplicitPathChanges(cliOptions.paths)
      : await resolveGitChangedPaths({ staged: cliOptions.staged });
  const contentChanges = changes.filter((change) =>
    isContentMediaPath(change.path)
  );
  const contentScope =
    contentChanges.length > 0
      ? await resolveContentScope(contentChanges)
      : null;
  const plan = buildAgentVerifyPlan({
    contentScope,
    paths: changes.map((change) => change.path)
  });

  process.stdout.write(
    cliOptions.json ? `${JSON.stringify(plan)}\n` : formatAgentVerifyPlan(plan)
  );
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = 1;
}

type CliOptions = {
  json: boolean;
  paths: string[];
  staged: boolean;
};

function resolveCliOptions(args: string[]): CliOptions {
  let json = false;
  const paths: string[] = [];
  let staged = false;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--json") {
      json = true;
      continue;
    }

    if (value === "--path") {
      paths.push(readOptionValue(args, index, "--path"));
      index += 1;
      continue;
    }

    if (value === "--staged") {
      staged = true;
      continue;
    }

    if (value.startsWith("--")) {
      throw new Error(`Unknown argument: ${value}`);
    }

    paths.push(value);
  }

  return {
    json,
    paths,
    staged
  };
}

async function resolveExplicitPathChanges(paths: string[]) {
  const changes: ContentScopeChange[] = [];

  for (const filePath of paths) {
    changes.push({
      path: filePath,
      status: (await pathExists(filePath)) ? "modified" : "deleted"
    });
  }

  return changes;
}

async function resolveGitChangedPaths(input: { staged: boolean }) {
  const { stdout } = input.staged
    ? await execFileAsync("git", ["diff", "--name-status", "--cached"])
    : await execFileAsync("git", [
        "status",
        "--porcelain=v1",
        "--untracked-files=all"
      ]);

  return input.staged ? parseNameStatus(stdout) : parsePorcelainStatus(stdout);
}

async function resolveContentScope(changes: ContentScopeChange[]) {
  const normalizedChanges = changes.map((change) => ({
    ...change,
    path: normalizePath(change.path)
  }));

  if (normalizedChanges.some((change) => change.path === "content/media")) {
    return {
      commands: [
        "./scripts/with-node.sh pnpm content:validate",
        "./scripts/with-node.sh pnpm content:import"
      ],
      notes: [],
      warnings: ["content media root path requires full content gates"]
    };
  }

  const plan = await buildContentScopePlan({
    changes: normalizedChanges,
    contentRoot: path.resolve(process.cwd(), "content"),
    repositoryRoot: process.cwd()
  });
  const commands = plan.media.flatMap((mediaPlan) =>
    [mediaPlan.validateCommand, mediaPlan.importCommand].filter(
      (command): command is string => command !== null
    )
  );
  const notes = plan.media.flatMap((mediaPlan) =>
    mediaPlan.importCommand === null
      ? [`content import not required for ${mediaPlan.mediaSlug}`]
      : []
  );
  const warnings = [
    ...plan.warnings,
    ...plan.media.flatMap((mediaPlan) => mediaPlan.warnings)
  ];

  return {
    commands,
    notes,
    warnings
  };
}

function parseNameStatus(stdout: string) {
  const changes: ContentScopeChange[] = [];

  for (const line of stdout.split("\n")) {
    if (line.length === 0) {
      continue;
    }

    const [status, firstPath, secondPath] = line.split("\t");

    if (!status || !firstPath) {
      continue;
    }

    if (status.startsWith("R") && secondPath) {
      changes.push({
        path: firstPath,
        status: "deleted"
      });
      changes.push({
        path: secondPath,
        status: "renamed"
      });
      continue;
    }

    changes.push({
      path: firstPath,
      status: mapStatus(status)
    });
  }

  return changes;
}

function parsePorcelainStatus(stdout: string) {
  const changes: ContentScopeChange[] = [];

  for (const line of stdout.split("\n")) {
    if (line.length === 0) {
      continue;
    }

    const value = line.slice(3);
    const renameParts = value.split(" -> ");

    if (renameParts.length === 2) {
      changes.push({
        path: renameParts[0]!,
        status: "deleted"
      });
      changes.push({
        path: renameParts[1]!,
        status: "renamed"
      });
      continue;
    }

    changes.push({
      path: value,
      status: mapStatus(line.slice(0, 2))
    });
  }

  return changes;
}

function mapStatus(status: string): ContentScopeChangeStatus {
  if (status.includes("D")) {
    return "deleted";
  }

  if (status.includes("A") || status.includes("?")) {
    return "added";
  }

  if (status.includes("R")) {
    return "renamed";
  }

  return "modified";
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizePath(filePath: string) {
  return filePath
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
}

function isContentMediaPath(filePath: string) {
  const normalizedPath = normalizePath(filePath);
  return (
    normalizedPath === "content/media" ||
    normalizedPath.startsWith("content/media/")
  );
}

function readOptionValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

function formatUnexpectedError(error: unknown) {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "agent:verify failed with an unknown error.";
}
