BEGIN;

CREATE TABLE "concert_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripePriceId" VARCHAR(255),
    "salesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "concert_groups_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "_ConcertToConcertGroup" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ConcertToConcertGroup_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_ConcertToConcertGroup_B_index" ON "_ConcertToConcertGroup"("B");
ALTER TABLE "_ConcertToConcertGroup" ADD CONSTRAINT "_ConcertToConcertGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ConcertToConcertGroup" ADD CONSTRAINT "_ConcertToConcertGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "concert_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "festival_passes" ADD COLUMN "groupId" TEXT;
ALTER TABLE "festival_passes" ADD COLUMN "checkoutPath" TEXT;
-- Preserve existing orders in explicit groups. An operator must enable new sales.
INSERT INTO "concert_groups" ("id", "name")
SELECT DISTINCT 'legacy-year-' || "year", "year" || ' festival pass' FROM "festival_passes";
-- Freeze existing year coverage as selected concerts, including currently hidden ones.
INSERT INTO "_ConcertToConcertGroup" ("A", "B")
SELECT c."id", g."id" FROM "concerts" c JOIN "concert_groups" g
ON g."id" = 'legacy-year-' || EXTRACT(YEAR FROM c."date" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Ljubljana')::integer;
UPDATE "festival_passes" SET "groupId" = 'legacy-year-' || "year";
ALTER TABLE "festival_passes" ALTER COLUMN "groupId" SET NOT NULL;
ALTER TABLE "festival_passes" ALTER COLUMN "year" DROP NOT NULL;
DROP INDEX "festival_passes_userId_year_key";
CREATE UNIQUE INDEX "festival_passes_userId_groupId_key" ON "festival_passes"("userId", "groupId");
ALTER TABLE "festival_passes" ADD CONSTRAINT "festival_passes_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "concert_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
