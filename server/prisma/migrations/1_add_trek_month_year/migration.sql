-- AlterTable: add month and year columns for seasonal plant suggestions
ALTER TABLE "treks" ADD COLUMN "month" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "treks" ADD COLUMN "year" INTEGER NOT NULL DEFAULT 2026;
