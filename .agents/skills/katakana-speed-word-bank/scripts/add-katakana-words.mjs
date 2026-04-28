#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(scriptPath, "../../../../../");
const wordBankPath = path.join(
  repoRoot,
  "src/features/katakana-speed/model/media-word-bank.json"
);

const args = process.argv.slice(2);
const inputWords = [];
let dryRun = false;
let source = "custom";
let wordsFile = null;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--dry-run") {
    dryRun = true;
    continue;
  }
  if (arg === "--source") {
    source = readOptionValue(args, (index += 1), "--source");
    continue;
  }
  if (arg === "--word") {
    inputWords.push(readOptionValue(args, (index += 1), "--word"));
    continue;
  }
  if (arg === "--words-file") {
    wordsFile = readOptionValue(args, (index += 1), "--words-file");
    continue;
  }
  if (arg === "--help" || arg === "-h") {
    printHelp();
    process.exit(0);
  }
  inputWords.push(arg);
}

if (!/^[a-z0-9][a-z0-9-]*$/u.test(source)) {
  throw new Error(`Invalid source slug: ${source}`);
}

if (wordsFile) {
  const fileText = await readFile(path.resolve(wordsFile), "utf8");
  inputWords.push(
    ...fileText
      .split(/\r?\n/u)
      .map((line) => line.replace(/#.*/u, "").trim())
      .filter(Boolean)
  );
}

const normalizedWords = unique(
  inputWords.map(normalizeWord).filter((word) => word.length > 0)
);
if (normalizedWords.length === 0) {
  throw new Error("No katakana words were provided.");
}

const invalidWords = normalizedWords.filter((word) => !containsKatakana(word));
if (invalidWords.length > 0) {
  throw new Error(
    `Every word must contain katakana. Invalid: ${invalidWords.join(", ")}`
  );
}

const wordBank = JSON.parse(await readFile(wordBankPath, "utf8"));
const existing = new Set(
  Object.values(wordBank)
    .flat()
    .map((word) => normalizeWord(String(word)))
);
const sourceWords = Array.isArray(wordBank[source]) ? wordBank[source] : [];
const additions = normalizedWords.filter((word) => !existing.has(word));

const nextWordBank = {
  ...wordBank,
  [source]: [...sourceWords, ...additions]
};

if (!dryRun && additions.length > 0) {
  await writeFile(wordBankPath, `${JSON.stringify(nextWordBank, null, 2)}\n`);
}

console.log(
  JSON.stringify(
    {
      added: additions,
      dryRun,
      skippedDuplicates: normalizedWords.filter((word) => existing.has(word)),
      source,
      wordBankPath
    },
    null,
    2
  )
);

function readOptionValue(values, index, option) {
  const value = values[index];
  if (!value) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function normalizeWord(value) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function containsKatakana(value) {
  return /[\u30a0-\u30ff]/u.test(value);
}

function unique(values) {
  return [...new Set(values)];
}

function printHelp() {
  console.log(`Usage:
  add-katakana-words.mjs --source custom --word カタカナ
  add-katakana-words.mjs --source <media-slug> --words-file /path/list.txt

Options:
  --source       Source bucket in media-word-bank.json. Defaults to custom.
  --word         Katakana surface to append. Repeatable.
  --words-file   One katakana surface per line. # comments are ignored.
  --dry-run      Print additions without writing.
`);
}
