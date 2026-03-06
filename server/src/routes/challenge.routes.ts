import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';
import { translatePlantNames, fetchFromINaturalist } from '../services/plant.service';

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
          plant: { select: { id: true, commonNameEs: true, commonNameFr: true } },
        },
      });

      // Split: plants with localized name vs those needing translation
      const nameField = lang === 'fr' ? 'commonNameFr' : 'commonNameEs';
      const needsTranslation = plants.filter(p => !p.plant?.[nameField]);
      const hasTranslation = plants.filter(p => p.plant?.[nameField]);

      // Translate missing names via Groq (batch)
      let translations = new Map<string, string>();
      if (needsTranslation.length > 0) {
        // Deduplicate by scientificName
        const unique = [...new Map(needsTranslation.map(p => [p.scientificName, p])).values()];
        translations = await translatePlantNames(
          unique.map(p => ({ scientificName: p.scientificName, commonName: p.commonName })),
          lang,
        );

        // Cache translations in canonical Plant table
        for (const [sciName, translatedName] of translations) {
          try {
            await prisma.plant.upsert({
              where: { scientificName: sciName },
              update: { [nameField]: translatedName },
              create: {
                scientificName: sciName,
                [nameField]: translatedName,
                genus: needsTranslation.find(p => p.scientificName === sciName)?.genus || '',
                family: needsTranslation.find(p => p.scientificName === sciName)?.family || '',
              },
            });
          } catch { /* ignore cache errors */ }
        }
      }

      // Build response with localized names
      const result = plants.map(p => {
        const cached = p.plant?.[nameField];
        const translated = translations.get(p.scientificName);
        return {
          id: p.id,
          commonName: cached || translated || p.commonName,
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

  // POST /api/challenges/quiz-extra-photos — Fetch iNaturalist photos for plants lacking enough
  router.post('/quiz-extra-photos', async (req, res) => {
    try {
      const { plants } = req.body as { plants: { scientificName: string; need: number }[] };
      if (!Array.isArray(plants) || plants.length === 0) {
        res.json({});
        return;
      }

      const result: Record<string, string[]> = {};
      await Promise.all(
        plants.map(async (p) => {
          const urls = await fetchFromINaturalist(p.scientificName);
          result[p.scientificName] = urls.slice(0, p.need);
        })
      );

      res.json(result);
    } catch (error) {
      console.error('Error fetching extra quiz photos:', error);
      res.status(500).json({ error: 'Failed to fetch extra photos' });
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
