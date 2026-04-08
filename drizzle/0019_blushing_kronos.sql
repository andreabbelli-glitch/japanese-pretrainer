CREATE TABLE `kanji_clash_pair_log` (
	`id` text PRIMARY KEY NOT NULL,
	`pair_key` text NOT NULL,
	`mode` text NOT NULL,
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
	`scheduler_version` text DEFAULT 'kanji_clash_fsrs_v1' NOT NULL,
	FOREIGN KEY (`pair_key`) REFERENCES `kanji_clash_pair_state`(`pair_key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kanji_clash_pair_log_pair_answered_idx` ON `kanji_clash_pair_log` (`pair_key`,`answered_at`);--> statement-breakpoint
CREATE INDEX `kanji_clash_pair_log_target_answered_idx` ON `kanji_clash_pair_log` (`target_subject_key`,`answered_at`);--> statement-breakpoint
CREATE TABLE `kanji_clash_pair_state` (
	`pair_key` text PRIMARY KEY NOT NULL,
	`left_subject_key` text NOT NULL,
	`right_subject_key` text NOT NULL,
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
	`scheduler_version` text DEFAULT 'kanji_clash_fsrs_v1' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `kanji_clash_pair_state_due_idx` ON `kanji_clash_pair_state` (`due_at`);--> statement-breakpoint
CREATE INDEX `kanji_clash_pair_state_interaction_idx` ON `kanji_clash_pair_state` (`last_interaction_at`);--> statement-breakpoint
CREATE INDEX `kanji_clash_pair_state_state_idx` ON `kanji_clash_pair_state` (`state`);