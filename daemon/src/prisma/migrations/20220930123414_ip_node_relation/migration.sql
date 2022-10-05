/*
  Warnings:

  - You are about to drop the column `nodes` on the `ips` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `ips` DROP COLUMN `nodes`;

-- CreateTable
CREATE TABLE `_IpToNode` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_IpToNode_AB_unique`(`A`, `B`),
    INDEX `_IpToNode_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_IpToNode` ADD CONSTRAINT `_IpToNode_A_fkey` FOREIGN KEY (`A`) REFERENCES `ips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_IpToNode` ADD CONSTRAINT `_IpToNode_B_fkey` FOREIGN KEY (`B`) REFERENCES `nodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
