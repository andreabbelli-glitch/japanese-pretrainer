import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { once } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { performance as nodePerformance } from "node:perf_hooks";

import { chromium } from "@playwright/test";

import {
  closeDatabaseClient,
  createDatabaseClient,
  runMigrations
} from "../src/db/index.ts";
import { resolveDatabaseLocation } from "../src/db/config.ts";
import { purgeArchivedMedia } from "../src/db/purge-archived-media.ts";
import { getAuthConfig } from "../src/lib/auth.ts";
import { importContentWorkspace } from "../src/lib/content/importer.ts";

const BENCHMARK_ROUTES = [
  "/",
  "/media",
  "/review",
  "/glossary",
  "/media/duel-masters-dm25",
  "/media/duel-masters-dm25/textbook/tcg-core-overview"
] as const;

const DEFAULT_PORT = 3310;
const DEFAULT_RUNS = 5;
const DEFAULT_WARMUP_RUNS = 2;
const DEFAULT_LOCAL_DATABASE_PATH = path.resolve(
  process.cwd(),
  ".tmp",
  "perf",
  "japanese-custom-study-benchmark.sqlite"
);
const DEFAULT_JSON_OUTPUT_PATH = path.resolve(
  process.cwd(),
  ".tmp",
  "perf",
  "latest.json"
);
const DEFAULT_MARKDOWN_OUTPUT_PATH = path.resolve(
  process.cwd(),
  ".tmp",
  "perf",
  "latest.md"
);
const DEFAULT_STORAGE_STATE_PATH = path.resolve(
  process.cwd(),
  ".tmp",
  "perf",
  "auth-state.json"
);
const SERVER_START_TIMEOUT_MS = 120_000;
const NAVIGATION_TIMEOUT_MS = 60_000;
const SERVER_POLL_INTERVAL_MS = 1_000;

type RoutePath = (typeof BENCHMARK_ROUTES)[number];

type CliOptions = {
  outputJsonPath: string;
  outputMarkdownPath: string;
  port: number;
  prepareDatabase: boolean;
  runs: number;
  warmupRuns: number;
  showHelp: boolean;
};

type RunSample = {
  domContentLoadedMs: number;
  finalPath: string;
  loadEventMs: number;
  responseStatus: number | null;
  route: RoutePath;
  runIndex: number;
  totalTimeMs: number;
  ttfbMs: number;
};

type RouteSummary = {
  finalPath: string;
  medianDomContentLoadedMs: number;
  medianLoadEventMs: number;
  medianTotalTimeMs: number;
  medianTtfbMs: number;
  responseStatus: number | null;
  route: RoutePath;
  samples: RunSample[];
};

type BenchmarkReport = {
  generatedAt: string;
  options: {
    outputJsonPath: string;
    outputMarkdownPath: string;
    port: number;
    prepareDatabase: boolean;
    runs: number;
    warmupRuns: number;
  };
  routes: RouteSummary[];
  runtime: {
    authEnabled: boolean;
    authUsedForBenchmark: boolean;
    baseUrl: string;
    databaseLabel: string;
    databaseMode: "local" | "remote";
    databasePrepared: boolean;
    nodeVersion: string;
  };
};

type BenchmarkRuntime = {
  authEnabled: boolean;
  authUsedForBenchmark: boolean;
  baseUrl: string;
  databaseLabel: string;
  databaseMode: "local" | "remote";
  databasePrepared: boolean;
};

const cliOptions = parseCliArgs(process.argv.slice(2));

if (cliOptions.showHelp) {
  printHelp();
  process.exit(0);
}

const baseUrl = `http://127.0.0.1:${cliOptions.port}`;
const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_LOCAL_DATABASE_PATH;
const databaseLocation = resolveDatabaseLocation(databaseUrl);
const benchmarkRuntime: BenchmarkRuntime = {
  authEnabled: false,
  authUsedForBenchmark: false,
  baseUrl,
  databaseLabel: formatDatabaseLabel(databaseLocation.configuredPath),
  databaseMode: databaseLocation.isRemote ? "remote" : "local",
  databasePrepared: cliOptions.prepareDatabase
};

let serverProcess: ChildProcess | null = null;

const signalHandler = () => {
  shutdownServer(serverProcess)
    .catch(() => undefined)
    .finally(() => {
      process.exit(128);
    });
};

