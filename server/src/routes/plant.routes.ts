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
      const { origin, destination, lang, originLat, originLng, destLat, destLng } = req.body;

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

      // Only exclude plants the user has already FOUND (not just suggested)
      // Unfound plants can reappear in new missions
      const found = await prisma.suggestedPlant.findMany({
        where: { mission: { userId: req.userId! }, found: true },
        select: { scientificName: true },
        distinct: ['scientificName'],
      });
      const exclude = found.map(p => p.scientificName);

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
