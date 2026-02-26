import type { PrismaClient } from '../generated/prisma/client';

// Google Maps free tier (post March 2025): 10,000 free/month per SKU.
// Bottleneck = Autocomplete sessions (2 per suggest: origin + destination).
// 10,000 sessions ÷ 2 = 5,000 suggests/month → 166/day.
// 150/day leaves ~10% margin for wasted sessions (user autocompletes without suggesting).
const DAILY_QUOTA_LIMIT = 150;

/** Today as a UTC Date with time zeroed out (matches @db.Date) */
function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Increment today's counter. Returns true if we're still within the limit.
 */
export async function incrementQuota(prisma: PrismaClient): Promise<boolean> {
  const date = today();
  const row = await prisma.dailyQuota.upsert({
    where: { date },
    create: { date, count: 1 },
    update: { count: { increment: 1 } },
  });
  return row.count <= DAILY_QUOTA_LIMIT;
}

/**
 * Check if today's quota is exhausted (without incrementing).
 */
export async function isQuotaExhausted(prisma: PrismaClient): Promise<boolean> {
  const row = await prisma.dailyQuota.findUnique({ where: { date: today() } });
  return row !== null && row.count >= DAILY_QUOTA_LIMIT;
}
