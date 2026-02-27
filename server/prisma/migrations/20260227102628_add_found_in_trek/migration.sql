-- AlterTable
ALTER TABLE "suggested_plants" ADD COLUMN     "found_in_trek_id" INTEGER;

-- AddForeignKey
ALTER TABLE "suggested_plants" ADD CONSTRAINT "suggested_plants_found_in_trek_id_fkey" FOREIGN KEY ("found_in_trek_id") REFERENCES "treks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
