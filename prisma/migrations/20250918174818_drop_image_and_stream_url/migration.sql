/*
  Warnings:

  - You are about to drop the column `image` on the `concerts` table. All the data in the column will be lost.
  - You are about to drop the column `streamUrl` on the `concerts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."concerts" DROP COLUMN "image",
DROP COLUMN "streamUrl";
