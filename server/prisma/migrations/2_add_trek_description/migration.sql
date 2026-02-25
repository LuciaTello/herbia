-- AlterTable: add description column for general trek/vegetation overview
ALTER TABLE "treks" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
