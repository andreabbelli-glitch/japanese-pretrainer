DROP INDEX `lesson_media_order_idx`;--> statement-breakpoint
CREATE INDEX `lesson_media_order_idx` ON `lesson` (`media_id`,`order_index`,`slug`);--> statement-breakpoint
DROP INDEX `card_media_order_idx`;--> statement-breakpoint
CREATE INDEX `card_media_order_idx` ON `card` (`media_id`,`order_index`,`created_at`);