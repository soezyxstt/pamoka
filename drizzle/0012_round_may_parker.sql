PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_event` (
	`id` text PRIMARY KEY NOT NULL,
	`editionId` text NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`heroMediaId` text,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`editionId`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`heroMediaId`) REFERENCES `mediaAsset`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_event`("id", "editionId", "slug", "label", "description", "heroMediaId", "displayOrder", "active", "version", "createdAt", "updatedAt") SELECT "id", "editionId", "slug", "label", "description", "heroMediaId", "displayOrder", "active", "version", "createdAt", "updatedAt" FROM `event`;--> statement-breakpoint
DROP TABLE `event`;--> statement-breakpoint
ALTER TABLE `__new_event` RENAME TO `event`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `event_edition_slug_unique` ON `event` (`editionId`,`slug`);--> statement-breakpoint
CREATE INDEX `event_edition_idx` ON `event` (`editionId`);--> statement-breakpoint
CREATE INDEX `event_hero_media_idx` ON `event` (`heroMediaId`);--> statement-breakpoint
CREATE TABLE `__new_gallery` (
	`id` text PRIMARY KEY NOT NULL,
	`editionId` text,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`coverMediaId` text,
	`ownerType` text DEFAULT 'standalone' NOT NULL,
	`ownerId` text NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`editionId`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`coverMediaId`) REFERENCES `mediaAsset`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_gallery`("id", "editionId", "slug", "title", "description", "coverMediaId", "ownerType", "ownerId", "displayOrder", "status", "active", "version", "createdAt", "updatedAt") SELECT "id", "editionId", "id", "title", NULL, NULL, "ownerType", "ownerId", 0, 'published', 1, "version", "createdAt", "updatedAt" FROM `gallery`;--> statement-breakpoint
DROP TABLE `gallery`;--> statement-breakpoint
ALTER TABLE `__new_gallery` RENAME TO `gallery`;--> statement-breakpoint
CREATE INDEX `gallery_edition_idx` ON `gallery` (`editionId`);--> statement-breakpoint
CREATE INDEX `gallery_cover_media_idx` ON `gallery` (`coverMediaId`);--> statement-breakpoint
CREATE INDEX `gallery_owner_idx` ON `gallery` (`ownerType`,`ownerId`);--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_edition_slug_unique` ON `gallery` (`editionId`,`slug`);--> statement-breakpoint
CREATE TABLE `__new_galleryItem` (
	`id` text PRIMARY KEY NOT NULL,
	`galleryId` text NOT NULL,
	`mediaId` text,
	`youtubeId` text,
	`caption` text,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`galleryId`) REFERENCES `gallery`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mediaId`) REFERENCES `mediaAsset`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_galleryItem`("id", "galleryId", "mediaId", "youtubeId", "caption", "displayOrder", "active", "createdAt", "updatedAt") SELECT "id", "galleryId", "mediaId", "youtubeId", "caption", "displayOrder", "active", "createdAt", "updatedAt" FROM `galleryItem`;--> statement-breakpoint
DROP TABLE `galleryItem`;--> statement-breakpoint
ALTER TABLE `__new_galleryItem` RENAME TO `galleryItem`;--> statement-breakpoint
CREATE INDEX `gallery_item_gallery_idx` ON `galleryItem` (`galleryId`);--> statement-breakpoint
CREATE INDEX `gallery_item_media_idx` ON `galleryItem` (`mediaId`);