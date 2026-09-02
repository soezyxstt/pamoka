CREATE TABLE `committeeAssignment` (
	`id` text PRIMARY KEY NOT NULL,
	`editionId` text NOT NULL,
	`unitId` text NOT NULL,
	`personId` text NOT NULL,
	`title` text NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`editionId`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unitId`) REFERENCES `committeeUnit`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personId`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `committee_assignment_edition_idx` ON `committeeAssignment` (`editionId`);--> statement-breakpoint
CREATE INDEX `committee_assignment_unit_idx` ON `committeeAssignment` (`unitId`);--> statement-breakpoint
CREATE INDEX `committee_assignment_person_idx` ON `committeeAssignment` (`personId`);--> statement-breakpoint
CREATE TABLE `committeeUnit` (
	`id` text PRIMARY KEY NOT NULL,
	`editionId` text NOT NULL,
	`parentId` text,
	`name` text NOT NULL,
	`displayOrder` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`editionId`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parentId`) REFERENCES `committeeUnit`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `committee_unit_edition_idx` ON `committeeUnit` (`editionId`);--> statement-breakpoint
CREATE INDEX `committee_unit_parent_idx` ON `committeeUnit` (`parentId`);