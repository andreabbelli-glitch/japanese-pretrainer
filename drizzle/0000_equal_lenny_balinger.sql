CREATE TABLE `content_import` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`files_scanned` integer DEFAULT 0 NOT NULL,
	`files_changed` integer DEFAULT 0 NOT NULL,
	`message` text
);
--> statement-breakpoint
CREATE INDEX `content_import_status_idx` ON `content_import` (`status`,`started_at`);--> statement-breakpoint
CREATE TABLE `lesson` (
	`id` text PRIMARY KEY NOT NULL,
	`media_id` text NOT NULL,
	`segment_id` text,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`order_index` integer NOT NULL,
	`difficulty` text,
	`summary` text,
	`status` text DEFAULT 'active' NOT NULL,
	`source_file` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`segment_id`) REFERENCES `segment`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_media_slug_unique` ON `lesson` (`media_id`,`slug`);--> statement-breakpoint
CREATE INDEX `lesson_media_order_idx` ON `lesson` (`media_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `lesson_segment_order_idx` ON `lesson` (`segment_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `lesson_content` (
	`lesson_id` text PRIMARY KEY NOT NULL,
	`markdown_raw` text NOT NULL,
	`html_rendered` text NOT NULL,
	`ast_json` text,
	`excerpt` text,
	`last_import_id` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_import_id`) REFERENCES `content_import`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lesson_content_last_import_idx` ON `lesson_content` (`last_import_id`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`media_type` text NOT NULL,
	`segment_kind` text NOT NULL,
	`language` text NOT NULL,
	`base_explanation_language` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_slug_unique` ON `media` (`slug`);--> statement-breakpoint
