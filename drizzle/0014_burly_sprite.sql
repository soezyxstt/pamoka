PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	FOREIGN KEY (`mediaId`) REFERENCES `mediaAsset`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "gallery_item_exactly_one_source" CHECK((("__new_galleryItem"."mediaId" is not null) and ("__new_galleryItem"."youtubeId" is null)) or (("__new_galleryItem"."mediaId" is null) and ("__new_galleryItem"."youtubeId" is not null)))
);
--> statement-breakpoint
INSERT INTO `__new_galleryItem`("id", "galleryId", "mediaId", "youtubeId", "caption", "displayOrder", "active", "createdAt", "updatedAt") SELECT "id", "galleryId", "mediaId", "youtubeId", "caption", "displayOrder", "active", "createdAt", "updatedAt" FROM `galleryItem`;--> statement-breakpoint
DROP TABLE `galleryItem`;--> statement-breakpoint
ALTER TABLE `__new_galleryItem` RENAME TO `galleryItem`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `gallery_item_gallery_idx` ON `galleryItem` (`galleryId`);--> statement-breakpoint
CREATE INDEX `gallery_item_media_idx` ON `galleryItem` (`mediaId`);