import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const runtimeSnapshot = sqliteTable("runtime_snapshot", {
  key: text("key").primaryKey(),
  schemaVersion: integer("schema_version").notNull(),
  payloadJson: text("payload_json").notNull(),
  payloadEtag: text("payload_etag").notNull(),
  generatedAt: text("generated_at").notNull(),
  refreshNotBefore: text("refresh_not_before").notNull(),
  payloadBytes: integer("payload_bytes").notNull(),
  buildDurationMs: integer("build_duration_ms").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const runtimeJobLease = sqliteTable("runtime_job_lease", {
  key: text("key").primaryKey(),
  ownerToken: text("owner_token").notNull(),
  expiresAt: text("expires_at").notNull(),
  updatedAt: text("updated_at").notNull()
});
