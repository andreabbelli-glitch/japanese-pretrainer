import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  buildContentScopePlan,
  formatContentScopePlan,
  type ContentScopeChange,
  type ContentScopeChangeStatus
} from "../src/features/content/tooling/scope.ts";

const execFileAsync = promisify(execFile);

try {
  const cliOptions = resolveCliOptions(process.argv.slice(2));
  const changes =
    cliOptions.paths.length > 0
      ? await resolveExplicitPathChanges(cliOptions.paths)
      : await resolveGitChanges({ staged: cliOptions.staged });
  const plan = await buildContentScopePlan({
    changes,
    contentRoot: cliOptions.contentRoot,
    repositoryRoot: process.cwd()
  });

  process.stdout.write(
    cliOptions.json ? `${JSON.stringify(plan)}\n` : formatContentScopePlan(plan)
  );
} catch (error) {
  console.error(formatUnexpectedError(error));
  process.exitCode = 1;
}

type CliOptions = {
  contentRoot: string;
  json: boolean;
  paths: string[];
  staged: boolean;
};

function resolveCliOptions(args: string[]): CliOptions {
  let contentRoot = path.resolve(process.cwd(), "content");
  let json = false;
  const paths: string[] = [];
  let staged = false;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;

    if (value === "--") {
      continue;
    }

    if (value === "--content-root") {
      contentRoot = path.resolve(
        readOptionValue(args, index, "--content-root")
      );
      index += 1;
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
    contentRoot,
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

async function resolveGitChanges(input: { staged: boolean }) {
  const { stdout } = input.staged
    ? await execFileAsync("git", [
        "diff",
        "--name-status",
        "--cached",
        "--",
        "content/media"
      ])
    : await execFileAsync("git", [
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--",
        "content/media"
      ]);

  return input.staged ? parseNameStatus(stdout) : parsePorcelainStatus(stdout);
}

function parsePorcelainStatus(stdout: string) {
  const changes: ContentScopeChange[] = [];

  for (const line of stdout.split("\n")) {
    if (line.length === 0) {
      continue;
    }

    const status = line.slice(0, 2);
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
      status: mapStatus(status)
    });
  }

  return changes;
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
    const { access } = await import("node:fs/promises");

    await access(filePath);
    return true;
  } catch {
    return false;
  }
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

  return "content:scope failed with an unknown error.";
}
