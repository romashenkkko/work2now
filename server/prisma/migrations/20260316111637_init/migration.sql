-- CreateTable
CREATE TABLE `about` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section_label` VARCHAR(100) NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NULL,
    `image_url` TEXT NULL,
    `counters_enabled` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `about_stats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `icon_svg` TEXT NULL,
    `number_value` INTEGER NOT NULL,
    `suffix` VARCHAR(20) NULL,
    `label` VARCHAR(100) NOT NULL,
    `sort_order` INTEGER NULL DEFAULT 0,
    `enabled` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `last_login` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `username`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_work_sessions` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `application_id` INTEGER UNSIGNED NOT NULL,
    `work_date` DATE NOT NULL,
    `checked_in_at` TIMESTAMP(0) NULL,
    `checked_out_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_application_id`(`application_id`),
    UNIQUE INDEX `uq_app_date`(`application_id`, `work_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applications` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `job_id` INTEGER UNSIGNED NOT NULL,
    `staff_id` CHAR(36) NULL,
    `staff_name` VARCHAR(100) NOT NULL,
    `staff_email` VARCHAR(191) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `status_code` INTEGER NULL,
    `checked_in_at` TIMESTAMP(0) NULL,
    `checked_out_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `business_confirmed_at` TIMESTAMP(0) NULL,

    INDEX `idx_app_job_id`(`job_id`),
    INDEX `idx_app_staff_id`(`staff_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `Id` CHAR(36) NOT NULL,
    `BusinessProfileId` CHAR(36) NOT NULL,
    `Name` VARCHAR(200) NOT NULL,
    `Address` VARCHAR(300) NOT NULL,
    `City` VARCHAR(120) NOT NULL,
    `Country` VARCHAR(120) NOT NULL,
    `PhoneNumber` VARCHAR(50) NOT NULL,
    `IsActive` BOOLEAN NOT NULL DEFAULT true,
    `CreatedAt` DATETIME(0) NOT NULL,
    `ContactPersonName` VARCHAR(100) NOT NULL DEFAULT '',
    `ContactPersonSurname` VARCHAR(100) NOT NULL DEFAULT '',

    INDEX `idx_branches_business_profile_id`(`BusinessProfileId`),
    PRIMARY KEY (`Id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_profiles` (
    `Id` CHAR(36) NOT NULL,
    `UserId` CHAR(36) NOT NULL,
    `CompanyName` VARCHAR(200) NOT NULL,
    `ContactPersonName` VARCHAR(100) NOT NULL,
    `ContactPersonSurname` VARCHAR(100) NOT NULL,
    `IDNO` VARCHAR(13) NULL,
    `CompanyCategory` INTEGER NOT NULL,
    `InfoForStaff` VARCHAR(2000) NOT NULL DEFAULT '',

    UNIQUE INDEX `UserId`(`UserId`),
    INDEX `idx_business_profiles_user_id`(`UserId`),
    PRIMARY KEY (`Id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_name` VARCHAR(255) NOT NULL,
    `client_email` VARCHAR(255) NOT NULL,
    `client_location` VARCHAR(255) NULL,
    `testimonial_text` TEXT NOT NULL,
    `rating` INTEGER NULL DEFAULT 5,
    `status` ENUM('pending', 'approved', 'rejected') NULL DEFAULT 'pending',
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `approved_at` TIMESTAMP(0) NULL,
    `approved_by` INTEGER NULL,

    INDEX `idx_created_at`(`created_at`),
    INDEX `idx_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section_label` VARCHAR(100) NULL,
    `title` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `phone` VARCHAR(50) NULL,
    `phone_icon` TEXT NULL,
    `phone_enabled` BOOLEAN NULL DEFAULT true,
    `whatsapp` VARCHAR(50) NULL,
    `whatsapp_icon` TEXT NULL,
    `whatsapp_enabled` BOOLEAN NULL DEFAULT true,
    `email` VARCHAR(255) NULL,
    `email_icon` TEXT NULL,
    `email_enabled` BOOLEAN NULL DEFAULT true,
    `address` TEXT NULL,
    `address_icon` TEXT NULL,
    `address_enabled` BOOLEAN NULL DEFAULT true,
    `map_embed` TEXT NULL,
    `map_enabled` BOOLEAN NULL DEFAULT true,
    `form_title` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_profiles` (
    `Id` CHAR(36) NOT NULL,
    `UserId` CHAR(36) NOT NULL,
    `IDNP` VARCHAR(13) NOT NULL,
    `Name` VARCHAR(100) NOT NULL,
    `Surname` VARCHAR(100) NOT NULL,
    `DateOfBirth` DATETIME(0) NOT NULL,
    `AboutMe` VARCHAR(1000) NOT NULL DEFAULT '',
    `ProfilePictureFileId` CHAR(36) NULL,

    UNIQUE INDEX `UserId`(`UserId`),
    INDEX `idx_employee_profiles_user_id`(`UserId`),
    PRIMARY KEY (`Id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `experiences` (
    `Id` CHAR(36) NOT NULL,
    `EmployeeProfileId` CHAR(36) NOT NULL,
    `JobCategory` INTEGER NOT NULL,
    `Duration` INTEGER NOT NULL,
    `Description` TEXT NOT NULL,

    INDEX `idx_experiences_employee_profile_id`(`EmployeeProfileId`),
    PRIMARY KEY (`Id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faq` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question` VARCHAR(500) NOT NULL,
    `answer` TEXT NOT NULL,
    `sort_order` INTEGER NULL DEFAULT 0,
    `enabled` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faq_section` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section_label` VARCHAR(100) NULL,
    `title` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hero` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `subtitle` TEXT NULL,
    `cta_text` VARCHAR(100) NULL,
    `cta_link` VARCHAR(255) NULL,
    `image_url` TEXT NULL,
    `video_url` TEXT NULL,
    `video_type` ENUM('upload', 'youtube', 'vimeo') NULL DEFAULT 'upload',
    `media_type` ENUM('image', 'video') NULL DEFAULT 'image',
    `trust_bar_enabled` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hero_trust_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `icon_svg` TEXT NULL,
    `text` VARCHAR(255) NOT NULL,
    `sort_order` INTEGER NULL DEFAULT 0,
    `enabled` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_categories` (
    `Id` CHAR(36) NOT NULL,
    `Code` INTEGER NOT NULL,
    `Title` VARCHAR(150) NOT NULL,
    `HourlyMin` INTEGER NOT NULL,
    `CreatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_job_categories_code`(`Code`),
    INDEX `idx_job_categories_title`(`Title`),
    PRIMARY KEY (`Id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` CHAR(36) NULL,
    `location` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
    `status_class` VARCHAR(100) NOT NULL DEFAULT 'bg-gray-100 text-gray-700',
    `date` VARCHAR(50) NOT NULL,
    `end_date` VARCHAR(50) NULL,
    `job_type` VARCHAR(30) NULL,
    `applications_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `start_time` VARCHAR(20) NULL,
    `end_time` VARCHAR(20) NULL,
    `people_needed` VARCHAR(50) NULL,
    `duration` VARCHAR(100) NULL,
    `estimated_salary` VARCHAR(100) NULL,
    `image_url` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `check_in_lat` DOUBLE NULL,
    `check_in_lng` DOUBLE NULL,
    `check_in_radius_m` INTEGER NULL,
    `job_category_code` INTEGER NULL,
    `hourly_rate_base` DECIMAL(10, 2) NULL,
    `Title` VARCHAR(30) NOT NULL,
    `is_promoted` BOOLEAN NOT NULL DEFAULT false,
    `raion_id` INTEGER UNSIGNED NULL,
    `localitate` VARCHAR(200) NULL,

    INDEX `fk_jobs_job_category_code_job_categories_code`(`job_category_code`),
    INDEX `idx_jobs_raion_id`(`raion_id`),
    INDEX `idx_jobs_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NULL,
    `file_url` TEXT NOT NULL,
    `file_type` VARCHAR(50) NULL,
    `file_size` INTEGER NULL,
    `folder` VARCHAR(100) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `process_section` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section_label` VARCHAR(100) NULL,
    `title` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `process_steps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `step_number` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `image_url` TEXT NULL,
    `features` TEXT NULL,
    `sort_order` INTEGER NULL DEFAULT 0,
    `enabled` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `raioane` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('raion', 'municipiu', 'unitate_autonoma') NOT NULL DEFAULT 'raion',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `name`(`name`),
    INDEX `idx_raioane_name`(`name`),
    INDEX `idx_raioane_type`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ratings` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `application_id` INTEGER UNSIGNED NOT NULL,
    `rater_id` CHAR(36) NULL,
    `rated_id` CHAR(36) NULL,
    `score` DECIMAL(2, 1) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `comment` TEXT NULL,
    `photo_url` MEDIUMTEXT NULL,
    `job_title` VARCHAR(255) NULL,

    INDEX `idx_rated_id`(`rated_id`),
    INDEX `idx_rater_id`(`rater_id`),
    UNIQUE INDEX `idx_ratings_application_rater`(`application_id`, `rater_id`),
    UNIQUE INDEX `ratings_app_rater`(`application_id`, `rater_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `email` VARCHAR(120) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `message` TEXT NOT NULL,
    `rating` TINYINT UNSIGNED NOT NULL,
    `approved` BOOLEAN NOT NULL DEFAULT false,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `approved_at` TIMESTAMP(0) NULL,

    INDEX `idx_reviews_approved`(`approved`),
    INDEX `idx_reviews_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `image_url` TEXT NULL,
    `icon_svg` TEXT NULL,
    `features` TEXT NULL,
    `sort_order` INTEGER NULL DEFAULT 0,
    `enabled` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services_section` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section_label` VARCHAR(100) NULL,
    `title` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `setting_key`(`setting_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `testimonials` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_name` VARCHAR(255) NOT NULL,
    `client_location` VARCHAR(255) NULL,
    `client_photo` TEXT NULL,
    `testimonial_text` TEXT NOT NULL,
    `rating` INTEGER NULL DEFAULT 5,
    `sort_order` INTEGER NULL DEFAULT 0,
    `enabled` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `testimonials_section` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section_label` VARCHAR(100) NULL,
    `title` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `Id` CHAR(36) NOT NULL,
    `Email` VARCHAR(191) NOT NULL,
    `PasswordHash` VARCHAR(255) NOT NULL,
    `Role` INTEGER NOT NULL,
    `CreatedAt` DATETIME(0) NOT NULL,
    `Avatar` MEDIUMTEXT NULL,
    `IsActive` BOOLEAN NOT NULL DEFAULT true,
    `LastActiveAt` DATETIME(0) NULL,
    `PhoneNumber` VARCHAR(50) NULL,
    `BoosterUntil` DATETIME(0) NULL,

    UNIQUE INDEX `Email`(`Email`),
    INDEX `idx_users_email`(`Email`),
    INDEX `idx_users_role`(`Role`),
    PRIMARY KEY (`Id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `why_us` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section_label` VARCHAR(100) NULL,
    `title` VARCHAR(255) NULL,
    `image_url` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `why_us_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `icon_svg` TEXT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NULL DEFAULT 0,
    `enabled` BOOLEAN NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `application_work_sessions` ADD CONSTRAINT `fk_app_work_sessions_application_id` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `fk_applications_job_id_jobs_id` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `fk_applications_staff_id_users_id` FOREIGN KEY (`staff_id`) REFERENCES `users`(`Id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `branches` ADD CONSTRAINT `fk_branches_businessprofileid_business_profiles_id` FOREIGN KEY (`BusinessProfileId`) REFERENCES `business_profiles`(`Id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `business_profiles` ADD CONSTRAINT `fk_business_profiles_userid_users_id` FOREIGN KEY (`UserId`) REFERENCES `users`(`Id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employee_profiles` ADD CONSTRAINT `fk_employee_profiles_userid_users_id` FOREIGN KEY (`UserId`) REFERENCES `users`(`Id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `experiences` ADD CONSTRAINT `fk_experiences_employeeprofileid_employee_profiles_id` FOREIGN KEY (`EmployeeProfileId`) REFERENCES `employee_profiles`(`Id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `fk_jobs_job_category_code_job_categories_code` FOREIGN KEY (`job_category_code`) REFERENCES `job_categories`(`Code`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `fk_jobs_raion_id_raioane_id` FOREIGN KEY (`raion_id`) REFERENCES `raioane`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `jobs` ADD CONSTRAINT `fk_jobs_user_id_users_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`Id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ratings` ADD CONSTRAINT `fk_ratings_application_id_applications_id` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ratings` ADD CONSTRAINT `fk_ratings_rated_id_users_id` FOREIGN KEY (`rated_id`) REFERENCES `users`(`Id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ratings` ADD CONSTRAINT `fk_ratings_rater_id_users_id` FOREIGN KEY (`rater_id`) REFERENCES `users`(`Id`) ON DELETE SET NULL ON UPDATE RESTRICT;
