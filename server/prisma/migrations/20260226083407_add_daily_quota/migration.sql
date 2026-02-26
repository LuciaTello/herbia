-- CreateTable
CREATE TABLE "daily_quota" (
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_quota_pkey" PRIMARY KEY ("date")
);
