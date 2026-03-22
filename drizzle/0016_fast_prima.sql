ALTER TABLE `grammar_pattern` ADD `search_romaji_norm` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `grammar_search_romaji_idx` ON `grammar_pattern` (`search_romaji_norm`);
