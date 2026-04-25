import { describe, expect, it } from "vitest";

import * as dbPublicEntrypoint from "@/db";
import type {
  DatabaseClient,
  DatabaseClientOptions,
  DatabaseQueryClient
} from "@/db";

type RuntimeExportName = keyof typeof dbPublicEntrypoint;
type PublicClientTypes = [
  DatabaseClient,
  DatabaseClientOptions,
  DatabaseQueryClient
];
type ExpectNever<T extends never> = T;
type ForbiddenRuntimeExports = Extract<
  RuntimeExportName,
  | "card"
  | "developmentFixture"
  | "getMediaBySlug"
  | "resolveDatabaseLocation"
  | "runMigrations"
  | "seedDevelopmentDatabase"
>;

function acceptsNoForbiddenTypes(
  assertions: [
    ExpectNever<ForbiddenRuntimeExports>,
    // @ts-expect-error Query DTO types must not be re-exported from the root barrel.
    import("@/db").ReviewCardListItem,
    // @ts-expect-error Schema/domain types must be imported from explicit modules.
    import("@/db").EntryType
  ]
): boolean {
  return Array.isArray(assertions);
}

const expectedRuntimeExports = [
  "closeDatabaseClient",
  "createDatabaseClient",
  "db"
] satisfies RuntimeExportName[];

function acceptsPublicClientTypes(publicTypes: PublicClientTypes): boolean {
  return Array.isArray(publicTypes);
}

describe("database public entrypoint", () => {
  it("only exposes runtime client exports from the root barrel", () => {
    const exportedNames = Object.keys(dbPublicEntrypoint).sort();

    expect(exportedNames).toEqual(expectedRuntimeExports);
  });

  it("keeps client types available from the root entrypoint", () => {
    expect(acceptsPublicClientTypes([] as unknown as PublicClientTypes)).toBe(
      true
    );
    expect(
      acceptsNoForbiddenTypes(
        [] as unknown as Parameters<typeof acceptsNoForbiddenTypes>[0]
      )
    ).toBe(true);
  });
});
