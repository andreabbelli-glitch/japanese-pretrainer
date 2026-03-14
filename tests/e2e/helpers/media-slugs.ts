import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

export function listWorkspaceMediaSlugs() {
  const mediaRoot = path.resolve(process.cwd(), "content", "media");

  return readdirSync(mediaRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => existsSync(path.join(mediaRoot, slug, "media.md")))
    .sort((left, right) => left.localeCompare(right));
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
