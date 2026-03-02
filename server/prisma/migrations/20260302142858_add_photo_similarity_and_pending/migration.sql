-- AlterTable
ALTER TABLE "plant_photos" ADD COLUMN     "similarity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "suggested_plants" ADD COLUMN     "pending_similarity" INTEGER NOT NULL DEFAULT 0;
