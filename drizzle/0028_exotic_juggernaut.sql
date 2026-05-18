CREATE TABLE `pre_review_consolidation_state` (
	`subject_key` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`entry_type` text,
	`cross_media_group_id` text,
	`entry_id` text,
	`representative_card_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`media_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`representative_card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pre_review_consolidation_status_media_idx` ON `pre_review_consolidation_state` (`status`,`media_id`);--> statement-breakpoint
CREATE INDEX `pre_review_consolidation_status_lesson_idx` ON `pre_review_consolidation_state` (`status`,`lesson_id`);--> statement-breakpoint
CREATE INDEX `pre_review_consolidation_media_lesson_status_idx` ON `pre_review_consolidation_state` (`media_id`,`lesson_id`,`status`);--> statement-breakpoint
CREATE INDEX `pre_review_consolidation_card_idx` ON `pre_review_consolidation_state` (`representative_card_id`);