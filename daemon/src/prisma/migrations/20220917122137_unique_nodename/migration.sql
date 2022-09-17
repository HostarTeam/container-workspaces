/*
  Warnings:

  - A unique constraint covering the columns `[nodename]` on the table `nodes` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `nodes_nodename_key` ON `nodes`(`nodename`);
