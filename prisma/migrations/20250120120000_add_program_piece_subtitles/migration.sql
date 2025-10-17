-- Add subtitles column to program_piece_translations table
ALTER TABLE "program_piece_translations" ADD COLUMN "subtitles" TEXT[] NOT NULL DEFAULT '{}';
