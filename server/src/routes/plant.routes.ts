// PlantRoutes: like a @RestController for plants in Spring
// Only handles HTTP request/response, delegates logic to the service

import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';
import { getSuggestedPlants } from '../services/plant.service';
import { incrementQuota } from '../services/quota.service';

// Factory function (same pattern as trekRouter/collectionRouter)
export function plantRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/plants/suggest
  router.post('/suggest', async (req, res) => {
    try {
      const { origin, destination, lang, originLat, originLng, destLat, destLng } = req.body;

      if (!origin || !destination) {
        res.status(400).json({ error: 'Origin and destination are required' });
        return;
      }

      // Check daily Google Maps quota (free tier limit)
      const withinQuota = await incrementQuota(prisma);
      if (!withinQuota) {
        res.status(429).json({ error: 'Daily usage limit reached. Try again tomorrow!' });
        return;
      }

      // Get all scientific names the user already has (across all treks)
      const existing = await prisma.suggestedPlant.findMany({
        where: { trek: { userId: req.userId! } },
        select: { scientificName: true },
        distinct: ['scientificName'],
      });
      const exclude = existing.map(p => p.scientificName);

      const result = await getSuggestedPlants(origin, destination, lang || 'es', undefined, exclude, originLat, originLng, destLat, destLng);

      // Hard filter: remove any plant whose scientificName is already in the user's collection
      // (the LLM prompt asks to exclude them, but it can ignore the instruction)
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
