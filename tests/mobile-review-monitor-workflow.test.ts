import { readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const workflowPath = path.join(
  process.cwd(),
  ".github",
  "workflows",
  "mobile-review-notifications.yml"
);

describe("mobile review notification monitor workflow", () => {
  it("stays a suspended manual-only free-tier curl monitor", async () => {
    const source = await readFile(workflowPath, "utf8");
    const workflow = parse(source) as {
      jobs?: Record<
        string,
        {
          env?: Record<string, string>;
          steps?: Array<Record<string, unknown>>;
        }
      >;
      on?: {
        workflow_dispatch?: unknown;
        schedule?: Array<{ cron?: string }>;
      };
    };
    const monitor = workflow.jobs?.monitor;
    const steps = monitor?.steps ?? [];

    expect(workflow.on?.schedule).toBeUndefined();
    expect(workflow.on?.workflow_dispatch).toBeDefined();
    expect(monitor?.env).toMatchObject({
      MONITOR_SECRET: "${{ secrets.MOBILE_NOTIFICATION_MONITOR_SECRET }}",
      MONITOR_URL: "${{ secrets.MOBILE_REVIEW_NOTIFICATION_MONITOR_URL }}"
    });
    expect(source).toContain("curl --fail --silent --show-error");
    expect(source).toContain(
      "Mobile review notification monitor is not configured; skipping tick."
    );
    expect(source).toContain("exit 0");
    expect(source).not.toContain("actions/checkout");
    expect(source).not.toContain("actions/setup-node");
    expect(source).not.toContain("TURSO_");
    expect(source).not.toContain("APNS");
    expect(source).not.toContain("cron:");
    expect(steps).toHaveLength(1);
  });

  it("documents the suspension, free-tier boundaries, and secret boundaries", async () => {
    const [readme, devTooling, verificationNotes] = await Promise.all([
      readFile(path.join(process.cwd(), "README.md"), "utf8"),
      readFile(path.join(process.cwd(), "docs", "dev-tooling.md"), "utf8"),
      readFile(
        path.join(process.cwd(), "docs", "local-verification-notes.md"),
        "utf8"
      )
    ]);
    const combined = `${readme}\n${devTooling}\n${verificationNotes}`;

    expect(combined).toContain("sospes");
    expect(combined).toContain("manual");
    expect(combined).toContain("0 chiamate automatiche");
    expect(combined).toContain("288");
    expect(combined).toContain("8.640");
    expect(combined).toContain("MOBILE_REVIEW_NOTIFICATION_MONITOR_URL");
    expect(combined).toContain("MOBILE_NOTIFICATION_MONITOR_SECRET");
    expect(combined).toContain(
      "https://vercel.com/docs/cron-jobs/usage-and-pricing"
    );
    expect(combined).toContain(
      "https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions"
    );
  });
});
