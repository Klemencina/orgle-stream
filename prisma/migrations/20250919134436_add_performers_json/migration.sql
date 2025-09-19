-- AlterTable
ALTER TABLE "public"."concerts" ADD COLUMN     "performers" JSONB[],
ADD COLUMN     "performersJson" JSONB;