for (const signalName of ["SIGINT", "SIGTERM"] as const) {
  process.on(signalName, signalHandler);
}

try {
  ensureDirectory(path.dirname(cliOptions.outputJsonPath));
  ensureDirectory(path.dirname(cliOptions.outputMarkdownPath));
  ensureDirectory(path.dirname(DEFAULT_STORAGE_STATE_PATH));

  console.info(`[perf] Building production app on ${baseUrl}...`);
  await runNodeCommand(["./node_modules/next/dist/bin/next", "build"]);

  if (cliOptions.prepareDatabase) {
    console.info(
      `[perf] Preparing ${benchmarkRuntime.databaseMode} database: ${benchmarkRuntime.databaseLabel}`
    );
    await prepareDatabase(databaseUrl, databaseLocation.isRemote);
  } else {
    console.info(
      `[perf] Reusing existing ${benchmarkRuntime.databaseMode} database: ${benchmarkRuntime.databaseLabel}`
    );
  }

  console.info(`[perf] Starting next start on port ${cliOptions.port}...`);
  serverProcess = startProductionServer(cliOptions.port, databaseUrl);

  await waitForServer(baseUrl, SERVER_START_TIMEOUT_MS);

  const authConfig = getAuthConfig();
  benchmarkRuntime.authEnabled = authConfig.enabled;

  const browser = await launchBrowser();

  try {
    const storageStatePath = authConfig.enabled
      ? await createAuthenticatedStorageState(browser, baseUrl)
      : undefined;
    benchmarkRuntime.authUsedForBenchmark = Boolean(storageStatePath);

    console.info(
      `[perf] Warmup ${cliOptions.warmupRuns}x, measured runs ${cliOptions.runs}x across ${BENCHMARK_ROUTES.length} route(s).`
    );

    await runWarmupCycles({
      baseUrl,
      browser,
      storageStatePath,
      warmupRuns: cliOptions.warmupRuns
    });

    const routeSummaries = await runMeasuredCycles({
      baseUrl,
      browser,
      runs: cliOptions.runs,
      storageStatePath
    });

    const report: BenchmarkReport = {
      generatedAt: new Date().toISOString(),
      options: {
        outputJsonPath: cliOptions.outputJsonPath,
        outputMarkdownPath: cliOptions.outputMarkdownPath,
        port: cliOptions.port,
        prepareDatabase: cliOptions.prepareDatabase,
        runs: cliOptions.runs,
        warmupRuns: cliOptions.warmupRuns
      },
      routes: routeSummaries,
      runtime: {
        ...benchmarkRuntime,
        nodeVersion: process.version
      }
    };

    fs.writeFileSync(
      cliOptions.outputJsonPath,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
    fs.writeFileSync(
      cliOptions.outputMarkdownPath,
      renderMarkdownReport(report),
      "utf8"
    );

    console.info("");
    console.info(renderConsoleSummary(report));
    console.info("");
    console.info(`[perf] JSON report: ${cliOptions.outputJsonPath}`);
    console.info(`[perf] Markdown report: ${cliOptions.outputMarkdownPath}`);
  } finally {
    await browser.close();
  }
} finally {
  await shutdownServer(serverProcess);

  for (const signalName of ["SIGINT", "SIGTERM"] as const) {
    process.off(signalName, signalHandler);
  }
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputJsonPath: DEFAULT_JSON_OUTPUT_PATH,
    outputMarkdownPath: DEFAULT_MARKDOWN_OUTPUT_PATH,
    port: DEFAULT_PORT,
    prepareDatabase: true,
    runs: DEFAULT_RUNS,
    showHelp: false,
    warmupRuns: DEFAULT_WARMUP_RUNS
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--":
        break;
      case "--help":
      case "-h":
        options.showHelp = true;
        break;
      case "--runs":
        options.runs = parsePositiveInteger(readFlagValue(argv, arg, index), arg);
        index += 1;
        break;
      case "--warmup":
        options.warmupRuns = parseNonNegativeInteger(
          readFlagValue(argv, arg, index),
          arg
        );
        index += 1;
        break;
      case "--port":
        options.port = parsePositiveInteger(readFlagValue(argv, arg, index), arg);
        index += 1;
        break;
      case "--output-json":
        options.outputJsonPath = path.resolve(
          process.cwd(),
          readFlagValue(argv, arg, index)
        );
        index += 1;
        break;
      case "--output-md":
        options.outputMarkdownPath = path.resolve(
          process.cwd(),
          readFlagValue(argv, arg, index)
        );
        index += 1;
        break;
      case "--skip-db-prepare":
        options.prepareDatabase = false;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function readFlagValue(argv: string[], arg: string, index: number) {
  const value = argv[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${arg}.`);
  }

  return value;
}

function parsePositiveInteger(value: string, optionName: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer.`);
  }

  return parsed;
}

function parseNonNegativeInteger(value: string, optionName: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${optionName} must be a non-negative integer.`);
  }

  return parsed;
}

function printHelp() {
  console.info(`Usage:
  ./scripts/with-node.sh pnpm perf:benchmark
  ./scripts/with-node.sh pnpm perf:benchmark -- --runs 7 --warmup 2
  ./scripts/with-node.sh pnpm perf:benchmark -- --skip-db-prepare

Options:
  --runs <n>         Number of measured runs per route. Default: ${DEFAULT_RUNS}
  --warmup <n>       Number of warmup cycles before measuring. Default: ${DEFAULT_WARMUP_RUNS}
  --port <n>         Port used by next start. Default: ${DEFAULT_PORT}
  --output-json <p>  JSON artifact path. Default: ${DEFAULT_JSON_OUTPUT_PATH}
  --output-md <p>    Markdown artifact path. Default: ${DEFAULT_MARKDOWN_OUTPUT_PATH}
  --skip-db-prepare  Reuse the target DB without migrations/import.

Environment:
  DATABASE_URL                 Local SQLite path or remote libsql/Turso URL.
  DATABASE_AUTH_TOKEN          Preferred libsql auth token env for remote DB.
  LIBSQL_AUTH_TOKEN            Supported fallback auth token env.
  AUTH_USERNAME                Enables app auth when combined with the other AUTH_* values.
  AUTH_PASSWORD                Plaintext password; benchmark can reuse it directly.
  AUTH_PASSWORD_HASH           Supported auth mode for the app.
  AUTH_SESSION_SECRET          Required when auth is enabled.
  BENCH_AUTH_PASSWORD          Required only when auth is enabled with AUTH_PASSWORD_HASH.
  BENCH_AUTH_USERNAME          Optional override for the login username.
`);
}

function ensureDirectory(directoryPath: string) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

async function runNodeCommand(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command terminated by signal ${signal}.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}.`));
        return;
      }

      resolve();
    });
  });
}

