-- AlterTable
ALTER TABLE `users` ADD COLUMN `GoogleId` VARCHAR(255) NULL;
ALTER TABLE `users` MODIFY `PasswordHash` VARCHAR(255) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `GoogleId` ON `users`(`GoogleId`);
