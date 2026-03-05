import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';

export function challengeRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/challenges/quiz-result — Submit quiz score (0-10), increment user points
  router.post('/quiz-result', async (req, res) => {
    try {
      const { score } = req.body;

      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 10) {
        res.status(400).json({ error: 'Score must be an integer between 0 and 10' });
        return;
      }

      const user = await prisma.user.update({
        where: { id: req.userId! },
        data: { points: { increment: score } },
        select: { points: true },
      });

      res.json({ points: user.points });
    } catch (error) {
      console.error('Error submitting quiz result:', error);
      res.status(500).json({ error: 'Failed to submit quiz result' });
    }
  });

  return router;
}
