-- CreateTable
CREATE TABLE "public"."concerts" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "image" TEXT NOT NULL,
    "streamUrl" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "concerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."concert_translations" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "performer" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "venueDetails" TEXT,
    "concertId" TEXT NOT NULL,

    CONSTRAINT "concert_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."program_pieces" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "concertId" TEXT NOT NULL,

    CONSTRAINT "program_pieces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."program_piece_translations" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "composer" TEXT NOT NULL,
    "programPieceId" TEXT NOT NULL,

    CONSTRAINT "program_piece_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "concert_translations_concertId_locale_key" ON "public"."concert_translations"("concertId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "program_piece_translations_programPieceId_locale_key" ON "public"."program_piece_translations"("programPieceId", "locale");

-- AddForeignKey
ALTER TABLE "public"."concert_translations" ADD CONSTRAINT "concert_translations_concertId_fkey" FOREIGN KEY ("concertId") REFERENCES "public"."concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."program_pieces" ADD CONSTRAINT "program_pieces_concertId_fkey" FOREIGN KEY ("concertId") REFERENCES "public"."concerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."program_piece_translations" ADD CONSTRAINT "program_piece_translations_programPieceId_fkey" FOREIGN KEY ("programPieceId") REFERENCES "public"."program_pieces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
