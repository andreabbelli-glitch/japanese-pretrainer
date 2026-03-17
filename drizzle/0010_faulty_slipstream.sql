PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_review_log` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`answered_at` text NOT NULL,
	`rating` text NOT NULL,
	`previous_state` text,
	`new_state` text,
	`scheduled_due_at` text,
	`elapsed_days` real,
	`response_ms` integer,
	`scheduler_version` text DEFAULT 'fsrs_v1' NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_review_log`("id", "card_id", "answered_at", "rating", "previous_state", "new_state", "scheduled_due_at", "elapsed_days", "response_ms", "scheduler_version") SELECT "id", "card_id", "answered_at", "rating", "previous_state", "new_state", "scheduled_due_at", "elapsed_days", "response_ms", "scheduler_version" FROM `review_log`;--> statement-breakpoint
DROP TABLE `review_log`;--> statement-breakpoint
ALTER TABLE `__new_review_log` RENAME TO `review_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `review_log_card_answered_idx` ON `review_log` (`card_id`,`answered_at`);--> statement-breakpoint
CREATE TABLE `__new_review_state` (
	`card_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`stability` real,
	`difficulty` real,
	`due_at` text,
	`last_reviewed_at` text,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`scheduler_version` text DEFAULT 'fsrs_v1' NOT NULL,
	`manual_override` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_review_state`("card_id", "state", "stability", "difficulty", "due_at", "last_reviewed_at", "scheduled_days", "learning_steps", "lapses", "reps", "scheduler_version", "manual_override", "created_at", "updated_at") SELECT "card_id", "state", "stability", "difficulty", "due_at", "last_reviewed_at", "scheduled_days", "learning_steps", "lapses", "reps", "scheduler_version", "manual_override", "created_at", "updated_at" FROM `review_state`;--> statement-breakpoint
DROP TABLE `review_state`;--> statement-breakpoint
ALTER TABLE `__new_review_state` RENAME TO `review_state`;--> statement-breakpoint
CREATE INDEX `review_state_due_idx` ON `review_state` (`due_at`);