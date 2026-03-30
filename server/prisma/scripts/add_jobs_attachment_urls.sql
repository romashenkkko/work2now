-- Adaugă coloana attachment_urls pe tabelul jobs dacă lipsește.
-- Rulează pe ACEEAȘI bază de date ca în server/.env (DATABASE_URL sau DB_NAME).
-- Compatibil MySQL / MariaDB (fără ADD COLUMN IF NOT EXISTS).

SET @dbname = DATABASE();
SET @tablename = 'jobs';
SET @columnname = 'attachment_urls';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT ''attachment_urls already exists'' AS info',
  'ALTER TABLE `jobs` ADD COLUMN `attachment_urls` TEXT NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
