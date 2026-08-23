CREATE TABLE `runtime_job_lease` (
	`key` text PRIMARY KEY NOT NULL,
	`owner_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL
);
