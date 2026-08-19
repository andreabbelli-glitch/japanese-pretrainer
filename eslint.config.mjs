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

const reviewLegacyImportRestrictionPatterns = [
  {
    group: ["@/lib/review", "@/lib/review-*"],
    message:
      "Production review surfaces must import from @/features/review instead."
  }
];

const reviewClientImportRestrictionPatterns = [
  ...reviewLegacyImportRestrictionPatterns,
  {
    group: ["@/features/review/server", "@/features/review/server/*"],
    message:
      "Review client components must not import the server feature entrypoint."
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

const serverActionImportRestrictionPatterns = [
  {
    group: ["@/db", "@/db/*", "../db", "../db/*", "../../db", "../../db/*"],
    message:
      "Server actions must not import database modules. Move DB access behind a feature server use case."
  },
  {
    group: ["drizzle-orm", "drizzle-orm/*"],
    message:
      "Server actions must not build DB queries. Move query logic behind a feature server use case."
  },
  {
    group: [
      "@/features/*/client",
      "@/features/*/client/*",
      "@/features/*/model",
      "@/features/*/model/*",
      "@/features/*/tooling",
      "@/features/*/tooling/*",
      "@/features/*/ui",
      "@/features/*/ui/*"
    ],
    message:
      "Server actions must call feature server facades, not feature internals."
  },
  {
    group: ["@/features/*/server/*"],
    message:
      "Server actions must import feature server barrels only. Export action-safe use cases from @/features/<feature>/server."
  }
];

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".DS_Store",
      ".agents/**/*.md",
      ".agents/**/*.sh",
      ".agents/**/*.yaml",
      ".agents/**/*.yml",
      ".claude/**",
      ".codex-review-temp/**",
      ".codex/**",
      ".next/**",
      ".playwright-cli/**",
      ".playwright-mcp/**",
      ".tmp/**",
      ".vercel/**",
      ".worktrees/**",
      "coverage/**",
      "data/**",
      "dist/**",
      "node_modules/**",
      "output/**",
      "playwright-report/**",
      "prompts/**",
      "test-results/**",
      "tmp/**",
      "*.db",
      "*.sqlite",
      "*.sqlite3",
      "*.tsbuildinfo",
      "pnpm-lock.yaml"
    ]
  },
  {
    files: ["src/actions/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: serverActionImportRestrictionPatterns
        }
      ]
    }
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
    files: ["src/components/glossary/**/*.{ts,tsx}"],
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
      "src/actions/review.ts",
      "src/app/review/*.{ts,tsx}",
      "src/app/review/**/*.{ts,tsx}",
      "src/app/media/*/review/*.{ts,tsx}",
      "src/app/media/*/review/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: reviewLegacyImportRestrictionPatterns
        }
      ]
    }
  },
  {
    files: ["src/components/review/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...reviewClientImportRestrictionPatterns,
            ...glossaryClientImportRestrictionPatterns
          ]
        }
      ]
    }
  },
  {
    files: [
      "src/features/review/model/card-contract.ts",
      "src/features/review/model/state.ts",
      "src/features/review/model/subject.ts",
      "src/features/review/model/queue.ts",
      "src/features/review/model/queue-types.ts",
      "src/features/review/server/subject-state-lookup.ts"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: pureReviewImportRestrictionPatterns
        }
      ]
    }
  },
  {
    files: ["src/actions/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: textbookLegacyImportRestrictions,
          patterns: [
            ...serverActionImportRestrictionPatterns,
            ...glossaryLegacyImportRestrictionPatterns,
            ...reviewLegacyImportRestrictionPatterns
          ]
        }
      ]
    }
  }
];

export default eslintConfig;
