import type { PrismaClient } from '../generated/prisma/client';

const QUIZ_UNLOCK_THRESHOLD = 750;

export async function backfillQuizUnlock(prisma: PrismaClient): Promise<void> {
  const { count } = await prisma.user.updateMany({
    where: { points: { gte: QUIZ_UNLOCK_THRESHOLD }, quizUnlocked: false },
    data: { quizUnlocked: true },
  });
  if (count > 0) console.log(`Quiz unlock backfill: unlocked ${count} user(s)`);
}

export async function checkQuizUnlock(prisma: PrismaClient, userId: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true, quizUnlocked: true },
  });
  if (user && user.points >= QUIZ_UNLOCK_THRESHOLD && !user.quizUnlocked) {
    await prisma.user.update({
      where: { id: userId },
      data: { quizUnlocked: true },
    });
  }
}
