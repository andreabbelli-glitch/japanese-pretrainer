CREATE TABLE `runtime_snapshot` (
	`key` text PRIMARY KEY NOT NULL,
	`schema_version` integer NOT NULL,
	`payload_json` text NOT NULL,
	`payload_etag` text NOT NULL,
	`generated_at` text NOT NULL,
	`refresh_not_before` text NOT NULL,
	`payload_bytes` integer NOT NULL,
	`build_duration_ms` integer NOT NULL,
	`updated_at` text NOT NULL
);
