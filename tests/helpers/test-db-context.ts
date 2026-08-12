export const TEST_DATABASE_TEMPLATE_CONTEXT_KEY =
  "testDatabaseTemplatePath" as const;

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseTemplatePath: string;
  }
}
