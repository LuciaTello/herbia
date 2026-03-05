import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';

export function challengeRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/challenges/quiz-plants — Collection plants with localized names for quiz
  router.get('/quiz-plants', async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { lang: true },
      });
      const lang = user?.lang || 'es';

      const plants = await prisma.suggestedPlant.findMany({
        where: {
          found: true,
          trek: { userId: req.userId! },
          photos: { some: { source: 'user' } },
        },
        include: {
          photos: true,
          plant: { select: { commonNameEs: true, commonNameFr: true } },
        },
      });

      // Replace commonName with localized version from canonical Plant table
      const result = plants.map(p => {
        const localized = lang === 'fr' ? p.plant?.commonNameFr : p.plant?.commonNameEs;
        return {
          id: p.id,
          commonName: localized || p.commonName,
          scientificName: p.scientificName,
          genus: p.genus,
          family: p.family,
          photos: p.photos,
        };
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching quiz plants:', error);
      res.status(500).json({ error: 'Failed to fetch quiz plants' });
    }
  });

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
