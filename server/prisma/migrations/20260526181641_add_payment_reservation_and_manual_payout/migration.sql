-- AlterTable
ALTER TABLE `branches` ADD COLUMN `RaionId` INTEGER UNSIGNED NULL;

-- AlterTable
ALTER TABLE `employee_profiles` ADD COLUMN `CvFileUrl` VARCHAR(500) NULL,
    ADD COLUMN `CvOriginalName` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `jobs` ADD COLUMN `branch_id` CHAR(36) NULL,
    ADD COLUMN `gallery_image_urls` TEXT NULL;

-- CreateTable
CREATE TABLE `application_payments` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `application_id` INTEGER UNSIGNED NOT NULL,
    `job_id` INTEGER UNSIGNED NOT NULL,
    `customer_user_id` CHAR(36) NOT NULL,
    `staff_user_id` CHAR(36) NOT NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'MDL',
    `hourly_rate_snapshot` DECIMAL(10, 2) NOT NULL,
    `worked_minutes` INTEGER UNSIGNED NOT NULL,
    `amount_due` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('draft', 'awaiting_customer_payment', 'paynet_pending', 'paid', 'failed', 'cancelled', 'refund_pending', 'refunded', 'disputed') NOT NULL DEFAULT 'draft',
    `provider` VARCHAR(20) NOT NULL DEFAULT 'paynet',
    `paynet_order_id` VARCHAR(100) NULL,
    `paynet_transaction_id` VARCHAR(100) NULL,
    `customer_confirmed_at` TIMESTAMP(0) NULL,
    `payment_started_at` TIMESTAMP(0) NULL,
    `paid_at` TIMESTAMP(0) NULL,
    `failed_at` TIMESTAMP(0) NULL,
    `last_error` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_application_payments_application_id`(`application_id`),
    UNIQUE INDEX `uq_application_payments_paynet_order_id`(`paynet_order_id`),
    UNIQUE INDEX `uq_application_payments_paynet_transaction_id`(`paynet_transaction_id`),
    INDEX `idx_application_payments_job_id`(`job_id`),
    INDEX `idx_application_payments_customer_user_id`(`customer_user_id`),
    INDEX `idx_application_payments_staff_user_id`(`staff_user_id`),
    INDEX `idx_application_payments_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paynet_webhook_events` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(20) NOT NULL DEFAULT 'paynet',
    `provider_event_id` VARCHAR(100) NOT NULL,
    `paynet_order_id` VARCHAR(100) NULL,
    `application_payment_id` INTEGER UNSIGNED NOT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `signature_valid` BOOLEAN NOT NULL DEFAULT false,
    `processing_status` VARCHAR(30) NOT NULL DEFAULT 'received',
    `raw_payload` MEDIUMTEXT NOT NULL,
    `received_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `processed_at` TIMESTAMP(0) NULL,
    `error_message` TEXT NULL,

    UNIQUE INDEX `uq_paynet_webhook_events_provider_event_id`(`provider_event_id`),
    INDEX `idx_paynet_webhook_events_application_payment_id`(`application_payment_id`),
    INDEX `idx_paynet_webhook_events_paynet_order_id`(`paynet_order_id`),
    INDEX `idx_paynet_webhook_events_received_at`(`received_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_idempotency_keys` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `actor_user_id` CHAR(36) NOT NULL,
    `scope` VARCHAR(80) NOT NULL,
    `idempotency_key` VARCHAR(100) NOT NULL,
    `request_hash` VARCHAR(128) NOT NULL,
    `response_status` INTEGER NULL,
    `response_body` MEDIUMTEXT NULL,
    `expires_at` TIMESTAMP(0) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_payment_idempotency_keys_actor_user_id`(`actor_user_id`),
    INDEX `idx_payment_idempotency_keys_scope`(`scope`),
    INDEX `idx_payment_idempotency_keys_expires_at`(`expires_at`),
    UNIQUE INDEX `uq_payment_idempotency_keys_actor_scope_key`(`actor_user_id`, `scope`, `idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_payment_reservations` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id` INTEGER UNSIGNED NOT NULL,
    `customer_user_id` CHAR(36) NOT NULL,
    `provider` ENUM('paynet') NOT NULL DEFAULT 'paynet',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'MDL',
    `planned_minutes_snapshot` INTEGER UNSIGNED NOT NULL,
    `hourly_rate_snapshot` DECIMAL(10, 2) NOT NULL,
    `reserved_amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('draft', 'reserve_pending', 'reserved', 'reserve_failed', 'release_pending', 'released', 'refund_pending', 'refunded', 'cancelled', 'disputed') NOT NULL DEFAULT 'draft',
    `paynet_order_id` VARCHAR(100) NULL,
    `paynet_transaction_id` VARCHAR(100) NULL,
    `reserved_at` TIMESTAMP(0) NULL,
    `reservation_expires_at` TIMESTAMP(0) NULL,
    `released_at` TIMESTAMP(0) NULL,
    `refunded_at` TIMESTAMP(0) NULL,
    `last_error` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_job_payment_reservations_job_id`(`job_id`),
    UNIQUE INDEX `uq_job_payment_reservations_paynet_order_id`(`paynet_order_id`),
    UNIQUE INDEX `uq_job_payment_reservations_paynet_transaction_id`(`paynet_transaction_id`),
    INDEX `idx_job_payment_reservations_customer_user_id`(`customer_user_id`),
    INDEX `idx_job_payment_reservations_status`(`status`),
    INDEX `idx_job_payment_reservations_provider`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_payouts` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_payment_reservation_id` INTEGER UNSIGNED NOT NULL,
    `job_id` INTEGER UNSIGNED NOT NULL,
    `application_id` INTEGER UNSIGNED NOT NULL,
    `customer_user_id` CHAR(36) NOT NULL,
    `staff_user_id` CHAR(36) NOT NULL,
    `marked_paid_by_user_id` CHAR(36) NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'MDL',
    `planned_minutes_snapshot` INTEGER UNSIGNED NOT NULL,
    `actual_minutes_snapshot` INTEGER UNSIGNED NOT NULL,
    `approved_overtime_minutes` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `hourly_rate_snapshot` DECIMAL(10, 2) NOT NULL,
    `reserved_amount_snapshot` DECIMAL(10, 2) NOT NULL,
    `payout_amount` DECIMAL(10, 2) NOT NULL,
    `overtime_amount_snapshot` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('not_started', 'awaiting_work', 'in_progress', 'awaiting_customer_confirmation', 'payout_pending', 'paid', 'failed', 'cancelled', 'disputed') NOT NULL DEFAULT 'not_started',
    `payout_due_at` TIMESTAMP(0) NULL,
    `payout_pending_at` TIMESTAMP(0) NULL,
    `paid_at` TIMESTAMP(0) NULL,
    `failed_at` TIMESTAMP(0) NULL,
    `last_error` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_application_payouts_application_id`(`application_id`),
    INDEX `idx_application_payouts_job_payment_reservation_id`(`job_payment_reservation_id`),
    INDEX `idx_application_payouts_job_id`(`job_id`),
    INDEX `idx_application_payouts_customer_user_id`(`customer_user_id`),
    INDEX `idx_application_payouts_staff_user_id`(`staff_user_id`),
    INDEX `idx_application_payouts_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_webhook_events` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `provider` ENUM('paynet') NOT NULL DEFAULT 'paynet',
    `provider_event_id` VARCHAR(100) NOT NULL,
    `job_payment_reservation_id` INTEGER UNSIGNED NOT NULL,
    `paynet_order_id` VARCHAR(100) NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `signature_valid` BOOLEAN NOT NULL DEFAULT false,
    `processing_status` VARCHAR(30) NOT NULL DEFAULT 'received',
    `raw_payload` MEDIUMTEXT NOT NULL,
    `error_message` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `processed_at` TIMESTAMP(0) NULL,

    UNIQUE INDEX `uq_payment_webhook_events_provider_event_id`(`provider_event_id`),
    INDEX `idx_payment_webhook_events_job_payment_reservation_id`(`job_payment_reservation_id`),
    INDEX `idx_payment_webhook_events_paynet_order_id`(`paynet_order_id`),
    INDEX `idx_payment_webhook_events_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_branches_raion_id` ON `branches`(`RaionId`);

-- CreateIndex
CREATE INDEX `idx_jobs_branch_id` ON `jobs`(`branch_id`);

-- AddForeignKey
ALTER TABLE `application_payments` ADD CONSTRAINT `fk_application_payments_application_id_applications_id` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `application_payments` ADD CONSTRAINT `fk_application_payments_job_id_jobs_id` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `application_payments` ADD CONSTRAINT `fk_application_payments_customer_user_id_users_id` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`Id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `application_payments` ADD CONSTRAINT `fk_application_payments_staff_user_id_users_id` FOREIGN KEY (`staff_user_id`) REFERENCES `users`(`Id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `paynet_webhook_events` ADD CONSTRAINT `fk_pwe_app_payment_id_app_payments_id` FOREIGN KEY (`application_payment_id`) REFERENCES `application_payments`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payment_idempotency_keys` ADD CONSTRAINT `fk_payment_idempotency_keys_actor_user_id_users_id` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`Id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `fk_branches_raionid_raioane_id` FOREIGN KEY (`RaionId`) REFERENCES `raioane`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `fk_jobs_branch_id_branches_id` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`Id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `job_payment_reservations` ADD CONSTRAINT `fk_job_payment_reservations_job_id_jobs_id` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `job_payment_reservations` ADD CONSTRAINT `fk_job_payment_reservations_customer_user_id_users_id` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`Id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `application_payouts` ADD CONSTRAINT `fk_app_payouts_res_id_reservations_id` FOREIGN KEY (`job_payment_reservation_id`) REFERENCES `job_payment_reservations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `application_payouts` ADD CONSTRAINT `fk_application_payouts_job_id_jobs_id` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `application_payouts` ADD CONSTRAINT `fk_application_payouts_application_id_applications_id` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `application_payouts` ADD CONSTRAINT `fk_application_payouts_customer_user_id_users_id` FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`Id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `application_payouts` ADD CONSTRAINT `fk_application_payouts_staff_user_id_users_id` FOREIGN KEY (`staff_user_id`) REFERENCES `users`(`Id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `application_payouts` ADD CONSTRAINT `fk_application_payouts_marked_paid_by_user_id_users_id` FOREIGN KEY (`marked_paid_by_user_id`) REFERENCES `users`(`Id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `payment_webhook_events` ADD CONSTRAINT `fk_pwe_res_id_reservations_id` FOREIGN KEY (`job_payment_reservation_id`) REFERENCES `job_payment_reservations`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
