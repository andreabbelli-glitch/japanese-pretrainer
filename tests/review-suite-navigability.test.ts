import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const testsDirectory = path.join(process.cwd(), "tests");
const legacyReviewTestFile = "review.test.ts";
const navigabilityContractFile = "review-suite-navigability.test.ts";
const reviewTestFilePattern = /^review-.+\.test\.ts$/u;

function extractPrimaryStaticSuiteTitle(source: string) {
  const sourceFile = ts.createSourceFile(
    "review-suite.test.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement)) {
      continue;
    }

    const expression = statement.expression;

    if (
      !ts.isCallExpression(expression) ||
      !ts.isIdentifier(expression.expression) ||
      expression.expression.text !== "describe"
    ) {
      continue;
    }

    const title = expression.arguments[0];

    if (
      title &&
      (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))
    ) {
      return title.text;
    }
  }

  return null;
}

function listDuplicates(ownersByTitle: Map<string, string[]>) {
  return [...ownersByTitle]
    .filter(([, owners]) => owners.length > 1)
    .map(([title, owners]) => ({ title, owners }))
    .sort((left, right) => left.title.localeCompare(right.title));
}

describe("review suite navigability", () => {
  it.each([
    {
      expected: "review queue",
      source: 'describe("review queue", () => {});'
    },
    {
      expected: "review model",
      source: "describe(`review model`, () => {});"
    },
    {
      expected: null,
      source: '// describe("comment-only", () => {});'
    },
    {
      expected: null,
      source: "const note = 'describe(\"string-only\", () => {})';"
    },
    {
      expected: null,
      source: 'function register() { describe("nested", () => {}); }'
    },
    {
      expected: null,
      source: 'describe.each([[1]])("parameterized", () => {});'
    },
    {
      expected: null,
      source: "describe(suiteTitle, () => {});"
    }
  ])("recognizes only a top-level suite with a static title", (fixture) => {
    expect(extractPrimaryStaticSuiteTitle(fixture.source)).toBe(
      fixture.expected
    );
  });

  it("keeps review tests in discoverable suites with distinct responsibilities", async () => {
    await expect(
      access(path.join(testsDirectory, legacyReviewTestFile))
    ).rejects.toThrow();

    const reviewTestFiles = (
      await readdir(testsDirectory, { withFileTypes: true })
    )
      .filter(
        (entry) =>
          entry.isFile() &&
          reviewTestFilePattern.test(entry.name) &&
          entry.name !== navigabilityContractFile
      )
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    const filesWithoutSuiteTitle: string[] = [];
    const ownersByTitle = new Map<string, string[]>();

    expect(reviewTestFiles.length).toBeGreaterThan(0);

    for (const fileName of reviewTestFiles) {
      const source = await readFile(
        path.join(testsDirectory, fileName),
        "utf8"
      );
      const suiteTitle = extractPrimaryStaticSuiteTitle(source);

      if (!suiteTitle) {
        filesWithoutSuiteTitle.push(fileName);
      } else {
        ownersByTitle.set(suiteTitle, [
          ...(ownersByTitle.get(suiteTitle) ?? []),
          fileName
        ]);
      }
    }

    expect(filesWithoutSuiteTitle).toEqual([]);
    expect(listDuplicates(ownersByTitle)).toEqual([]);
  });
});
