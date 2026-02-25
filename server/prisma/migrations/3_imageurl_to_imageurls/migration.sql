-- Replace single imageUrl with imageUrls array (iNaturalist returns multiple photos)
ALTER TABLE "suggested_plants" DROP COLUMN IF EXISTS "imageUrl";
ALTER TABLE "suggested_plants" ADD COLUMN "image_urls" TEXT[] NOT NULL DEFAULT '{}';
