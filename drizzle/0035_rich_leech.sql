CREATE TABLE `review_canonical_control` (
	`canonical_subject_key` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_memory_alias` (
	`alias_memory_key` text PRIMARY KEY NOT NULL,
	`current_memory_key` text NOT NULL,
	`reason` text NOT NULL,
	`migrated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_memory_alias_current_idx` ON `review_memory_alias` (`current_memory_key`);--> statement-breakpoint
ALTER TABLE `pre_review_consolidation_state` ADD `canonical_subject_key` text;--> statement-breakpoint
ALTER TABLE `pre_review_consolidation_state` ADD `recall_task` text;--> statement-breakpoint
CREATE INDEX `pre_review_consolidation_canonical_task_idx` ON `pre_review_consolidation_state` (`canonical_subject_key`,`recall_task`);--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `memory_key` text;--> statement-breakpoint
CREATE INDEX `review_subject_log_memory_idx` ON `review_subject_log` (`memory_key`);--> statement-breakpoint
ALTER TABLE `review_subject_state` ADD `canonical_subject_key` text;--> statement-breakpoint
ALTER TABLE `review_subject_state` ADD `recall_task` text;--> statement-breakpoint
CREATE INDEX `review_subject_state_canonical_task_idx` ON `review_subject_state` (`canonical_subject_key`,`recall_task`);