// PlantRoutes: like a @RestController for plants in Spring
// Only handles HTTP request/response, delegates logic to the service

import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';
import { getSuggestedPlants } from '../services/plant.service';
import { incrementQuota } from '../services/quota.service';

// Factory function (same pattern as missionRouter/collectionRouter)
export function plantRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/plants/suggest
  router.post('/suggest', async (req, res) => {
    try {
      const { origin, destination, lang, originLat, originLng, destLat, destLng, region } = req.body;

      if (!origin) {
        res.status(400).json({ error: 'Origin is required' });
        return;
      }
      const dest = destination || origin;

      // Check daily Google Maps quota (free tier limit)
      const withinQuota = await incrementQuota(prisma);
      if (!withinQuota) {
        res.status(429).json({ error: 'Daily usage limit reached. Try again tomorrow!' });
        return;
      }

      // Exclude found plants (same region, last 30 days)
      // + recently suggested but not found (same region, last 7 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const missionFilter = region
        ? { userId: req.userId!, region }
        : { userId: req.userId! };

      const [found, recentlySuggested] = await Promise.all([
        prisma.suggestedPlant.findMany({
          where: { mission: missionFilter, found: true, foundAt: { gte: thirtyDaysAgo } },
          select: { scientificName: true },
          distinct: ['scientificName'],
        }),
        prisma.suggestedPlant.findMany({
          where: { mission: { ...missionFilter, createdAt: { gte: sevenDaysAgo } }, found: false },
          select: { scientificName: true },
          distinct: ['scientificName'],
        }),
      ]);

      const excludeSet = new Set([
        ...found.map(p => p.scientificName),
        ...recentlySuggested.map(p => p.scientificName),
      ]);
      const exclude = [...excludeSet];

      const result = await getSuggestedPlants(origin, dest, lang || 'es', undefined, exclude, originLat, originLng, destLat, destLng);

      // Hard filter: remove any found plant (the LLM/iNat might still return them)
      const excludeLower = new Set(exclude.map(name => name.toLowerCase()));
      const filteredPlants = (result.plants || [])
        .filter((p: any) => !excludeLower.has(p.scientificName.toLowerCase()))
        .sort((a: any, b: any) => (a.rarity || 'common').localeCompare(b.rarity || 'common'));

      res.json({ tooFar: result.tooFar, description: result.description, plants: filteredPlants });
    } catch (error) {
      console.error('Error fetching plant suggestions:', error);
      res.status(500).json({ error: 'Failed to get plant suggestions' });
    }
  });

  return router;
}