CREATE TABLE `segment` (
	`id` text PRIMARY KEY NOT NULL,
	`media_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`order_index` integer NOT NULL,
	`segment_type` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `segment_media_slug_unique` ON `segment` (`media_id`,`slug`);--> statement-breakpoint
CREATE INDEX `segment_media_order_idx` ON `segment` (`media_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `entry_link` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_type` text NOT NULL,
	`entry_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`link_role` text NOT NULL,
	`sort_order` integer
);
--> statement-breakpoint
CREATE INDEX `entry_link_entry_idx` ON `entry_link` (`entry_type`,`entry_id`);--> statement-breakpoint
CREATE INDEX `entry_link_source_idx` ON `entry_link` (`source_type`,`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `entry_link_unique` ON `entry_link` (`entry_type`,`entry_id`,`source_type`,`source_id`,`link_role`);--> statement-breakpoint
CREATE TABLE `entry_status` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_type` text NOT NULL,
	`entry_id` text NOT NULL,
	`status` text NOT NULL,
	`reason` text,
	`set_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entry_status_entry_unique` ON `entry_status` (`entry_type`,`entry_id`);--> statement-breakpoint
CREATE TABLE `grammar_alias` (
	`id` text PRIMARY KEY NOT NULL,
	`grammar_id` text NOT NULL,
	`alias_text` text NOT NULL,
	`alias_norm` text NOT NULL,
	FOREIGN KEY (`grammar_id`) REFERENCES `grammar_pattern`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `grammar_alias_grammar_idx` ON `grammar_alias` (`grammar_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_alias_grammar_norm_unique` ON `grammar_alias` (`grammar_id`,`alias_norm`);--> statement-breakpoint
CREATE TABLE `grammar_pattern` (
	`id` text PRIMARY KEY NOT NULL,
	`media_id` text NOT NULL,
	`segment_id` text,
	`pattern` text NOT NULL,
	`title` text NOT NULL,
	`meaning_it` text NOT NULL,
	`notes_it` text,
	`level_hint` text,
	`search_pattern_norm` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`segment_id`) REFERENCES `segment`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `grammar_media_idx` ON `grammar_pattern` (`media_id`);--> statement-breakpoint
CREATE INDEX `grammar_segment_idx` ON `grammar_pattern` (`segment_id`);--> statement-breakpoint
CREATE INDEX `grammar_search_pattern_idx` ON `grammar_pattern` (`search_pattern_norm`);--> statement-breakpoint
CREATE TABLE `term` (
	`id` text PRIMARY KEY NOT NULL,
	`media_id` text NOT NULL,
	`segment_id` text,
	`lemma` text NOT NULL,
	`reading` text NOT NULL,
	`romaji` text NOT NULL,
	`pos` text,
	`meaning_it` text NOT NULL,
	`meaning_literal_it` text,
	`notes_it` text,
	`level_hint` text,
	`search_lemma_norm` text NOT NULL,
	`search_reading_norm` text NOT NULL,
	`search_romaji_norm` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`segment_id`) REFERENCES `segment`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `term_media_idx` ON `term` (`media_id`);--> statement-breakpoint
CREATE INDEX `term_segment_idx` ON `term` (`segment_id`);--> statement-breakpoint
CREATE INDEX `term_search_lemma_idx` ON `term` (`search_lemma_norm`);--> statement-breakpoint
CREATE INDEX `term_search_reading_idx` ON `term` (`search_reading_norm`);--> statement-breakpoint
CREATE INDEX `term_search_romaji_idx` ON `term` (`search_romaji_norm`);--> statement-breakpoint
CREATE TABLE `term_alias` (
	`id` text PRIMARY KEY NOT NULL,
	`term_id` text NOT NULL,
	`alias_text` text NOT NULL,
	`alias_norm` text NOT NULL,
	`alias_type` text NOT NULL,
	FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `term_alias_term_idx` ON `term_alias` (`term_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `term_alias_term_norm_type_unique` ON `term_alias` (`term_id`,`alias_norm`,`alias_type`);--> statement-breakpoint
CREATE TABLE `lesson_progress` (
	`lesson_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`started_at` text,
	`completed_at` text,
	`last_opened_at` text,
	FOREIGN KEY (`lesson_id`) REFERENCES `lesson`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_progress` (
	`media_id` text PRIMARY KEY NOT NULL,
	`lessons_completed` integer DEFAULT 0 NOT NULL,
	`lessons_total` integer DEFAULT 0 NOT NULL,
	`entries_known` integer DEFAULT 0 NOT NULL,
	`entries_total` integer DEFAULT 0 NOT NULL,
	`cards_due` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `card` (
	`id` text PRIMARY KEY NOT NULL,
	`media_id` text NOT NULL,
	`segment_id` text,
	`source_file` text NOT NULL,
	`card_type` text NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`notes_it` text,
	`status` text DEFAULT 'active' NOT NULL,
	`order_index` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`segment_id`) REFERENCES `segment`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `card_media_order_idx` ON `card` (`media_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `card_segment_order_idx` ON `card` (`segment_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `card_entry_link` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`entry_type` text NOT NULL,
	`entry_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `card_entry_link_card_idx` ON `card_entry_link` (`card_id`);--> statement-breakpoint
CREATE INDEX `card_entry_link_entry_idx` ON `card_entry_link` (`entry_type`,`entry_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `card_entry_link_unique` ON `card_entry_link` (`card_id`,`entry_type`,`entry_id`,`relationship_type`);--> statement-breakpoint
CREATE TABLE `review_log` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`answered_at` text NOT NULL,
	`rating` text NOT NULL,
	`previous_state` text,
	`new_state` text,
	`scheduled_due_at` text,
	`elapsed_days` real,
	`response_ms` integer,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_log_card_answered_idx` ON `review_log` (`card_id`,`answered_at`);--> statement-breakpoint
CREATE TABLE `review_state` (
	`card_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`stability` real,
	`difficulty` real,
	`due_at` text,
	`last_reviewed_at` text,
	`lapses` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`manual_override` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_state_due_idx` ON `review_state` (`due_at`);