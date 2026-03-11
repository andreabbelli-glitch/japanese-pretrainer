CREATE TABLE `cross_media_group` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_type` text NOT NULL,
	`group_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cross_media_group_type_key_unique` ON `cross_media_group` (`entry_type`,`group_key`);--> statement-breakpoint
ALTER TABLE `grammar_pattern` ADD `cross_media_group_id` text REFERENCES cross_media_group(id);--> statement-breakpoint
CREATE INDEX `grammar_cross_media_group_idx` ON `grammar_pattern` (`cross_media_group_id`);--> statement-breakpoint
ALTER TABLE `term` ADD `cross_media_group_id` text REFERENCES cross_media_group(id);--> statement-breakpoint
CREATE INDEX `term_cross_media_group_idx` ON `term` (`cross_media_group_id`);