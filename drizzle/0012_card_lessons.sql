ALTER TABLE `card` ADD COLUMN `lesson_id` text REFERENCES `lesson`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `card_lesson_idx` ON `card` (`lesson_id`);
