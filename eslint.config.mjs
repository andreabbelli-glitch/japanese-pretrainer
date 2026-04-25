import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const textbookLegacyImportRestrictions = [
  {
    name: "@/lib/textbook",
    message:
      "Production textbook surfaces must import from @/features/textbook/server instead."
  },
  {
    name: "@/lib/textbook-reader-state",
    message:
      "Production textbook surfaces must import from @/features/textbook/client/reader-state instead."
  },
  {
    name: "@/lib/textbook-types",
    message:
      "Production textbook surfaces must import from @/features/textbook/types instead."
  }
];

const glossaryLegacyImportRestrictionPatterns = [
  {
    group: ["@/lib/glossary", "@/lib/glossary-*"],
    message:
      "Production glossary surfaces must import from @/features/glossary instead."
  }
];

const glossaryClientImportRestrictionPatterns = [
  ...glossaryLegacyImportRestrictionPatterns,
  {
    group: ["@/features/glossary/server", "@/features/glossary/server/*"],
    message:
      "Glossary client/type consumers must not import the server feature entrypoint."
  }
];

const pureReviewImportRestrictionPatterns = [
  {
    group: ["@/db", "@/db/*", "../db", "../db/*", "../../db", "../../db/*"],
    message:
      "Pure review modules must depend on app-owned contracts, not DB modules."
  },
  {
    group: ["next", "next/*"],
    message: "Pure review modules must not depend on Next.js framework types."
  }
];

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".claude/worktrees/**",
      ".next/**",
      "coverage/**",
      "dist/**",
      "playwright-report/**",
      "pnpm-lock.yaml"
    ]
  },
  {
    files: [
      "src/actions/textbook.ts",
      "src/app/media/*/textbook/**/*.{ts,tsx}",
      "src/components/textbook/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: textbookLegacyImportRestrictions
        }
      ]
    }
  },
  {
    files: ["src/components/textbook/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            ...textbookLegacyImportRestrictions,
            {
              name: "@/features/textbook/server",
              message:
                "Textbook client components must not import the server feature entrypoint."
            }
          ],
          patterns: [
            {
              group: ["@/features/textbook/server/*"],
              message:
                "Textbook client components must not import the server feature entrypoint."
            }
          ]
        }
      ]
    }
  },
  {
    files: [
      "src/app/api/glossary/**/*.{ts,tsx}",
      "src/app/glossary/**/*.{ts,tsx}",
      "src/app/glossary/*.{ts,tsx}",
      "src/app/media/*/glossary/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: glossaryLegacyImportRestrictionPatterns
        }
      ]
    }
  },
  {
    files: [
      "src/components/glossary/**/*.{ts,tsx}",
      "src/components/review/review-page-stage.tsx",
      "src/components/review/review-page-state.ts",
      "src/components/review/use-review-page-controller.ts"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: glossaryClientImportRestrictionPatterns
        }
      ]
    }
  },
  {
    files: [
      "src/lib/review-card-contract.ts",
      "src/lib/review-model.ts",
      "src/lib/review-subject.ts",
      "src/lib/review-queue.ts",
      "src/lib/review-queue-types.ts",
      "src/lib/review-subject-state-lookup.ts"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: pureReviewImportRestrictionPatterns
        }
      ]
    }
  }
];

export default eslintConfig;
