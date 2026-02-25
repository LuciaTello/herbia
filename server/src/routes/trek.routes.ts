// TrekRoutes: like a @RestController for treks in Spring
// Handles CRUD for treks and marking plants as found

import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';
import { getSuggestedPlants } from '../services/plant.service';

const DAILY_TREK_LIMIT = 30;

// Factory function (same pattern as collectionRouter/authRouter)
export function trekRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/treks - Create a new trek or return existing one for this month
  router.post('/', async (req, res) => {
    try {
      const { origin, destination, lang } = req.body;
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      const year = now.getFullYear();

      // Normalize origin/destination for comparison (trim + lowercase)
      const normalizedOrigin = origin.trim().toLowerCase();
      const normalizedDestination = destination.trim().toLowerCase();

      // Check if a trek already exists for this user + route + month
      // Like findByUserIdAndOriginAndDestinationAndMonthAndYear in JPA
      const existing = await prisma.trek.findFirst({
        where: {
          userId: req.userId!,
          origin: normalizedOrigin,
          destination: normalizedDestination,
          month,
          year,
        },
        include: { plants: true },
      });

      if (existing) {
        res.json(existing);
        return;
      }

      // Rate limit: max 30 NEW treks per user per day (protects Gemini API quota)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayCount = await prisma.trek.count({
        where: { userId: req.userId!, createdAt: { gte: startOfDay } },
      });
      if (todayCount >= DAILY_TREK_LIMIT) {
        res.status(429).json({ error: 'Daily search limit reached' });
        return;
      }

      const result = await getSuggestedPlants(normalizedOrigin, normalizedDestination, lang, month);

      const trek = await prisma.trek.create({
        data: {
          origin: normalizedOrigin,
          destination: normalizedDestination,
          description: result.description,
          month,
          year,
          userId: req.userId!,
          plants: {
            create: result.plants.map(p => ({
              commonName: p.commonName,
              scientificName: p.scientificName,
              description: p.description,
              imageUrls: p.imageUrls || [],
              chancePercent: p.chancePercent || 0,
            })),
          },
        },
        include: { plants: true },
      });

      res.status(201).json(trek);
    } catch (error) {
      console.error('Error creating trek:', error);
      res.status(500).json({ error: 'Failed to create trek' });
    }
  });

  // GET /api/treks - List all treks for the authenticated user
  router.get('/', async (req, res) => {
    try {
      const treks = await prisma.trek.findMany({
        where: { userId: req.userId! },
        include: { plants: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json(treks);
    } catch (error) {
      console.error('Error fetching treks:', error);
      res.status(500).json({ error: 'Failed to fetch treks' });
    }
  });

  // PATCH /api/treks/plants/:plantId/found - Mark a suggested plant as found
  router.patch('/plants/:plantId/found', async (req, res) => {
    try {
      const plantId = parseInt(req.params['plantId']);

      // Verify ownership: the plant's trek must belong to this user
      const plant = await prisma.suggestedPlant.findUnique({
        where: { id: plantId },
        include: { trek: { select: { userId: true } } },
      });

      if (!plant || plant.trek.userId !== req.userId!) {
        res.status(404).json({ error: 'Plant not found' });
        return;
      }

      const updated = await prisma.suggestedPlant.update({
        where: { id: plantId },
        data: { found: true, foundAt: new Date() },
      });

      res.json(updated);
    } catch (error) {
      console.error('Error marking plant as found:', error);
      res.status(500).json({ error: 'Failed to mark plant as found' });
    }
  });

  // DELETE /api/treks/:id - Delete a trek (cascade deletes its plants)
  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params['id']);
      const result = await prisma.trek.deleteMany({
        where: { id, userId: req.userId! },
      });
      if (result.count === 0) {
        res.status(404).json({ error: 'Trek not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting trek:', error);
      res.status(500).json({ error: 'Failed to delete trek' });
    }
  });

  return router;
}
