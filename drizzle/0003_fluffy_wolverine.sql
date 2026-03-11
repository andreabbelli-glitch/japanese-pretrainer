PRAGMA foreign_keys=OFF;
--> statement-breakpoint
ALTER TABLE `term` RENAME TO `__old_term`;
--> statement-breakpoint
ALTER TABLE `term_alias` RENAME TO `__old_term_alias`;
--> statement-breakpoint
ALTER TABLE `grammar_pattern` RENAME TO `__old_grammar_pattern`;
--> statement-breakpoint
ALTER TABLE `grammar_alias` RENAME TO `__old_grammar_alias`;
--> statement-breakpoint
CREATE TABLE `term` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
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
CREATE TABLE `term_alias` (
	`id` text PRIMARY KEY NOT NULL,
	`term_id` text NOT NULL,
	`alias_text` text NOT NULL,
	`alias_norm` text NOT NULL,
	`alias_type` text NOT NULL,
	FOREIGN KEY (`term_id`) REFERENCES `term`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `grammar_pattern` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`media_id` text NOT NULL,
	`segment_id` text,
	`pattern` text NOT NULL,
	`title` text NOT NULL,
	`reading` text,
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
CREATE TABLE `grammar_alias` (
	`id` text PRIMARY KEY NOT NULL,
	`grammar_id` text NOT NULL,
	`alias_text` text NOT NULL,
	`alias_norm` text NOT NULL,
	FOREIGN KEY (`grammar_id`) REFERENCES `grammar_pattern`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `term` (
	`id`,
	`source_id`,
	`media_id`,
	`segment_id`,
	`lemma`,
	`reading`,
	`romaji`,
	`pos`,
	`meaning_it`,
	`meaning_literal_it`,
	`notes_it`,
	`level_hint`,
	`search_lemma_norm`,
	`search_reading_norm`,
	`search_romaji_norm`,
	`created_at`,
	`updated_at`
)
SELECT
	'term_' || length(`media_id`) || '_' || `media_id` || '_' || length(`id`) || '_' || `id`,
	`id`,
	`media_id`,
	`segment_id`,
	`lemma`,
	`reading`,
	`romaji`,
	`pos`,
	`meaning_it`,
	`meaning_literal_it`,
	`notes_it`,
	`level_hint`,
	`search_lemma_norm`,
	`search_reading_norm`,
	`search_romaji_norm`,
	`created_at`,
	`updated_at`
FROM `__old_term`;
--> statement-breakpoint
INSERT INTO `term_alias` (`id`,`term_id`,`alias_text`,`alias_norm`,`alias_type`)
SELECT
	`alias`.`id`,
	'term_' || length(`term_row`.`media_id`) || '_' || `term_row`.`media_id` || '_' || length(`term_row`.`id`) || '_' || `term_row`.`id`,
	`alias`.`alias_text`,
	`alias`.`alias_norm`,
	`alias`.`alias_type`
FROM `__old_term_alias` AS `alias`
INNER JOIN `__old_term` AS `term_row`
	ON `term_row`.`id` = `alias`.`term_id`;
--> statement-breakpoint
INSERT INTO `grammar_pattern` (
	`id`,
	`source_id`,
	`media_id`,
	`segment_id`,
	`pattern`,
	`title`,
	`reading`,
	`meaning_it`,
	`notes_it`,
	`level_hint`,
	`search_pattern_norm`,
	`created_at`,
	`updated_at`
)
SELECT
	'grammar_' || length(`media_id`) || '_' || `media_id` || '_' || length(`id`) || '_' || `id`,
	`id`,
	`media_id`,
	`segment_id`,
	`pattern`,
	`title`,
	`reading`,
	`meaning_it`,
	`notes_it`,
	`level_hint`,
	`search_pattern_norm`,
	`created_at`,
	`updated_at`
FROM `__old_grammar_pattern`;
--> statement-breakpoint
INSERT INTO `grammar_alias` (`id`,`grammar_id`,`alias_text`,`alias_norm`)
SELECT
	`alias`.`id`,
	'grammar_' || length(`grammar_row`.`media_id`) || '_' || `grammar_row`.`media_id` || '_' || length(`grammar_row`.`id`) || '_' || `grammar_row`.`id`,
	`alias`.`alias_text`,
	`alias`.`alias_norm`
FROM `__old_grammar_alias` AS `alias`
INNER JOIN `__old_grammar_pattern` AS `grammar_row`
	ON `grammar_row`.`id` = `alias`.`grammar_id`;
--> statement-breakpoint
DELETE FROM `entry_link`
WHERE (
	`entry_type` = 'term' AND `entry_id` NOT IN (SELECT `id` FROM `__old_term`)
) OR (
	`entry_type` = 'grammar' AND `entry_id` NOT IN (SELECT `id` FROM `__old_grammar_pattern`)
);
--> statement-breakpoint
UPDATE `entry_link`
SET `entry_id` = (
	SELECT
		'term_' || length(`media_id`) || '_' || `media_id` || '_' || length(`id`) || '_' || `id`
	FROM `__old_term`
	WHERE `__old_term`.`id` = `entry_link`.`entry_id`
)
WHERE `entry_type` = 'term';
--> statement-breakpoint
UPDATE `entry_link`
SET `entry_id` = (
	SELECT
		'grammar_' || length(`media_id`) || '_' || `media_id` || '_' || length(`id`) || '_' || `id`
	FROM `__old_grammar_pattern`
	WHERE `__old_grammar_pattern`.`id` = `entry_link`.`entry_id`
)
WHERE `entry_type` = 'grammar';
--> statement-breakpoint
DELETE FROM `card_entry_link`
WHERE (
	`entry_type` = 'term' AND `entry_id` NOT IN (SELECT `id` FROM `__old_term`)
) OR (
	`entry_type` = 'grammar' AND `entry_id` NOT IN (SELECT `id` FROM `__old_grammar_pattern`)
);
--> statement-breakpoint
DELETE FROM `entry_status`
WHERE (
	`entry_type` = 'term' AND `entry_id` NOT IN (SELECT `id` FROM `__old_term`)
) OR (
	`entry_type` = 'grammar' AND `entry_id` NOT IN (SELECT `id` FROM `__old_grammar_pattern`)
);
--> statement-breakpoint
UPDATE `entry_status`
SET `entry_id` = (
	SELECT
		'term_' || length(`media_id`) || '_' || `media_id` || '_' || length(`id`) || '_' || `id`
	FROM `__old_term`
	WHERE `__old_term`.`id` = `entry_status`.`entry_id`
)
WHERE `entry_type` = 'term';
--> statement-breakpoint
UPDATE `entry_status`
SET `entry_id` = (
	SELECT
		'grammar_' || length(`media_id`) || '_' || `media_id` || '_' || length(`id`) || '_' || `id`
	FROM `__old_grammar_pattern`
	WHERE `__old_grammar_pattern`.`id` = `entry_status`.`entry_id`
)
WHERE `entry_type` = 'grammar';
--> statement-breakpoint
UPDATE `card_entry_link`
SET `entry_id` = (
	SELECT
		'term_' || length(`media_id`) || '_' || `media_id` || '_' || length(`id`) || '_' || `id`
	FROM `__old_term`
	WHERE `__old_term`.`id` = `card_entry_link`.`entry_id`
)
WHERE `entry_type` = 'term';
--> statement-breakpoint
UPDATE `card_entry_link`
SET `entry_id` = (
	SELECT
		'grammar_' || length(`media_id`) || '_' || `media_id` || '_' || length(`id`) || '_' || `id`
	FROM `__old_grammar_pattern`
	WHERE `__old_grammar_pattern`.`id` = `card_entry_link`.`entry_id`
)
WHERE `entry_type` = 'grammar';
--> statement-breakpoint
DROP TABLE `__old_term_alias`;
--> statement-breakpoint
DROP TABLE `__old_term`;
--> statement-breakpoint
DROP TABLE `__old_grammar_alias`;
--> statement-breakpoint
DROP TABLE `__old_grammar_pattern`;
--> statement-breakpoint
CREATE INDEX `term_media_idx` ON `term` (`media_id`);
--> statement-breakpoint
CREATE INDEX `term_media_source_idx` ON `term` (`media_id`,`source_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `term_media_source_unique` ON `term` (`media_id`,`source_id`);
--> statement-breakpoint
CREATE INDEX `term_segment_idx` ON `term` (`segment_id`);
--> statement-breakpoint
CREATE INDEX `term_search_lemma_idx` ON `term` (`search_lemma_norm`);
--> statement-breakpoint
CREATE INDEX `term_search_reading_idx` ON `term` (`search_reading_norm`);
--> statement-breakpoint
CREATE INDEX `term_search_romaji_idx` ON `term` (`search_romaji_norm`);
--> statement-breakpoint
CREATE INDEX `term_alias_term_idx` ON `term_alias` (`term_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `term_alias_term_norm_type_unique` ON `term_alias` (`term_id`,`alias_norm`,`alias_type`);
--> statement-breakpoint
CREATE INDEX `grammar_media_idx` ON `grammar_pattern` (`media_id`);
--> statement-breakpoint
CREATE INDEX `grammar_media_source_idx` ON `grammar_pattern` (`media_id`,`source_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_media_source_unique` ON `grammar_pattern` (`media_id`,`source_id`);
--> statement-breakpoint
CREATE INDEX `grammar_segment_idx` ON `grammar_pattern` (`segment_id`);
--> statement-breakpoint
CREATE INDEX `grammar_search_pattern_idx` ON `grammar_pattern` (`search_pattern_norm`);
--> statement-breakpoint
CREATE INDEX `grammar_alias_grammar_idx` ON `grammar_alias` (`grammar_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_alias_grammar_norm_unique` ON `grammar_alias` (`grammar_id`,`alias_norm`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
