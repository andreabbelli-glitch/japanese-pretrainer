import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultCliTimeoutMs = 45_000;
const defaultCliMaxBuffer = 8 * 1024 * 1024;

type RunNodeCliOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
};

export function runNodeCli(args: string[], options: RunNodeCliOptions = {}) {
  return execFileAsync(process.execPath, args, {
    cwd: options.cwd ?? process.cwd(),
    env: buildTestCliEnv(options.env),
    killSignal: "SIGKILL",
    maxBuffer: defaultCliMaxBuffer,
    timeout: options.timeoutMs ?? defaultCliTimeoutMs
  });
}

function buildTestCliEnv(overrides: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    NO_COLOR: "1"
  };

  delete env.DATABASE_AUTH_TOKEN;
  delete env.DATABASE_URL;
  delete env.LIBSQL_AUTH_TOKEN;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
      continue;
    }

    env[key] = value;
  }

  return env;
}
