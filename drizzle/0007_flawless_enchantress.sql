CREATE TABLE `editionProgram` (
	`id` text PRIMARY KEY NOT NULL,
	`editionId` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`editionId`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `edition_program_edition_idx` ON `editionProgram` (`editionId`);--> statement-breakpoint
CREATE TABLE `siteAssetBinding` (
	`id` text PRIMARY KEY NOT NULL,
	`editionId` text NOT NULL,
	`slotKey` text NOT NULL,
	`mediaId` text,
	`altOverride` text,
	`focalX` integer,
	`focalY` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`editionId`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mediaId`) REFERENCES `mediaAsset`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_asset_binding_edition_slot_unique` ON `siteAssetBinding` (`editionId`,`slotKey`);--> statement-breakpoint
CREATE INDEX `site_asset_binding_edition_idx` ON `siteAssetBinding` (`editionId`);--> statement-breakpoint
CREATE INDEX `site_asset_binding_media_idx` ON `siteAssetBinding` (`mediaId`);--> statement-breakpoint
ALTER TABLE `edition` ADD `organizationPeriodId` text;--> statement-breakpoint
ALTER TABLE `edition` ADD `logoMediaId` text REFERENCES mediaAsset(id);--> statement-breakpoint
ALTER TABLE `edition` ADD `slogan` text;--> statement-breakpoint
ALTER TABLE `edition` ADD `version` integer DEFAULT 1 NOT NULL;