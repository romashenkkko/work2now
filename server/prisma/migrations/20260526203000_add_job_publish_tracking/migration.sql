-- Job publish / Paynet reservation UX fields (Step 5)
ALTER TABLE `jobs` ADD COLUMN `publish_blocked_reason` TEXT NULL;
ALTER TABLE `jobs` ADD COLUMN `published_at` TIMESTAMP(0) NULL;
