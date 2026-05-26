-- Automated staff payouts: staff accounts, provider events, extended payout status + columns

CREATE TABLE `staff_payout_accounts` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `staff_user_id` CHAR(36) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('draft', 'submitted', 'verified', 'rejected', 'disabled') NOT NULL DEFAULT 'draft',
    `type` ENUM('iban', 'card', 'phone') NOT NULL,
    `beneficiary_name` VARCHAR(200) NOT NULL,
    `beneficiary_country` VARCHAR(2) NULL,
    `iban` VARCHAR(34) NULL,
    `bank_name` VARCHAR(200) NULL,
    `card_token` VARCHAR(200) NULL,
    `card_last4` VARCHAR(4) NULL,
    `card_brand` VARCHAR(50) NULL,
    `phone_e164` VARCHAR(20) NULL,
    `wallet_provider` VARCHAR(50) NULL,
    `verification_provider` VARCHAR(50) NULL,
    `verification_reference` VARCHAR(100) NULL,
    `verified_at` TIMESTAMP(0) NULL,
    `rejected_at` TIMESTAMP(0) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    PRIMARY KEY (`id`),
    INDEX `idx_staff_payout_accounts_staff_user_id`(`staff_user_id`),
    INDEX `idx_staff_payout_accounts_status`(`status`),
    CONSTRAINT `fk_staff_payout_accounts_staff_user_id` FOREIGN KEY (`staff_user_id`) REFERENCES `users`(`Id`) ON DELETE CASCADE ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Extend payout status enum (MySQL replaces full ENUM definition)
ALTER TABLE `application_payouts`
    MODIFY COLUMN `status` ENUM(
        'not_started',
        'awaiting_work',
        'in_progress',
        'awaiting_customer_confirmation',
        'payout_pending',
        'payout_queued',
        'payout_processing',
        'retry_pending',
        'paid',
        'failed',
        'reversed',
        'cancelled',
        'disputed'
    ) NOT NULL DEFAULT 'not_started';

ALTER TABLE `application_payouts`
    ADD COLUMN `queued_at` TIMESTAMP(0) NULL AFTER `payout_pending_at`,
    ADD COLUMN `processing_started_at` TIMESTAMP(0) NULL AFTER `queued_at`,
    ADD COLUMN `next_retry_at` TIMESTAMP(0) NULL AFTER `failed_at`,
    ADD COLUMN `retry_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `next_retry_at`,
    ADD COLUMN `payout_provider` VARCHAR(30) NULL AFTER `retry_count`,
    ADD COLUMN `provider_payout_id` VARCHAR(100) NULL AFTER `payout_provider`,
    ADD COLUMN `provider_reference` VARCHAR(100) NULL AFTER `provider_payout_id`,
    ADD COLUMN `payout_account_id` INT UNSIGNED NULL AFTER `provider_reference`,
    ADD COLUMN `manual_override` BOOLEAN NOT NULL DEFAULT false AFTER `payout_account_id`;

CREATE UNIQUE INDEX `uq_application_payouts_provider_payout_id` ON `application_payouts`(`provider_payout_id`);
CREATE UNIQUE INDEX `uq_application_payouts_provider_reference` ON `application_payouts`(`provider_reference`);
CREATE INDEX `idx_application_payouts_next_retry_at` ON `application_payouts`(`next_retry_at`);

ALTER TABLE `application_payouts`
    ADD CONSTRAINT `fk_application_payouts_payout_account_id` FOREIGN KEY (`payout_account_id`) REFERENCES `staff_payout_accounts`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

CREATE TABLE `payout_provider_events` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(30) NOT NULL DEFAULT 'mock',
    `provider_event_id` VARCHAR(150) NOT NULL,
    `provider_payout_id` VARCHAR(100) NULL,
    `application_payout_id` INT UNSIGNED NOT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `signature_valid` BOOLEAN NOT NULL DEFAULT false,
    `processing_status` VARCHAR(30) NOT NULL DEFAULT 'received',
    `raw_payload` MEDIUMTEXT NOT NULL,
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    `processed_at` TIMESTAMP(0) NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uq_payout_provider_events_provider_event_id`(`provider_event_id`),
    INDEX `idx_ppe_application_payout_id`(`application_payout_id`),
    INDEX `idx_ppe_provider_payout_id`(`provider_payout_id`),
    INDEX `idx_ppe_created_at`(`created_at`),
    CONSTRAINT `fk_ppe_application_payout_id` FOREIGN KEY (`application_payout_id`) REFERENCES `application_payouts`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
