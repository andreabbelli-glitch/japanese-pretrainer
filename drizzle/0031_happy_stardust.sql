CREATE TABLE `pitch_accent_attempt_log` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`trial_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`pair_id` text NOT NULL,
	`kana` text NOT NULL,
	`chosen_option_id` text NOT NULL,
	`correct_option_id` text NOT NULL,
	`is_correct` integer NOT NULL,
	`pattern_key` text NOT NULL,
	`response_ms` integer NOT NULL,
	`input_method` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `pitch_accent_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trial_id`) REFERENCES `pitch_accent_trial`(`trial_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pitch_accent_attempt_log_trial_unique` ON `pitch_accent_attempt_log` (`trial_id`);--> statement-breakpoint
CREATE INDEX `pitch_accent_attempt_log_session_created_idx` ON `pitch_accent_attempt_log` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `pitch_accent_attempt_log_pair_created_idx` ON `pitch_accent_attempt_log` (`pair_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `pitch_accent_session` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`duration_ms` integer,
	`total_trials` integer DEFAULT 0 NOT NULL,
	`total_attempts` integer DEFAULT 0 NOT NULL,
	`correct_attempts` integer DEFAULT 0 NOT NULL,
	`filters_json` text DEFAULT '{}' NOT NULL,
	`pattern_stats_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pitch_accent_session_status_started_idx` ON `pitch_accent_session` (`status`,`started_at`);--> statement-breakpoint
CREATE TABLE `pitch_accent_trial` (
	`trial_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`pair_id` text NOT NULL,
	`kana` text NOT NULL,
	`correct_option_id` text NOT NULL,
	`correct_pattern_key` text NOT NULL,
	`options_json` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`answered_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `pitch_accent_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pitch_accent_trial_session_sort_idx` ON `pitch_accent_trial` (`session_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `pitch_accent_trial_pair_idx` ON `pitch_accent_trial` (`pair_id`);