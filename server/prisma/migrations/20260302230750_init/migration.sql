-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'es',
    "username" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "photo_url" TEXT,
    "bio" TEXT,
    "mission_tip_count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treks" (
    "id" SERIAL NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country" TEXT,
    "country_code" TEXT,
    "region" TEXT,
    "region_code" TEXT,
    "origin_lat" DOUBLE PRECISION,
    "origin_lng" DOUBLE PRECISION,
    "dest_lat" DOUBLE PRECISION,
    "dest_lng" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "treks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" SERIAL NOT NULL,
    "scientific_name" TEXT NOT NULL,
    "common_name_es" TEXT,
    "common_name_fr" TEXT,
    "genus" TEXT NOT NULL DEFAULT '',
    "family" TEXT NOT NULL DEFAULT '',
    "photo_url" TEXT,
    "photo_source" TEXT,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggested_plants" (
    "id" SERIAL NOT NULL,
    "commonName" TEXT NOT NULL,
    "scientificName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hint" TEXT NOT NULL DEFAULT '',
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "genus" TEXT NOT NULL DEFAULT '',
    "family" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'ai',
    "pending_similarity" INTEGER NOT NULL DEFAULT 0,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "foundAt" TIMESTAMP(3),
    "plant_id" INTEGER,
    "found_in_trek_id" INTEGER,
    "trek_id" INTEGER NOT NULL,

    CONSTRAINT "suggested_plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_photos" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "similarity" INTEGER NOT NULL DEFAULT 0,
    "plant_id" INTEGER NOT NULL,

    CONSTRAINT "plant_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" SERIAL NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "receiver_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quota" (
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_quota_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "plants_scientific_name_key" ON "plants"("scientific_name");

-- CreateIndex
CREATE INDEX "plants_family_idx" ON "plants"("family");

-- CreateIndex
CREATE INDEX "plants_genus_idx" ON "plants"("genus");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_sender_id_receiver_id_key" ON "friendships"("sender_id", "receiver_id");

-- AddForeignKey
ALTER TABLE "treks" ADD CONSTRAINT "treks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_plants" ADD CONSTRAINT "suggested_plants_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_plants" ADD CONSTRAINT "suggested_plants_found_in_trek_id_fkey" FOREIGN KEY ("found_in_trek_id") REFERENCES "treks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_plants" ADD CONSTRAINT "suggested_plants_trek_id_fkey" FOREIGN KEY ("trek_id") REFERENCES "treks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_photos" ADD CONSTRAINT "plant_photos_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "suggested_plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
