ALTER TABLE `mediaFolder` ADD `editionId` text REFERENCES edition(id);--> statement-breakpoint
CREATE INDEX `media_folder_edition_idx` ON `mediaFolder` (`editionId`);