-- CreateTable
CREATE TABLE "plant_photos" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "plant_id" INTEGER NOT NULL,

    CONSTRAINT "plant_photos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "plant_photos" ADD CONSTRAINT "plant_photos_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "suggested_plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MigrateData: copy existing image_urls into plant_photos (all marked as "inaturalist" since that was the only source)
INSERT INTO "plant_photos" ("url", "source", "plant_id")
SELECT unnest(image_urls), 'inaturalist', id
FROM "suggested_plants"
WHERE array_length(image_urls, 1) > 0;

-- DropColumn: remove the old denormalized column
ALTER TABLE "suggested_plants" DROP COLUMN "image_urls";

-- AlterTable (unrelated drift fix from Prisma)
ALTER TABLE "treks" ALTER COLUMN "month" DROP DEFAULT,
ALTER COLUMN "year" DROP DEFAULT;
