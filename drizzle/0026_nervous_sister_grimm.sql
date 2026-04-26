CREATE TABLE `katakana_confusion_edge` (
	`edge_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text,
	`block_id` text,
	`expected_item_id` text NOT NULL,
	`observed_item_id` text NOT NULL,
	`confusion_count` integer DEFAULT 1 NOT NULL,
	`sort_order` integer NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `katakana_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`block_id`) REFERENCES `katakana_exercise_block`(`block_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `katakana_confusion_edge_session_sort_idx` ON `katakana_confusion_edge` (`session_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `katakana_confusion_edge_exercise_sort_idx` ON `katakana_confusion_edge` (`exercise_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `katakana_confusion_edge_pair_idx` ON `katakana_confusion_edge` (`expected_item_id`,`observed_item_id`);--> statement-breakpoint
CREATE TABLE `katakana_exercise_block` (
	`block_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`mode` text NOT NULL,
	`sort_order` integer NOT NULL,
	`title` text,
	`item_type` text,
	`focus_chunks_json` text DEFAULT '[]' NOT NULL,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `katakana_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `katakana_exercise_block_session_sort_idx` ON `katakana_exercise_block` (`session_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `katakana_exercise_block_exercise_sort_idx` ON `katakana_exercise_block` (`exercise_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `katakana_exercise_result` (
	`result_id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`block_id` text,
	`trial_id` text,
	`sort_order` integer NOT NULL,
	`is_correct` integer,
	`self_rating` text,
	`metrics_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `katakana_session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`block_id`) REFERENCES `katakana_exercise_block`(`block_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trial_id`) REFERENCES `katakana_trial`(`trial_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `katakana_exercise_result_session_sort_idx` ON `katakana_exercise_result` (`session_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `katakana_exercise_result_exercise_sort_idx` ON `katakana_exercise_result` (`exercise_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `katakana_exercise_result_block_sort_idx` ON `katakana_exercise_result` (`block_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `exercise_id` text;--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `block_id` text REFERENCES katakana_exercise_block(block_id);--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `expected_surface` text;--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `item_type` text;--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `features_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `focus_chunks_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `self_rating` text;--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `was_pseudo` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `was_transfer` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `was_repair` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_attempt_log` ADD `metrics_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX `katakana_attempt_log_session_sort_idx` ON `katakana_attempt_log` (`session_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `katakana_attempt_log_block_sort_idx` ON `katakana_attempt_log` (`block_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `exercise_id` text;--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `block_id` text REFERENCES katakana_exercise_block(block_id);--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `expected_surface` text;--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `item_type` text;--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `features_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `focus_chunks_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `self_rating` text;--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `was_pseudo` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `was_transfer` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `was_repair` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `katakana_trial` ADD `metrics_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX `katakana_trial_session_sort_idx` ON `katakana_trial` (`session_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `katakana_trial_block_sort_idx` ON `katakana_trial` (`block_id`,`sort_order`);