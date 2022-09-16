/*
  Warnings:

  - You are about to drop the `Client` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Config` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Container` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `IP` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Location` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Node` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Task` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `Client`;

-- DropTable
DROP TABLE `Config`;

-- DropTable
DROP TABLE `Container`;

-- DropTable
DROP TABLE `IP`;

-- DropTable
DROP TABLE `Location`;

-- DropTable
DROP TABLE `Node`;

-- DropTable
DROP TABLE `Task`;

-- CreateTable
CREATE TABLE `clients` (
    `client_id` VARCHAR(191) NOT NULL,
    `client_secret` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`client_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `config` (
    `config` JSON NOT NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ipv4` VARCHAR(191) NOT NULL,
    `ready` BOOLEAN NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ips` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ipv4` VARCHAR(191) NOT NULL,
    `gateway` VARCHAR(191) NOT NULL,
    `netmask` VARCHAR(191) NOT NULL,
    `used` BOOLEAN NOT NULL,
    `nodes` JSON NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `location` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nodes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nodename` VARCHAR(191) NOT NULL,
    `is_main` BOOLEAN NOT NULL,
    `ip` VARCHAR(191) NOT NULL,
    `location` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `containerID` INTEGER NOT NULL,
    `start_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `end_time` DATETIME(3) NULL,
    `data` JSON NULL,
    `status` VARCHAR(191) NULL,
    `error` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
