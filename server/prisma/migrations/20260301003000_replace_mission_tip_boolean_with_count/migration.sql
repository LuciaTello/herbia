-- Replace has_seen_mission_tip boolean with mission_tip_count integer
ALTER TABLE "users" ADD COLUMN "mission_tip_count" INTEGER NOT NULL DEFAULT 0;

-- Migrate existing data: users who had seen the tip get count=4 (won't see it again)
UPDATE "users" SET "mission_tip_count" = 4 WHERE "has_seen_mission_tip" = true;

ALTER TABLE "users" DROP COLUMN "has_seen_mission_tip";
