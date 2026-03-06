import type { PrismaClient } from '../generated/prisma/client';

const QUIZ_UNLOCK_THRESHOLD = 750;

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
