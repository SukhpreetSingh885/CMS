-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'EMPLOYEE') NOT NULL,
    `phone` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NULL,
    `joiningDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `avatarUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_employeeId_key`(`employeeId`),
    INDEX `User_role_status_idx`(`role`, `status`),
    INDEX `User_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `refreshToken` VARCHAR(500) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Session_userId_idx`(`userId`),
    INDEX `Session_refreshToken_idx`(`refreshToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NOT NULL,
    `contactDesignation` VARCHAR(191) NULL,
    `mobileNumber` VARCHAR(191) NOT NULL,
    `whatsAppNumber` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `website` VARCHAR(191) NULL,
    `instagram` VARCHAR(191) NULL,
    `facebook` VARCHAR(191) NULL,
    `linkedIn` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `industry` VARCHAR(191) NULL,
    `leadSource` VARCHAR(191) NULL,
    `onboardingDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `contractStartDate` DATETIME(3) NOT NULL,
    `contractEndDate` DATETIME(3) NOT NULL,
    `renewalDate` DATETIME(3) NOT NULL,
    `assignedAdminId` VARCHAR(191) NULL,
    `packageId` VARCHAR(191) NULL,
    `packagePricing` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `billingCycle` ENUM('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ANNUALLY') NOT NULL DEFAULT 'MONTHLY',
    `clientPriority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `clientGoals` TEXT NULL,
    `contractSnapshot` JSON NULL,
    `status` ENUM('LEAD', 'WON', 'ONBOARDING', 'ACTIVE', 'RENEWAL_DUE', 'RENEWED', 'PAUSED', 'COMPLETED', 'CHURNED') NOT NULL DEFAULT 'ONBOARDING',
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NULL,

    INDEX `Client_status_isArchived_idx`(`status`, `isArchived`),
    INDEX `Client_assignedAdminId_idx`(`assignedAdminId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientAssignedEmployee` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `primaryRole` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClientAssignedEmployee_clientId_idx`(`clientId`),
    INDEX `ClientAssignedEmployee_userId_idx`(`userId`),
    UNIQUE INDEX `ClientAssignedEmployee_clientId_userId_key`(`clientId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Package` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `packageType` ENUM('SINGLE_SERVICE', 'COMBINED_BUSINESS') NOT NULL DEFAULT 'SINGLE_SERVICE',
    `description` TEXT NULL,
    `basePrice` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `billingCycle` ENUM('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ANNUALLY') NOT NULL DEFAULT 'MONTHLY',
    `setupFee` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `features` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Package_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Service` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `defaultMonthlyTarget` INTEGER NOT NULL DEFAULT 10,
    `icon` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Service_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackageService` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `monthlyTarget` INTEGER NOT NULL DEFAULT 10,
    `defaultWeight` DECIMAL(4, 2) NOT NULL DEFAULT 1.00,
    `deliverables` TEXT NULL,

    INDEX `PackageService_packageId_idx`(`packageId`),
    INDEX `PackageService_serviceId_idx`(`serviceId`),
    UNIQUE INDEX `PackageService_packageId_serviceId_key`(`packageId`, `serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackageDeliverable` (
    `id` VARCHAR(191) NOT NULL,
    `packageServiceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `deliverableType` ENUM('QUANTITY', 'FEATURE', 'MILESTONE') NOT NULL DEFAULT 'QUANTITY',
    `quantity` INTEGER NULL DEFAULT 1,
    `unit` VARCHAR(191) NULL DEFAULT 'Units',
    `targetPeriod` ENUM('ONE_TIME', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CAMPAIGN_SCOPE', 'MILESTONE_BASED') NOT NULL DEFAULT 'MONTHLY',
    `isIncluded` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `PackageDeliverable_packageServiceId_idx`(`packageServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientService` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `assignedEmployeeId` VARCHAR(191) NULL,
    `monthlyTarget` INTEGER NOT NULL DEFAULT 10,
    `completedDeliverables` INTEGER NOT NULL DEFAULT 0,
    `serviceWeight` DECIMAL(4, 2) NOT NULL DEFAULT 1.00,
    `deliverables` TEXT NULL,
    `deliverablesConfig` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClientService_clientId_idx`(`clientId`),
    INDEX `ClientService_serviceId_idx`(`serviceId`),
    INDEX `ClientService_assignedEmployeeId_idx`(`assignedEmployeeId`),
    UNIQUE INDEX `ClientService_clientId_serviceId_key`(`clientId`, `serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientServiceEmployeeAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `clientServiceId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `ClientServiceEmployeeAssignment_clientServiceId_idx`(`clientServiceId`),
    INDEX `ClientServiceEmployeeAssignment_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `ClientServiceEmployeeAssignment_clientServiceId_employeeId_key`(`clientServiceId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `assignedToId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `startDate` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `startedById` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `estimatedHours` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `actualHours` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('CREATED', 'ASSIGNED', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_APPROVAL', 'REVISION_REQUIRED', 'APPROVED', 'DELIVERED', 'COMPLETED') NOT NULL DEFAULT 'CREATED',
    `completionPercentage` INTEGER NOT NULL DEFAULT 0,
    `deliverableCount` INTEGER NOT NULL DEFAULT 0,
    `clientApprovalRequired` BOOLEAN NOT NULL DEFAULT false,
    `isSelfReviewed` BOOLEAN NOT NULL DEFAULT false,
    `internalNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Task_clientId_idx`(`clientId`),
    INDEX `Task_assignedToId_idx`(`assignedToId`),
    INDEX `Task_status_idx`(`status`),
    INDEX `Task_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskComment` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskComment_taskId_idx`(`taskId`),
    INDEX `TaskComment_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskAttachment_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyWorkReport` (
    `id` VARCHAR(191) NOT NULL,
    `reportDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submittedById` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NULL,
    `serviceId` VARCHAR(191) NULL,
    `workDescription` TEXT NOT NULL,
    `workCompleted` TEXT NOT NULL,
    `workPending` TEXT NULL,
    `hoursSpent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `issuesOrBlockers` TEXT NULL,
    `nextAction` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED') NOT NULL DEFAULT 'DRAFT',
    `submittedAt` DATETIME(3) NULL,
    `reviewerId` VARCHAR(191) NULL,
    `reviewerComments` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `isSelfReviewed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DailyWorkReport_submittedById_idx`(`submittedById`),
    INDEX `DailyWorkReport_clientId_idx`(`clientId`),
    INDEX `DailyWorkReport_status_idx`(`status`),
    INDEX `DailyWorkReport_reportDate_idx`(`reportDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyReportAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DailyReportAttachment_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyReportHistory` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `workDescription` TEXT NOT NULL,
    `workCompleted` TEXT NOT NULL,
    `workPending` TEXT NULL,
    `hoursSpent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REVISION_REQUESTED') NOT NULL,
    `reviewerComments` TEXT NULL,
    `modifiedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `modifiedById` VARCHAR(191) NULL,

    INDEX `DailyReportHistory_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentItem` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'LINKEDIN', 'TWITTER', 'TIKTOK', 'WEBSITE', 'OTHER') NOT NULL DEFAULT 'INSTAGRAM',
    `contentType` ENUM('REEL', 'POST', 'STORY', 'CAROUSEL', 'VIDEO', 'BLOG', 'BANNER') NOT NULL DEFAULT 'REEL',
    `assignedEmployeeId` VARCHAR(191) NULL,
    `stage` ENUM('IDEA', 'SCRIPT', 'SHOOT', 'EDITING', 'INTERNAL_REVIEW', 'CLIENT_APPROVAL', 'SCHEDULED', 'PUBLISHED') NOT NULL DEFAULT 'IDEA',
    `shootDate` DATETIME(3) NULL,
    `editingDate` DATETIME(3) NULL,
    `approvalDate` DATETIME(3) NULL,
    `publishingDate` DATETIME(3) NULL,
    `caption` TEXT NULL,
    `script` TEXT NULL,
    `attachmentUrl` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContentItem_clientId_idx`(`clientId`),
    INDEX `ContentItem_stage_idx`(`stage`),
    INDEX `ContentItem_publishingDate_idx`(`publishingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Meeting` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `meetingDateTime` DATETIME(3) NOT NULL,
    `meetingLink` VARCHAR(191) NULL,
    `agenda` TEXT NULL,
    `notes` TEXT NULL,
    `actionItems` TEXT NULL,
    `followUpDate` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Meeting_clientId_idx`(`clientId`),
    INDEX `Meeting_meetingDateTime_idx`(`meetingDateTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MeetingParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `meetingId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    INDEX `MeetingParticipant_meetingId_idx`(`meetingId`),
    INDEX `MeetingParticipant_userId_idx`(`userId`),
    UNIQUE INDEX `MeetingParticipant_meetingId_userId_key`(`meetingId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommunicationLog` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `loggedById` VARCHAR(191) NOT NULL,
    `type` ENUM('WHATSAPP', 'EMAIL', 'PHONE', 'MEETING', 'OTHER') NOT NULL DEFAULT 'PHONE',
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `summary` TEXT NOT NULL,
    `clientRequirements` TEXT NULL,
    `nextAction` TEXT NULL,
    `followUpDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunicationLog_clientId_idx`(`clientId`),
    INDEX `CommunicationLog_loggedById_idx`(`loggedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientFile` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `folder` ENUM('GENERAL', 'CONTRACTS', 'CREATIVES', 'INVOICES', 'REPORTS', 'DELIVERABLES') NOT NULL DEFAULT 'GENERAL',
    `tags` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClientFile_clientId_idx`(`clientId`),
    INDEX `ClientFile_folder_idx`(`folder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `invoiceDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NOT NULL,
    `packageValue` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `invoiceAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `amountPaid` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `remainingBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `paymentStatus` ENUM('NOT_DUE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID') NOT NULL DEFAULT 'NOT_DUE',
    `notes` TEXT NULL,
    `isCancelled` BOOLEAN NOT NULL DEFAULT false,
    `cancelReason` TEXT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_invoiceNumber_key`(`invoiceNumber`),
    INDEX `Invoice_clientId_idx`(`clientId`),
    INDEX `Invoice_paymentStatus_idx`(`paymentStatus`),
    INDEX `Invoice_dueDate_idx`(`dueDate`),
    INDEX `Invoice_isCancelled_idx`(`isCancelled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paymentMethod` ENUM('BANK_TRANSFER', 'UPI', 'CREDIT_CARD', 'CASH', 'CHEQUE', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
    `transactionReference` VARCHAR(191) NULL,
    `receivedById` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `isVoided` BOOLEAN NOT NULL DEFAULT false,
    `voidReason` TEXT NULL,
    `voidedAt` DATETIME(3) NULL,
    `voidedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_invoiceId_idx`(`invoiceId`),
    INDEX `Payment_clientId_idx`(`clientId`),
    INDEX `Payment_paymentDate_idx`(`paymentDate`),
    INDEX `Payment_isVoided_idx`(`isVoided`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Renewal` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `contractStartDate` DATETIME(3) NOT NULL,
    `contractEndDate` DATETIME(3) NOT NULL,
    `renewalDate` DATETIME(3) NOT NULL,
    `renewalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `renewalStatus` ENUM('UPCOMING', 'DUE', 'RENEWED', 'CHURNED') NOT NULL DEFAULT 'UPCOMING',
    `reminderSent30d` BOOLEAN NOT NULL DEFAULT false,
    `reminderSent7d` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Renewal_clientId_idx`(`clientId`),
    INDEX `Renewal_renewalDate_idx`(`renewalDate`),
    INDEX `Renewal_renewalStatus_idx`(`renewalStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` ENUM('TASK', 'REPORT', 'CLIENT', 'FINANCE', 'RENEWAL', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
    `link` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_isRead_idx`(`userId`, `isRead`),
    INDEX `Notification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `actorEmail` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `resourceType` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `beforeState` LONGTEXT NULL,
    `afterState` LONGTEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorId_idx`(`actorId`),
    INDEX `AuditLog_resourceType_resourceId_idx`(`resourceType`, `resourceId`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSetting` (
    `id` VARCHAR(191) NOT NULL,
    `settingKey` VARCHAR(191) NOT NULL,
    `settingValue` TEXT NOT NULL,
    `description` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemSetting_settingKey_key`(`settingKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_assignedAdminId_fkey` FOREIGN KEY (`assignedAdminId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientAssignedEmployee` ADD CONSTRAINT `ClientAssignedEmployee_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientAssignedEmployee` ADD CONSTRAINT `ClientAssignedEmployee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackageService` ADD CONSTRAINT `PackageService_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackageService` ADD CONSTRAINT `PackageService_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackageDeliverable` ADD CONSTRAINT `PackageDeliverable_packageServiceId_fkey` FOREIGN KEY (`packageServiceId`) REFERENCES `PackageService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientService` ADD CONSTRAINT `ClientService_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientService` ADD CONSTRAINT `ClientService_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientService` ADD CONSTRAINT `ClientService_assignedEmployeeId_fkey` FOREIGN KEY (`assignedEmployeeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientServiceEmployeeAssignment` ADD CONSTRAINT `ClientServiceEmployeeAssignment_clientServiceId_fkey` FOREIGN KEY (`clientServiceId`) REFERENCES `ClientService`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientServiceEmployeeAssignment` ADD CONSTRAINT `ClientServiceEmployeeAssignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientServiceEmployeeAssignment` ADD CONSTRAINT `ClientServiceEmployeeAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_startedById_fkey` FOREIGN KEY (`startedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskAttachment` ADD CONSTRAINT `TaskAttachment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskAttachment` ADD CONSTRAINT `TaskAttachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyWorkReport` ADD CONSTRAINT `DailyWorkReport_submittedById_fkey` FOREIGN KEY (`submittedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyWorkReport` ADD CONSTRAINT `DailyWorkReport_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyWorkReport` ADD CONSTRAINT `DailyWorkReport_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyWorkReport` ADD CONSTRAINT `DailyWorkReport_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyWorkReport` ADD CONSTRAINT `DailyWorkReport_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyReportAttachment` ADD CONSTRAINT `DailyReportAttachment_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `DailyWorkReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyReportHistory` ADD CONSTRAINT `DailyReportHistory_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `DailyWorkReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentItem` ADD CONSTRAINT `ContentItem_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentItem` ADD CONSTRAINT `ContentItem_assignedEmployeeId_fkey` FOREIGN KEY (`assignedEmployeeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetingParticipant` ADD CONSTRAINT `MeetingParticipant_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetingParticipant` ADD CONSTRAINT `MeetingParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationLog` ADD CONSTRAINT `CommunicationLog_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationLog` ADD CONSTRAINT `CommunicationLog_loggedById_fkey` FOREIGN KEY (`loggedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientFile` ADD CONSTRAINT `ClientFile_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientFile` ADD CONSTRAINT `ClientFile_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_receivedById_fkey` FOREIGN KEY (`receivedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Renewal` ADD CONSTRAINT `Renewal_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

