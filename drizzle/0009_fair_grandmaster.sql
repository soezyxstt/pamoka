CREATE TABLE `organizationMembership` (
	`id` text PRIMARY KEY NOT NULL,
	`periodId` text NOT NULL,
	`unitId` text NOT NULL,
	`personId` text NOT NULL,
	`title` text NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`periodId`) REFERENCES `organizationPeriod`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unitId`) REFERENCES `organizationUnit`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personId`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `org_membership_period_idx` ON `organizationMembership` (`periodId`);--> statement-breakpoint
CREATE INDEX `org_membership_unit_idx` ON `organizationMembership` (`unitId`);--> statement-breakpoint
CREATE INDEX `org_membership_person_idx` ON `organizationMembership` (`personId`);--> statement-breakpoint
CREATE TABLE `organizationPeriod` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`startYear` integer NOT NULL,
	`endYear` integer NOT NULL,
	`vision` text,
	`missionJson` text DEFAULT '[]' NOT NULL,
	`lifecycle` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `org_period_lifecycle_idx` ON `organizationPeriod` (`lifecycle`);--> statement-breakpoint
CREATE INDEX `org_period_years_idx` ON `organizationPeriod` (`startYear`,`endYear`);--> statement-breakpoint
CREATE TABLE `organizationUnit` (
	`id` text PRIMARY KEY NOT NULL,
	`periodId` text NOT NULL,
	`parentId` text,
	`name` text NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`periodId`) REFERENCES `organizationPeriod`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parentId`) REFERENCES `organizationUnit`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `org_unit_period_idx` ON `organizationUnit` (`periodId`);--> statement-breakpoint
CREATE INDEX `org_unit_parent_idx` ON `organizationUnit` (`parentId`);--> statement-breakpoint
CREATE TABLE `personSocialLink` (
	`id` text PRIMARY KEY NOT NULL,
	`personId` text NOT NULL,
	`platform` text NOT NULL,
	`label` text,
	`url` text NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`personId`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `person_social_link_person_idx` ON `personSocialLink` (`personId`);--> statement-breakpoint
ALTER TABLE `edition` ALTER COLUMN "organizationPeriodId" TO "organizationPeriodId" text REFERENCES organizationPeriod(id) ON DELETE set null ON UPDATE no action;