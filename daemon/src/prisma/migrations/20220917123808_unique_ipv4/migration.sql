/*
  Warnings:

  - A unique constraint covering the columns `[ipv4]` on the table `ips` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `ips_ipv4_key` ON `ips`(`ipv4`);
