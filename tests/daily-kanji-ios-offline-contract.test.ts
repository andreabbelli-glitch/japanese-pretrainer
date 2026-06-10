import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const iosRoot = path.join(process.cwd(), "apps", "daily-kanji-ios");
const contractPath = path.join(iosRoot, "offline-contract.json");
const scannedSourceDirs = ["App", "Shared", "WidgetExtension"].map((segment) =>
  path.join(iosRoot, segment)
);
const forbiddenRuntimeNetworkPatterns = [
  /\bAsyncImage\s*\(/,
  /\bURLSession\b/,
  /\bURLRequest\b/,
  /\bNSURLConnection\b/,
  /\bNWConnection\b/,
  /\bWKWebView\b/,
  /\bSFSafariViewController\b/,
  /\bURL\s*\(\s*string:\s*"https?:\/\//,
  /\bData\s*\(\s*contentsOf:\s*URL\s*\(/
];
const forbiddenEntitlementPatterns = [
  /CODE_SIGN_ENTITLEMENTS/,
  /^\s*entitlements\s*:/,
  /com\.apple\.security\.application-groups/,
  /com\.apple\.developer\.associated-domains/
];

describe("daily kanji iOS offline contract", () => {
  it("declares a zero-runtime-network personal app contract", async () => {
    const contract = JSON.parse(await readFile(contractPath, "utf8")) as {
      entitlements: {
        appGroups: boolean;
        associatedDomains: boolean;
      };
      remoteServices: string[];
      runtimeNetwork: string;
    };

    expect(contract).toEqual({
      entitlements: {
        appGroups: false,
        associatedDomains: false
      },
      remoteServices: [],
      runtimeNetwork: "none"
    });
  });

  it("keeps maintained iOS runtime sources free of networking APIs", async () => {
    const sourceFiles = await listFiles(scannedSourceDirs, [".swift"]);
    const violations = await matchingLines(
      sourceFiles,
      forbiddenRuntimeNetworkPatterns
    );

    expect(violations).toEqual([]);
  });

  it("detects common Swift runtime-network escape hatches without blocking bundled file reads", () => {
    const blockedSamples = [
      "AsyncImage(url: URL(string: \"https://example.test/card.png\"))",
      "let request = URLRequest(url: url)",
      "let session = URLSession.shared",
      "let data = try Data(contentsOf: URL(string: \"https://example.test/cards.json\")!)",
      "let remote = URL(string: \"http://example.test/cards.json\")"
    ];
    const allowedSamples = [
      "let data = try Data(contentsOf: url)",
      "return URL(string: \"\\(scheme)://\\(cardHost)/\\(encodedCardId)\")!"
    ];

    expect(
      blockedSamples.filter((line) =>
        forbiddenRuntimeNetworkPatterns.some((pattern) => pattern.test(line))
      )
    ).toEqual(blockedSamples);
    expect(
      allowedSamples.filter((line) =>
        forbiddenRuntimeNetworkPatterns.some((pattern) => pattern.test(line))
      )
    ).toEqual([]);
  });

  it("keeps the iOS project free of App Group and Associated Domains entitlements", async () => {
    const entitlementFiles = await listFiles([iosRoot], [".entitlements"]);
    const configFiles = [
      path.join(iosRoot, "project.yml"),
      path.join(iosRoot, "App", "Info.plist"),
      path.join(iosRoot, "WidgetExtension", "Info.plist"),
      ...entitlementFiles
    ];
    const violations = await matchingLines(
      configFiles,
      forbiddenEntitlementPatterns
    );

    expect(violations).toEqual([]);
  });
});

async function listFiles(
  roots: string[],
  extensions: string[]
): Promise<string[]> {
  const files = await Promise.all(
    roots.map(async (root) => listFilesInRoot(root, extensions))
  );

  return files.flat().sort();
}

async function listFilesInRoot(
  root: string,
  extensions: string[]
): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return listFilesInRoot(entryPath, extensions);
      }

      return extensions.includes(path.extname(entry.name)) ? [entryPath] : [];
    })
  );

  return files.flat();
}

async function matchingLines(files: string[], patterns: RegExp[]) {
  const results = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, "utf8");

      return source
        .split("\n")
        .flatMap((line, index) =>
          patterns.some((pattern) => pattern.test(line))
            ? [`${path.relative(process.cwd(), file)}:${index + 1}:${line}`]
            : []
        );
    })
  );

  return results.flat();
}
