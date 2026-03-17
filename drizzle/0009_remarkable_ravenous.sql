ALTER TABLE `review_log` ADD `scheduler_version` text DEFAULT 'legacy_simple' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_state` ADD `scheduled_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_state` ADD `learning_steps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_state` ADD `scheduler_version` text DEFAULT 'legacy_simple' NOT NULL;