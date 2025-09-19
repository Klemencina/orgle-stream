/*
  Warnings:

  - You are about to drop the column `performer` on the `concert_translations` table. All the data in the column will be lost.
  - You are about to drop the column `performerDetails` on the `concert_translations` table. All the data in the column will be lost.
  - You are about to drop the column `performers` on the `concerts` table. All the data in the column will be lost.
  - You are about to drop the column `performersJson` on the `concerts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."concert_translations" DROP COLUMN "performer",
DROP COLUMN "performerDetails",
ADD COLUMN     "performers" JSONB,
ADD COLUMN     "subtitle" TEXT;

-- AlterTable
ALTER TABLE "public"."concerts" DROP COLUMN "performers",
DROP COLUMN "performersJson";