async function prepareDatabase(databaseUrl: string, isRemote: boolean) {
  const location = resolveDatabaseLocation(databaseUrl);

  if (!isRemote && location.databasePath === DEFAULT_LOCAL_DATABASE_PATH) {
    fs.rmSync(location.databasePath, { force: true });
  }

  const database = createDatabaseClient({ databaseUrl });
  const contentRoot = path.resolve(process.cwd(), "content");

  try {
    await runMigrations(database);

    const importResult = await importContentWorkspace({
      contentRoot,
      database
    });

    if (importResult.status === "failed") {
      throw new Error(importResult.message);
    }

    await purgeArchivedMedia(database);
  } finally {
    closeDatabaseClient(database);
  }
}

function startProductionServer(port: number, databaseUrl: string) {
  const child = spawn(
    process.execPath,
    [
      "./node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port)
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl
      },
      stdio: "inherit"
    }
  );

  child.on("exit", (code, signal) => {
    if (!signal && code && code !== 0) {
      console.error(`[perf] next start exited early with code ${code}.`);
    }
  });

  return child;
}

async function waitForServer(baseUrl: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`, {
        redirect: "follow"
      });

      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet.
    }

    await delay(SERVER_POLL_INTERVAL_MS);
  }

  throw new Error(`Server did not become ready within ${timeoutMs}ms.`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      headless: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Unable to launch Chromium. Run "./scripts/with-node.sh pnpm exec playwright install chromium" once, then retry.\n${message}`
    );
  }
}

