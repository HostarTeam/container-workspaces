/*
  Warnings:

  - The `start_time` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `end_time` column on the `tasks` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE `tasks` DROP COLUMN `start_time`,
    ADD COLUMN `start_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    DROP COLUMN `end_time`,
    ADD COLUMN `end_time` DATETIME(3) NULL;
