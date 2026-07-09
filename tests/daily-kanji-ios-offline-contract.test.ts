import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import {
  dailyKanjiDefaultExportLimit,
  dailyKanjiDefaultRecentMistakeLookbackDays
} from "@/features/daily-kanji/server/exporter";

const iosRoot = path.join(process.cwd(), "apps", "daily-kanji-ios");
const contractPath = path.join(iosRoot, "offline-contract.json");
const packageJsonPath = path.join(process.cwd(), "package.json");
const projectConfigPath = path.join(iosRoot, "project.yml");
const databaseScannedSourceDirs = ["App", "Shared", "WidgetExtension"].map(
  (segment) => path.join(iosRoot, segment)
);
const networkFreeRuntimeSourceDirs = ["Shared", "WidgetExtension"].map(
  (segment) => path.join(iosRoot, segment)
);
const forbiddenSharedNetworkPatterns = [
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
const forbiddenAssociatedDomainPatterns = [
  /com\.apple\.developer\.associated-domains/
];
const forbiddenDatabasePatterns = [
  /\bCoreData\b/,
  /\bSwiftData\b/,
  /\bModelContext\b/,
  /\bModelContainer\b/,
  /\bNSPersistentContainer\b/,
  /\bSQLite\b/,
  /\bSQLite3\b/,
  /\bsqlite3_[A-Za-z0-9_]*\b/,
  /\blibsqlite3(?:\.\d+)?\.tbd\b/i,
  /\bFMDB\b/,
  /\bGRDB\b/,
  /\blibsql[A-Za-z0-9_]*\b/i
];

describe("daily kanji iOS offline contract", () => {
  it("declares an offline-first personal app contract", async () => {
    const contract = JSON.parse(await readFile(contractPath, "utf8")) as {
      entitlements: {
        appGroupIdentifier: string;
        appGroups: boolean;
        associatedDomains: boolean;
        defaultApsEnvironment: null;
        optionalApsEnvironment: string;
        pushNotifications: string;
      };
      freeTierBudget: {
        monthlyRuntime: {
          appSyncRequests: number;
          tursoQueries: number;
          vercelRequests: number;
          widgetSyncRequests: number;
        };
        packageWorkflow: {
          defaultCardLimit: number;
          defaultRecentMistakeLookbackDays: number;
          expectedRemoteQueriesPerPackageRun: number;
          generatedArtifacts: string[];
          trigger: string;
          vercelRequestsPerPackageRun: number;
        };
      };
      remoteServices: string[];
      runtimeNetwork: string;
    };

    expect(contract).toEqual({
      entitlements: {
        appGroupIdentifier: "group.dev.local.daily-kanji",
        appGroups: true,
        associatedDomains: false,
        defaultApsEnvironment: null,
        optionalApsEnvironment: "development",
        pushNotifications: "optional-paid-team"
      },
      freeTierBudget: {
        monthlyRuntime: {
          appSyncRequests: 200,
          tursoQueries: 200,
          vercelRequests: 200,
          widgetSyncRequests: 0
        },
        packageWorkflow: {
          defaultCardLimit: dailyKanjiDefaultExportLimit,
          defaultRecentMistakeLookbackDays:
            dailyKanjiDefaultRecentMistakeLookbackDays,
          expectedRemoteQueriesPerPackageRun: 1,
          generatedArtifacts: [
            "App/Resources/daily-kanji-cards.json",
            "App/Resources/Audio/",
            "WidgetExtension/Resources/daily-kanji-widget-cards.json"
          ],
          trigger: "manual-only",
          vercelRequestsPerPackageRun: 0
        }
      },
      remoteServices: [
        "private-daily-kanji-ios-dataset-api",
        "private-mobile-live-review-api",
        "apns"
      ],
      runtimeNetwork: "offline-first-dataset-live-review-online-only"
    });
  });

  it("keeps shared and widget runtime sources free of networking APIs", async () => {
    const sourceFiles = await listFiles(networkFreeRuntimeSourceDirs, [
      ".swift"
    ]);
    const violations = await matchingLines(
      sourceFiles,
      forbiddenSharedNetworkPatterns
    );

    expect(violations).toEqual([]);
  });

  it("keeps maintained iOS runtime sources free of database APIs", async () => {
    const sourceFiles = await listFiles(databaseScannedSourceDirs, [".swift"]);
    const violations = await matchingLines(
      sourceFiles,
      forbiddenDatabasePatterns
    );

    expect(violations).toEqual([]);
  });

  it("keeps the iOS project config free of database frameworks and packages", async () => {
    const violations = await matchingLines(
      [projectConfigPath],
      forbiddenDatabasePatterns
    );

    expect(violations).toEqual([]);
  });

  it("detects shared-disallowed Swift runtime-network escape hatches without blocking bundled file reads", () => {
    const blockedSamples = [
      'AsyncImage(url: URL(string: "https://example.test/card.png"))',
      "let request = URLRequest(url: url)",
      "let session = URLSession.shared",
      'let data = try Data(contentsOf: URL(string: "https://example.test/cards.json")!)',
      'let remote = URL(string: "http://example.test/cards.json")'
    ];
    const allowedSamples = [
      "let data = try Data(contentsOf: url)",
      'return URL(string: "\\(scheme)://\\(cardHost)/\\(encodedCardId)")!'
    ];

    expect(
      blockedSamples.filter((line) =>
        forbiddenSharedNetworkPatterns.some((pattern) => pattern.test(line))
      )
    ).toEqual(blockedSamples);
    expect(
      allowedSamples.filter((line) =>
        forbiddenSharedNetworkPatterns.some((pattern) => pattern.test(line))
      )
    ).toEqual([]);
  });

  it("detects common Swift and XcodeGen database escape hatches", () => {
    const blockedSamples = [
      "import CoreData",
      "let container = ModelContainer(for: DailyKanjiCard.self)",
      "let context: ModelContext",
      'let persistent = NSPersistentContainer(name: "Cards")',
      "import SQLite3",
      "sqlite3_open(path, &database)",
      "import LibSQL",
      "let client = LibsqlClient()",
      "import GRDB",
      "import FMDB",
      "- sdk: libsqlite3.tbd",
      "- sdk: CoreData.framework",
      "- package: https://github.com/groue/GRDB.swift.git",
      "- package: https://github.com/stephencelis/SQLite.swift.git",
      "- package: https://github.com/libsql/libsql-client-swift.git"
    ];

    expect(
      blockedSamples.filter((line) =>
        forbiddenDatabasePatterns.some((pattern) => pattern.test(line))
      )
    ).toEqual(blockedSamples);
  });

  it("keeps App Groups scoped and Associated Domains absent", async () => {
    const contract = JSON.parse(await readFile(contractPath, "utf8")) as {
      entitlements: {
        appGroupIdentifier: string;
        defaultApsEnvironment: null;
        optionalApsEnvironment: string;
      };
    };
    const entitlementFiles = await listFiles([iosRoot], [".entitlements"]);
    const configFiles = [
      path.join(iosRoot, "project.yml"),
      path.join(iosRoot, "App", "Info.plist"),
      path.join(iosRoot, "WidgetExtension", "Info.plist"),
      ...entitlementFiles
    ];
    const associatedDomainViolations = await matchingLines(
      configFiles,
      forbiddenAssociatedDomainPatterns
    );
    const entitlementGroups = Object.fromEntries(
      await Promise.all(
        entitlementFiles.map(async (file) => [
          path.relative(iosRoot, file),
          extractPlistStringArray(
            await readFile(file, "utf8"),
            "com.apple.security.application-groups"
          )
        ])
      )
    );
    const apsEnvironments = Object.fromEntries(
      await Promise.all(
        entitlementFiles.map(async (file) => [
          path.relative(iosRoot, file),
          extractPlistString(await readFile(file, "utf8"), "aps-environment")
        ])
      )
    );

    expect(associatedDomainViolations).toEqual([]);
    expect(entitlementGroups).toEqual({
      "DailyKanji.entitlements": [contract.entitlements.appGroupIdentifier],
      "DailyKanjiPush.entitlements": [contract.entitlements.appGroupIdentifier],
      "DailyKanjiWidgetExtension.entitlements": [
        contract.entitlements.appGroupIdentifier
      ]
    });
    expect(apsEnvironments).toEqual({
      "DailyKanji.entitlements": contract.entitlements.defaultApsEnvironment,
      "DailyKanjiPush.entitlements":
        contract.entitlements.optionalApsEnvironment,
      "DailyKanjiWidgetExtension.entitlements": null
    });
    expect(
      readYamlTargetBaseSetting(
        await readFile(projectConfigPath, "utf8"),
        "DailyKanji",
        "CODE_SIGN_ENTITLEMENTS"
      )
    ).toBe("DailyKanji.entitlements");
    expect(
      readYamlTargetBaseSetting(
        await readFile(projectConfigPath, "utf8"),
        "DailyKanjiWidgetExtension",
        "CODE_SIGN_ENTITLEMENTS"
      )
    ).toBe("DailyKanjiWidgetExtension.entitlements");
  });

  it("keeps the app and widget targets iPhone-only", async () => {
    const projectConfig = await readFile(projectConfigPath, "utf8");

    expect(
      readYamlTargetBaseSetting(
        projectConfig,
        "DailyKanji",
        "TARGETED_DEVICE_FAMILY"
      )
    ).toBe("1");
    expect(
      readYamlTargetBaseSetting(
        projectConfig,
        "DailyKanjiWidgetExtension",
        "TARGETED_DEVICE_FAMILY"
      )
    ).toBe("1");
  });

  it("packages only the cards projection in the widget extension", async () => {
    const project = parse(await readFile(projectConfigPath, "utf8")) as {
      targets?: Record<
        string,
        {
          sources?: Array<{
            buildPhase?: string;
            excludes?: string[];
            path: string;
          }>;
        }
      >;
    };

    expect(project.targets?.DailyKanjiWidgetExtension?.sources).toEqual([
      { path: "Shared" },
      { excludes: ["Resources"], path: "WidgetExtension" },
      {
        buildPhase: "resources",
        excludes: [".gitkeep"],
        path: "WidgetExtension/Resources"
      }
    ]);
    expect(
      project.targets?.DailyKanjiWidgetExtension?.sources?.some(
        (source) => source.path === "App/Resources"
      )
    ).toBe(false);
  });

  it("verifies packaged resources before iOS build or install workflows", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const workflowScriptPaths = [
      path.join(iosRoot, "scripts", "package-ipa.sh"),
      path.join(iosRoot, "scripts", "xcode-renew.sh")
    ];

    expect(packageJson.scripts?.["daily-kanji:verify-resources"]).toBe(
      "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types ./scripts/verify-daily-kanji-ios-resources.ts"
    );
    expect(packageJson.scripts?.["daily-kanji:package"]).toBe(
      "pnpm daily-kanji:export && pnpm daily-kanji:export-audio && pnpm daily-kanji:verify-resources"
    );

    for (const workflowScriptPath of workflowScriptPaths) {
      const source = await readFile(workflowScriptPath, "utf8");
      const verifyIndex = source.indexOf("daily-kanji:verify-resources");
      const xcodegenIndex = source.indexOf("xcodegen generate");

      expect(verifyIndex).toBeGreaterThanOrEqual(0);
      expect(xcodegenIndex).toBeGreaterThanOrEqual(0);
      expect(verifyIndex).toBeLessThan(xcodegenIndex);
    }
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

function readYamlTargetBaseSetting(
  source: string,
  targetName: string,
  settingName: string
) {
  const project = parse(source) as {
    targets?: Record<
      string,
      {
        settings?: {
          base?: Record<string, unknown>;
        };
      }
    >;
  };
  const value = project.targets?.[targetName]?.settings?.base?.[settingName];

  if (value === undefined) {
    throw new Error(
      `Missing XcodeGen target setting: ${targetName}.${settingName}`
    );
  }

  return String(value);
}

function extractPlistStringArray(source: string, key: string) {
  const keyPattern = new RegExp(
    `<key>\\s*${escapeRegExp(key)}\\s*</key>\\s*<array>([\\s\\S]*?)</array>`
  );
  const match = source.match(keyPattern);
  if (!match) {
    return [];
  }

  return Array.from(match[1]!.matchAll(/<string>([\s\S]*?)<\/string>/g))
    .map((entry) => entry[1]!.trim())
    .sort();
}

function extractPlistString(source: string, key: string) {
  const keyPattern = new RegExp(
    `<key>\\s*${escapeRegExp(key)}\\s*</key>\\s*<string>([\\s\\S]*?)</string>`
  );
  const match = source.match(keyPattern);

  return match ? match[1]!.trim() : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