async function createAuthenticatedStorageState(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  baseUrl: string
) {
  const authConfig = getAuthConfig();

  if (!authConfig.enabled) {
    return undefined;
  }

  const username =
    process.env.BENCH_AUTH_USERNAME?.trim() || authConfig.username;
  const password = process.env.BENCH_AUTH_PASSWORD ?? process.env.AUTH_PASSWORD;

  if (!password) {
    throw new Error(
      "Auth is enabled, but no benchmark password is available. Set BENCH_AUTH_PASSWORD or AUTH_PASSWORD."
    );
  }

  const context = await browser.newContext({
    baseURL: baseUrl
  });

  try {
    const page = await context.newPage();

    await page.goto("/login?next=%2F", {
      timeout: NAVIGATION_TIMEOUT_MS,
      waitUntil: "load"
    });
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill(password);
    await Promise.all([
      page.waitForURL((url) => url.pathname !== "/login", {
        timeout: NAVIGATION_TIMEOUT_MS
      }),
      page.getByRole("button", { name: "Entra" }).click()
    ]);
    await page.waitForLoadState("load", { timeout: NAVIGATION_TIMEOUT_MS });

    await context.storageState({ path: DEFAULT_STORAGE_STATE_PATH });
  } finally {
    await context.close();
  }

  return DEFAULT_STORAGE_STATE_PATH;
}

async function runWarmupCycles(options: {
  baseUrl: string;
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  storageStatePath?: string;
  warmupRuns: number;
}) {
  for (let warmupIndex = 0; warmupIndex < options.warmupRuns; warmupIndex += 1) {
    for (const route of BENCHMARK_ROUTES) {
      await measureRoute({
        baseUrl: options.baseUrl,
        browser: options.browser,
        route,
        runIndex: warmupIndex + 1,
        storageStatePath: options.storageStatePath
      });
    }
  }
}

async function runMeasuredCycles(options: {
  baseUrl: string;
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  runs: number;
  storageStatePath?: string;
}) {
  const samplesByRoute = new Map<RoutePath, RunSample[]>();

  for (let runIndex = 0; runIndex < options.runs; runIndex += 1) {
    console.info(`[perf] Measured cycle ${runIndex + 1}/${options.runs}...`);

    for (const route of BENCHMARK_ROUTES) {
      const sample = await measureRoute({
        baseUrl: options.baseUrl,
        browser: options.browser,
        route,
        runIndex: runIndex + 1,
        storageStatePath: options.storageStatePath
      });
      const routeSamples = samplesByRoute.get(route) ?? [];

      routeSamples.push(sample);
      samplesByRoute.set(route, routeSamples);
    }
  }

  return BENCHMARK_ROUTES.map((route) => {
    const samples = samplesByRoute.get(route) ?? [];
    const lastSample = samples.at(-1) ?? null;

    return {
      finalPath: lastSample?.finalPath ?? route,
      medianDomContentLoadedMs: calculateMedian(
        samples.map((sample) => sample.domContentLoadedMs)
      ),
      medianLoadEventMs: calculateMedian(
        samples.map((sample) => sample.loadEventMs)
      ),
      medianTotalTimeMs: calculateMedian(
        samples.map((sample) => sample.totalTimeMs)
      ),
      medianTtfbMs: calculateMedian(samples.map((sample) => sample.ttfbMs)),
      responseStatus: lastSample?.responseStatus ?? null,
      route,
      samples
    } satisfies RouteSummary;
  });
}

async function measureRoute(options: {
  baseUrl: string;
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  route: RoutePath;
  runIndex: number;
  storageStatePath?: string;
}): Promise<RunSample> {
  const context = await options.browser.newContext({
    baseURL: options.baseUrl,
    storageState: options.storageStatePath
  });

  try {
    const page = await context.newPage();
    const cdpSession = await context.newCDPSession(page);

    await cdpSession.send("Network.enable");
    await cdpSession.send("Network.setCacheDisabled", {
      cacheDisabled: true
    });

    const startedAt = nodePerformance.now();
    const response = await page.goto(options.route, {
      timeout: NAVIGATION_TIMEOUT_MS,
      waitUntil: "load"
    });
    const totalTimeMs = nodePerformance.now() - startedAt;
    const timing = await readNavigationTiming(page);

    if (!timing) {
      throw new Error(`No navigation timing entry was available for ${options.route}.`);
    }

    const finalUrl = new URL(page.url());

    return {
      domContentLoadedMs: timing.domContentLoadedMs,
      finalPath: `${finalUrl.pathname}${finalUrl.search}`,
      loadEventMs: timing.loadEventMs,
      responseStatus: response?.status() ?? null,
      route: options.route,
      runIndex: options.runIndex,
      totalTimeMs,
      ttfbMs: timing.ttfbMs
    };
  } finally {
    await context.close();
  }
}

