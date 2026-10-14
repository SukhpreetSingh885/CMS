-- AlterTable DailyWorkReport
ALTER TABLE `DailyWorkReport` 
  ADD COLUMN `quantity` DECIMAL(10, 2) NULL,
  ADD COLUMN `unit` VARCHAR(100) NULL,
  ALTER COLUMN `status` SET DEFAULT 'SUBMITTED';

-- AlterTable DailyReportHistory
ALTER TABLE `DailyReportHistory` 
  ADD COLUMN `quantity` DECIMAL(10, 2) NULL,
  ADD COLUMN `unit` VARCHAR(100) NULL;

-- CreateIndex
CREATE INDEX `DailyWorkReport_taskId_idx` ON `DailyWorkReport`(`taskId`);
CREATE INDEX `DailyWorkReport_serviceId_idx` ON `DailyWorkReport`(`serviceId`);

