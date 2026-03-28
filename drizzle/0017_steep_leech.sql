DROP INDEX `card_entry_link_card_idx`;--> statement-breakpoint
CREATE INDEX `card_entry_link_card_rel_idx` ON `card_entry_link` (`card_id`,`relationship_type`);--> statement-breakpoint
CREATE INDEX `card_status_type_idx` ON `card` (`status`,`card_type`);