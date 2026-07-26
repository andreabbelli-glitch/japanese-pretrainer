CREATE TABLE `review_fsrs_parameter_set` (
	`parameter_hash` text PRIMARY KEY NOT NULL,
	`algorithm_version` text NOT NULL,
	`scheduler_version` text NOT NULL,
	`binding_version` text NOT NULL,
	`recall_task` text NOT NULL,
	`desired_retention` real NOT NULL,
	`parameters_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_fsrs_parameter_set_task_created_idx` ON `review_fsrs_parameter_set` (`recall_task`,`created_at`);--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `event_kind` text DEFAULT 'grade' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `event_schema_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `canonical_subject_key` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `recall_task` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `card_type_snapshot` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `media_id_snapshot` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `recorded_at` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `study_day` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `study_day_policy` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `previous_due_at` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `algorithm_version` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `binding_version` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `parameter_hash` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `before_state_json` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `after_state_json` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `batch_id` text;--> statement-breakpoint
ALTER TABLE `review_subject_log` ADD `reason` text;--> statement-breakpoint
CREATE INDEX `review_subject_log_training_idx` ON `review_subject_log` (`event_kind`,`recall_task`,`subject_key`,`answered_at`,`id`);--> statement-breakpoint
CREATE INDEX `review_subject_log_study_day_idx` ON `review_subject_log` (`event_kind`,`study_day`,`previous_state`,`subject_key`,`media_id_snapshot`);