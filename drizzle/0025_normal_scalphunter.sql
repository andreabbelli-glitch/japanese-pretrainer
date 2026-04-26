CREATE TABLE `katakana_attempt_log` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`trial_id` text NOT NULL,
	`item_id` text NOT NULL,
	`mode` text NOT NULL,
	`prompt_surface` text NOT NULL,
	`expected_answer` text NOT NULL,
	`user_answer` text NOT NULL,
	`is_correct` integer NOT NULL,
	`response_ms` integer NOT NULL,
	`exposure_ms` integer,
	`error_tags_json` text DEFAULT '[]' NOT NULL,
	`confused_with_item_id` text,
	`input_method` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `katakana_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trial_id`) REFERENCES `katakana_trial`(`trial_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `katakana_attempt_log_trial_unique` ON `katakana_attempt_log` (`trial_id`);--> statement-breakpoint
CREATE INDEX `katakana_attempt_log_session_created_idx` ON `katakana_attempt_log` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `katakana_attempt_log_item_created_idx` ON `katakana_attempt_log` (`item_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `katakana_item_state` (
	`item_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`correct_streak` integer DEFAULT 0 NOT NULL,
	`slow_streak` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` text,
	`last_correct_at` text,
	`last_response_ms` integer,
	`last_error_tags_json` text DEFAULT '[]' NOT NULL,
	`seen_count` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`wrong_count` integer DEFAULT 0 NOT NULL,
	`slow_correct_count` integer DEFAULT 0 NOT NULL,
	`best_rt_ms` integer,
	`recent_response_ms_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `katakana_item_state_status_idx` ON `katakana_item_state` (`status`);--> statement-breakpoint
CREATE INDEX `katakana_item_state_updated_idx` ON `katakana_item_state` (`updated_at`);--> statement-breakpoint
CREATE TABLE `katakana_session` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`duration_ms` integer,
	`total_attempts` integer DEFAULT 0 NOT NULL,
	`correct_attempts` integer DEFAULT 0 NOT NULL,
	`slow_correct_count` integer DEFAULT 0 NOT NULL,
	`median_rt_ms` integer,
	`p90_rt_ms` integer,
	`main_error_tags_json` text DEFAULT '[]' NOT NULL,
	`main_confusions_json` text DEFAULT '[]' NOT NULL,
	`recommended_focus_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `katakana_session_status_started_idx` ON `katakana_session` (`status`,`started_at`);--> statement-breakpoint
CREATE TABLE `katakana_trial` (
	`trial_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`item_id` text NOT NULL,
	`mode` text NOT NULL,
	`prompt_surface` text NOT NULL,
	`option_item_ids_json` text NOT NULL,
	`correct_item_id` text NOT NULL,
	`target_rt_ms` integer NOT NULL,
	`exposure_ms` integer,
	`shown_at` text,
	`answered_at` text,
	`status` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `katakana_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `katakana_trial_session_status_idx` ON `katakana_trial` (`session_id`,`status`);