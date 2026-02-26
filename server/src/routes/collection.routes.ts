// CollectionRoutes: like a @RestController for the plant collection in Spring
// The collection = all SuggestedPlants where found=true (your herbarium)

import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';

// We receive prisma as a parameter (like constructor injection with @Autowired in Spring)
export function collectionRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/collection - all found plants across all treks for this user
  router.get('/', async (req, res) => {
    try {
      const plants = await prisma.suggestedPlant.findMany({
        where: {
          found: true,
          trek: { userId: req.userId! },
        },
        include: {
          photos: true,
          trek: { select: { origin: true, destination: true, country: true, countryCode: true, region: true, regionCode: true } },
        },
        orderBy: { foundAt: 'desc' },
      });
      res.json(plants);
    } catch (error) {
      console.error('Error fetching collection:', error);
      res.status(500).json({ error: 'Failed to fetch collection' });
    }
  });

  // DELETE /api/collection/:id - soft-toggle: mark plant as not found
  // Like a soft delete - we don't remove the plant, just reset its found state
  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params['id']);

      // Verify ownership via trek.userId
      const plant = await prisma.suggestedPlant.findUnique({
        where: { id },
        include: { trek: { select: { userId: true } } },
      });

      if (!plant || plant.trek.userId !== req.userId!) {
        res.status(404).json({ error: 'Plant not found' });
        return;
      }

      await prisma.suggestedPlant.update({
        where: { id },
        data: { found: false, foundAt: null },
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error removing from collection:', error);
      res.status(500).json({ error: 'Failed to remove plant from collection' });
    }
  });

  return router;
}
