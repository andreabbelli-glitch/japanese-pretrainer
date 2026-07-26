PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_review_subject_log` (
	`id` text PRIMARY KEY NOT NULL,
	`event_kind` text DEFAULT 'grade' NOT NULL,
	`event_schema_version` integer DEFAULT 0 NOT NULL,
	`subject_key` text NOT NULL,
	`canonical_subject_key` text,
	`recall_task` text,
	`card_id` text NOT NULL,
	`card_type_snapshot` text,
	`media_id_snapshot` text,
	`answered_at` text NOT NULL,
	`recorded_at` text,
	`study_day` text,
	`study_day_policy` text,
	`rating` text,
	`previous_state` text,
	`new_state` text,
	`previous_due_at` text,
	`scheduled_due_at` text,
	`elapsed_days` real,
	`response_ms` integer,
	`scheduler_version` text DEFAULT 'fsrs_v1' NOT NULL,
	`algorithm_version` text,
	`binding_version` text,
	`parameter_hash` text,
	`before_state_json` text,
	`after_state_json` text,
	`batch_id` text,
	`reason` text
);
--> statement-breakpoint
INSERT INTO `__new_review_subject_log`("id", "event_kind", "event_schema_version", "subject_key", "canonical_subject_key", "recall_task", "card_id", "card_type_snapshot", "media_id_snapshot", "answered_at", "recorded_at", "study_day", "study_day_policy", "rating", "previous_state", "new_state", "previous_due_at", "scheduled_due_at", "elapsed_days", "response_ms", "scheduler_version", "algorithm_version", "binding_version", "parameter_hash", "before_state_json", "after_state_json", "batch_id", "reason") SELECT "id", "event_kind", "event_schema_version", "subject_key", "canonical_subject_key", "recall_task", "card_id", "card_type_snapshot", "media_id_snapshot", "answered_at", "recorded_at", "study_day", "study_day_policy", "rating", "previous_state", "new_state", "previous_due_at", "scheduled_due_at", "elapsed_days", "response_ms", "scheduler_version", "algorithm_version", "binding_version", "parameter_hash", "before_state_json", "after_state_json", "batch_id", "reason" FROM `review_subject_log`;--> statement-breakpoint
DROP TABLE `review_subject_log`;--> statement-breakpoint
ALTER TABLE `__new_review_subject_log` RENAME TO `review_subject_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `review_subject_log_subject_answered_idx` ON `review_subject_log` (`subject_key`,`answered_at`);--> statement-breakpoint
CREATE INDEX `review_subject_log_card_answered_idx` ON `review_subject_log` (`card_id`,`answered_at`);--> statement-breakpoint
CREATE INDEX `review_subject_log_introduced_day_idx` ON `review_subject_log` (`previous_state`,`answered_at`,`subject_key`,`card_id`);--> statement-breakpoint
CREATE INDEX `review_subject_log_training_idx` ON `review_subject_log` (`event_kind`,`recall_task`,`subject_key`,`answered_at`,`id`);--> statement-breakpoint
CREATE INDEX `review_subject_log_study_day_idx` ON `review_subject_log` (`event_kind`,`study_day`,`previous_state`,`subject_key`,`media_id_snapshot`);