function calculateMedian(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }

  return sorted[middleIndex];
}

async function readNavigationTiming(page: {
  evaluate: <T>(pageFunction: () => T) => Promise<T>;
  waitForLoadState: (
    state: "load",
    options: {
      timeout: number;
    }
  ) => Promise<void>;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(() => {
        const navigation = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming | undefined;

        if (!navigation) {
          return null;
        }

        return {
          domContentLoadedMs: navigation.domContentLoadedEventEnd,
          loadEventMs: navigation.loadEventEnd,
          ttfbMs: navigation.responseStart
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!message.includes("Execution context was destroyed") || attempt === 2) {
        throw error;
      }

      await page.waitForLoadState("load", {
        timeout: NAVIGATION_TIMEOUT_MS
      });
    }
  }

  return null;
}

function renderConsoleSummary(report: BenchmarkReport) {
  const header = [
    "Route".padEnd(55),
    "TTFB".padStart(10),
    "Load".padStart(10),
    "Total".padStart(10)
  ].join("  ");

  const rows = report.routes.map((route) =>
    [
      route.route.padEnd(55),
      formatMs(route.medianTtfbMs).padStart(10),
      formatMs(route.medianLoadEventMs).padStart(10),
      formatMs(route.medianTotalTimeMs).padStart(10)
    ].join("  ")
  );

  const redirectRows = report.routes
    .filter((route) => route.finalPath !== route.route)
    .map((route) => `${route.route} -> ${route.finalPath}`);

  const metadata = [
    "Benchmark summary",
    `Base URL: ${report.runtime.baseUrl}`,
    `Database: ${report.runtime.databaseMode} (${report.runtime.databaseLabel})`,
    `Database prepared: ${report.runtime.databasePrepared ? "yes" : "no"}`,
    `Auth: ${report.runtime.authEnabled ? "enabled" : "disabled"}`,
    `Warmup cycles: ${report.options.warmupRuns}`,
    `Measured runs: ${report.options.runs}`,
    "",
    header,
    "-".repeat(header.length),
    ...rows
  ];

  if (redirectRows.length > 0) {
    metadata.push("", "Redirects:", ...redirectRows);
  }

  return metadata.join("\n");
}

function renderMarkdownReport(report: BenchmarkReport) {
  const lines = [
    "# Performance baseline",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Runtime",
    "",
    `- Base URL: \`${report.runtime.baseUrl}\``,
    `- Database: \`${report.runtime.databaseMode}\` (\`${report.runtime.databaseLabel}\`)`,
    `- Database prepared: ${report.runtime.databasePrepared ? "yes" : "no"}`,
    `- Auth: ${report.runtime.authEnabled ? "enabled" : "disabled"}`,
    `- Warmup cycles: ${report.options.warmupRuns}`,
    `- Measured runs: ${report.options.runs}`,
    "",
    "## Median summary",
    "",
    "| Route | Final path | Median TTFB (ms) | Median load (ms) | Median total (ms) |",
    "| --- | --- | ---: | ---: | ---: |"
  ];

  for (const route of report.routes) {
    lines.push(
      `| \`${route.route}\` | \`${route.finalPath}\` | ${formatMs(route.medianTtfbMs)} | ${formatMs(route.medianLoadEventMs)} | ${formatMs(route.medianTotalTimeMs)} |`
    );
  }

  lines.push(
    "",
    "Metric notes:",
    "",
    "- `TTFB`: browser navigation timing `responseStart`.",
    "- `load`: browser navigation timing `loadEventEnd`.",
    "- `total`: wall-clock time around `page.goto(..., { waitUntil: \"load\" })`.",
    ""
  );

  return lines.join("\n");
}

function formatMs(value: number) {
  return value.toFixed(1);
}

function formatDatabaseLabel(databaseLabel: string) {
  const trimmed = databaseLabel.trim();

  if (trimmed.startsWith("file://")) {
    return trimmed.slice("file://".length);
  }

  return trimmed;
}

async function shutdownServer(child: ChildProcess | null) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  child.kill("SIGTERM");

  const timedOut = await Promise.race([
    once(child, "exit").then(() => false),
    delay(5_000).then(() => true)
  ]);

  if (timedOut) {
    child.kill("SIGKILL");
    await once(child, "exit").catch(() => undefined);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
