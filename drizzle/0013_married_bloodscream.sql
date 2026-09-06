CREATE TABLE `editionTitle` (
	`id` text PRIMARY KEY NOT NULL,
	`editionId` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`capacity` integer DEFAULT 1 NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`editionId`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edition_title_edition_name_unique` ON `editionTitle` (`editionId`,`name`);--> statement-breakpoint
CREATE INDEX `edition_title_edition_order_idx` ON `editionTitle` (`editionId`,`displayOrder`);--> statement-breakpoint
CREATE TABLE `participantStageEntry` (
	`id` text PRIMARY KEY NOT NULL,
	`participantId` text NOT NULL,
	`stageId` text NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`decidedAt` integer,
	`decidedByUserId` text,
	`reason` text,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`participantId`) REFERENCES `participant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`stageId`) REFERENCES `selectionStage`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`decidedByUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_stage_entry_unique` ON `participantStageEntry` (`participantId`,`stageId`);--> statement-breakpoint
CREATE INDEX `participant_stage_entry_stage_idx` ON `participantStageEntry` (`stageId`);--> statement-breakpoint
CREATE INDEX `participant_stage_entry_participant_idx` ON `participantStageEntry` (`participantId`);--> statement-breakpoint
CREATE TABLE `participantTitleAssignment` (
	`editionTitleId` text NOT NULL,
	`participantId` text NOT NULL,
	`assignedAt` integer NOT NULL,
	`assignedByUserId` text,
	PRIMARY KEY(`editionTitleId`, `participantId`),
	FOREIGN KEY (`editionTitleId`) REFERENCES `editionTitle`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participantId`) REFERENCES `participant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignedByUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `participant_title_assignment_participant_idx` ON `participantTitleAssignment` (`participantId`);--> statement-breakpoint
CREATE TABLE `selectionStage` (
	`id` text PRIMARY KEY NOT NULL,
	`editionId` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`targetParticipantCount` integer DEFAULT 0 NOT NULL,
	`lifecycle` text DEFAULT 'draft' NOT NULL,
	`finalStage` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`editionId`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `selection_stage_edition_slug_unique` ON `selectionStage` (`editionId`,`slug`);--> statement-breakpoint
CREATE INDEX `selection_stage_edition_order_idx` ON `selectionStage` (`editionId`,`displayOrder`);--> statement-breakpoint
CREATE TABLE `votingCampaignParticipant` (
	`campaignId` text NOT NULL,
	`participantId` text NOT NULL,
	`sourceStageId` text,
	`addedAt` integer NOT NULL,
	PRIMARY KEY(`campaignId`, `participantId`),
	FOREIGN KEY (`campaignId`) REFERENCES `votingCampaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participantId`) REFERENCES `participant`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sourceStageId`) REFERENCES `selectionStage`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `voting_campaign_participant_participant_idx` ON `votingCampaignParticipant` (`participantId`);--> statement-breakpoint
CREATE INDEX `voting_campaign_participant_stage_idx` ON `votingCampaignParticipant` (`sourceStageId`);--> statement-breakpoint
ALTER TABLE `participant` ADD `currentStageId` text REFERENCES selectionStage(id);--> statement-breakpoint
ALTER TABLE `participant` ADD `selectionStatus` text DEFAULT 'registered' NOT NULL;--> statement-breakpoint
ALTER TABLE `votingCampaign` ADD `eligibilityStageId` text REFERENCES selectionStage(id);--> statement-breakpoint
ALTER TABLE `votingCampaign` ADD `startedAt` integer;--> statement-breakpoint
ALTER TABLE `votingCampaign` ADD `closedAt` integer;