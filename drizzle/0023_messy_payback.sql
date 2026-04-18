CREATE TABLE `kanji_clash_manual_contrast` (
	`contrast_key` text PRIMARY KEY NOT NULL,
	`subject_a_key` text NOT NULL,
	`subject_b_key` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`times_confirmed` integer DEFAULT 0 NOT NULL,
	`last_confirmed_at` text,
	`last_forced_at` text,
	`forced_due_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kanji_clash_manual_contrast_subject_unique` ON `kanji_clash_manual_contrast` (`subject_a_key`,`subject_b_key`);--> statement-breakpoint
CREATE INDEX `kanji_clash_manual_contrast_status_idx` ON `kanji_clash_manual_contrast` (`status`);--> statement-breakpoint
CREATE INDEX `kanji_clash_manual_contrast_source_idx` ON `kanji_clash_manual_contrast` (`source`);--> statement-breakpoint
CREATE INDEX `kanji_clash_manual_contrast_forced_due_idx` ON `kanji_clash_manual_contrast` (`forced_due_at`);--> statement-breakpoint
CREATE INDEX `kanji_clash_manual_contrast_updated_idx` ON `kanji_clash_manual_contrast` (`updated_at`);--> statement-breakpoint
CREATE TABLE `kanji_clash_manual_contrast_round_log` (
	`id` text PRIMARY KEY NOT NULL,
	`round_key` text NOT NULL,
	`contrast_key` text NOT NULL,
	`direction` text NOT NULL,
	`answered_at` text NOT NULL,
	`target_subject_key` text NOT NULL,
	`correct_subject_key` text NOT NULL,
	`chosen_subject_key` text NOT NULL,
	`left_subject_key` text NOT NULL,
	`right_subject_key` text NOT NULL,
	`result` text NOT NULL,
	`previous_state` text,
	`new_state` text,
	`scheduled_due_at` text,
	`elapsed_days` real,
	`response_ms` integer,
	`scheduler_version` text DEFAULT 'kanji_clash_manual_contrast_fsrs_v1' NOT NULL,
	FOREIGN KEY (`round_key`) REFERENCES `kanji_clash_manual_contrast_round_state`(`round_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contrast_key`) REFERENCES `kanji_clash_manual_contrast`(`contrast_key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kanji_clash_manual_contrast_round_log_round_answered_idx` ON `kanji_clash_manual_contrast_round_log` (`round_key`,`answered_at`);--> statement-breakpoint
CREATE INDEX `kanji_clash_manual_contrast_round_log_contrast_direction_answered_idx` ON `kanji_clash_manual_contrast_round_log` (`contrast_key`,`direction`,`answered_at`);--> statement-breakpoint
CREATE INDEX `kanji_clash_manual_contrast_round_log_target_answered_idx` ON `kanji_clash_manual_contrast_round_log` (`target_subject_key`,`answered_at`);--> statement-breakpoint
CREATE TABLE `kanji_clash_manual_contrast_round_state` (
	`round_key` text PRIMARY KEY NOT NULL,
	`contrast_key` text NOT NULL,
	`direction` text NOT NULL,
	`target_subject_key` text NOT NULL,
	`state` text NOT NULL,
	`stability` real,
	`difficulty` real,
	`due_at` text,
	`last_reviewed_at` text,
	`last_interaction_at` text NOT NULL,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`scheduler_version` text DEFAULT 'kanji_clash_manual_contrast_fsrs_v1' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`contrast_key`) REFERENCES `kanji_clash_manual_contrast`(`contrast_key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kanji_clash_manual_contrast_round_state_unique` ON `kanji_clash_manual_contrast_round_state` (`contrast_key`,`direction`);--> statement-breakpoint
CREATE INDEX `kanji_clash_manual_contrast_round_state_due_idx` ON `kanji_clash_manual_contrast_round_state` (`due_at`);--> statement-breakpoint
CREATE INDEX `kanji_clash_manual_contrast_round_state_interaction_idx` ON `kanji_clash_manual_contrast_round_state` (`last_interaction_at`);--> statement-breakpoint
CREATE INDEX `kanji_clash_manual_contrast_round_state_state_idx` ON `kanji_clash_manual_contrast_round_state` (`state`);