CREATE TABLE `participantMedia` (
	`id` text PRIMARY KEY NOT NULL,
	`participantId` text NOT NULL,
	`role` text NOT NULL,
	`mediaId` text NOT NULL,
	`caption` text,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`participantId`) REFERENCES `participant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mediaId`) REFERENCES `mediaAsset`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `participant_media_participant_idx` ON `participantMedia` (`participantId`);--> statement-breakpoint
CREATE INDEX `participant_media_media_idx` ON `participantMedia` (`mediaId`);--> statement-breakpoint
CREATE TABLE `participantSocialLink` (
	`id` text PRIMARY KEY NOT NULL,
	`participantId` text NOT NULL,
	`platform` text NOT NULL,
	`label` text,
	`url` text NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`participantId`) REFERENCES `participant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `participant_social_link_participant_idx` ON `participantSocialLink` (`participantId`);