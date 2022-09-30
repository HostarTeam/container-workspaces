/*
  Warnings:

  - You are about to drop the column `location` on the `nodes` table. All the data in the column will be lost.
  - Added the required column `locationId` to the `nodes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `nodes` DROP COLUMN `location`,
    ADD COLUMN `locationId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `nodes` ADD CONSTRAINT `nodes_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
