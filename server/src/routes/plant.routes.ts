// PlantRoutes: like a @RestController for plants in Spring
// Only handles HTTP request/response, delegates logic to the service

import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';
import { getSuggestedPlants } from '../services/plant.service';

// Factory function (same pattern as trekRouter/collectionRouter)
export function plantRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/plants/suggest
  router.post('/suggest', async (req, res) => {
    try {
      const { origin, destination, lang } = req.body;

      if (!origin || !destination) {
        res.status(400).json({ error: 'Origin and destination are required' });
        return;
      }

      // Get all scientific names the user already has (across all treks)
      const existing = await prisma.suggestedPlant.findMany({
        where: { trek: { userId: req.userId! } },
        select: { scientificName: true },
        distinct: ['scientificName'],
      });
      const exclude = existing.map(p => p.scientificName);

      const result = await getSuggestedPlants(origin, destination, lang || 'es', undefined, exclude);
      // Return description + plants (plants already come with photos[], filtered)
      res.json({ description: result.description, plants: result.plants || [] });
    } catch (error) {
      console.error('Error calling Gemini:', error);
      res.status(500).json({ error: 'Failed to get plant suggestions' });
    }
  });

  return router;
}
