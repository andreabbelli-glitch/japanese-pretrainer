import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

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
  }
];

export default eslintConfig;
