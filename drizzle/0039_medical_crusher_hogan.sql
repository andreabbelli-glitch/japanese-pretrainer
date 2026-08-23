CREATE TABLE `review_card_identity` (
	`card_id` text PRIMARY KEY NOT NULL,
	`has_primary` integer DEFAULT false NOT NULL,
	`driving_link_count` integer DEFAULT 0 NOT NULL,
	`entry_type` text,
	`entry_id` text,
	`cross_media_group_id` text,
	`canonical_subject_key` text NOT NULL,
	`recall_task` text NOT NULL,
	`memory_key` text NOT NULL,
	`projection_version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_card_identity_memory_idx` ON `review_card_identity` (`memory_key`);--> statement-breakpoint
CREATE INDEX `review_card_identity_entry_idx` ON `review_card_identity` (`entry_type`,`entry_id`);