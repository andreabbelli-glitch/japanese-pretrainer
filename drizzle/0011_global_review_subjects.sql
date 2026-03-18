CREATE TABLE `review_subject_state` (
	`subject_key` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`entry_type` text,
	`cross_media_group_id` text,
	`entry_id` text,
	`card_id` text,
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
	`scheduler_version` text DEFAULT 'fsrs_v1' NOT NULL,
	`manual_override` integer DEFAULT false NOT NULL,
	`suspended` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `review_subject_state_due_idx` ON `review_subject_state` (`due_at`);
--> statement-breakpoint
CREATE INDEX `review_subject_state_interaction_idx` ON `review_subject_state` (`last_interaction_at`);
--> statement-breakpoint
CREATE INDEX `review_subject_state_card_idx` ON `review_subject_state` (`card_id`);
--> statement-breakpoint
CREATE INDEX `review_subject_state_entry_idx` ON `review_subject_state` (`entry_type`,`cross_media_group_id`,`entry_id`);
--> statement-breakpoint
CREATE TABLE `review_subject_log` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_key` text NOT NULL,
	`card_id` text NOT NULL,
	`answered_at` text NOT NULL,
	`rating` text NOT NULL,
	`previous_state` text,
	`new_state` text,
	`scheduled_due_at` text,
	`elapsed_days` real,
	`response_ms` integer,
	`scheduler_version` text DEFAULT 'fsrs_v1' NOT NULL,
	FOREIGN KEY (`subject_key`) REFERENCES `review_subject_state`(`subject_key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_subject_log_subject_answered_idx` ON `review_subject_log` (`subject_key`,`answered_at`);
--> statement-breakpoint
CREATE INDEX `review_subject_log_card_answered_idx` ON `review_subject_log` (`card_id`,`answered_at`);
