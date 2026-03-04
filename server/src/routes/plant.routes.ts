// PlantRoutes: like a @RestController for plants in Spring
// Only handles HTTP request/response, delegates logic to the service

import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';
import { getSuggestedPlants, ensurePlantPhoto, fetchFromWikipedia, fetchFromINaturalist } from '../services/plant.service';
import { incrementQuota } from '../services/quota.service';

// Factory function (same pattern as trekRouter/collectionRouter)
export function plantRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/plants/suggest
  router.post('/suggest', async (req, res) => {
    try {
      const { origin, destination, lang, originLat, originLng, destLat, destLng, region, count } = req.body;

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

      const trekFilter = region
        ? { userId: req.userId!, region }
        : { userId: req.userId! };

      const [found, recentlySuggested] = await Promise.all([
        prisma.suggestedPlant.findMany({
          where: { trek: trekFilter, found: true, foundAt: { gte: thirtyDaysAgo } },
          select: { scientificName: true },
          distinct: ['scientificName'],
        }),
        prisma.suggestedPlant.findMany({
          where: { trek: { ...trekFilter, createdAt: { gte: sevenDaysAgo } }, found: false },
          select: { scientificName: true },
          distinct: ['scientificName'],
        }),
      ]);

      const excludeSet = new Set([
        ...found.map(p => p.scientificName),
        ...recentlySuggested.map(p => p.scientificName),
      ]);
      const exclude = [...excludeSet];

      const plantCount = count === 10 ? 10 : 5;
      const result = await getSuggestedPlants(origin, dest, lang || 'es', undefined, exclude, originLat, originLng, destLat, destLng, plantCount);

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

  // GET /api/plants/family/:familyName - Get plants from a specific family with lazy-loaded photos
  router.get('/family/:familyName', async (req, res) => {
    try {
      const familyName = req.params['familyName'];
      if (!familyName) {
        res.status(400).json({ error: 'Family name is required' });
        return;
      }

      // Get user language for common name
      const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { lang: true } });
      const lang = user?.lang || 'es';

      const plants = await prisma.plant.findMany({
        where: { family: familyName },
        take: 20,
        orderBy: { scientificName: 'asc' },
      });

      // Lazy-load photos for plants that don't have one (max 5 concurrent)
      const CONCURRENCY = 5;
      for (let i = 0; i < plants.length; i += CONCURRENCY) {
        const batch = plants.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (p) => {
            const url = await ensurePlantPhoto(p, prisma);
            if (url) p.photoUrl = url;
          })
        );
      }

      const result = plants.map(p => ({
        id: p.id,
        scientificName: p.scientificName,
        commonName: lang === 'fr' ? (p.commonNameFr || p.commonNameEs || p.scientificName) : (p.commonNameEs || p.commonNameFr || p.scientificName),
        photoUrl: p.photoUrl,
        genus: p.genus,
      }));

      res.json(result);
    } catch (error) {
      console.error('Error fetching family plants:', error);
      res.status(500).json({ error: 'Failed to fetch family plants' });
    }
  });

  // POST /api/plants/photos/:photoId/refresh — re-fetch a broken trek photo
  router.post('/photos/:photoId/refresh', async (req, res) => {
    try {
      const photoId = Number(req.params['photoId']);
      if (!photoId) {
        res.status(400).json({ error: 'Invalid photo ID' });
        return;
      }

      // Find the photo and verify ownership (photo → plant (SuggestedPlant) → trek → user)
      const photo = await prisma.plantPhoto.findUnique({
        where: { id: photoId },
        include: { plant: { include: { trek: { select: { userId: true } } } } },
      });

      if (!photo || photo.plant?.trek?.userId !== req.userId) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }

      const scientificName = photo.plant!.scientificName;

      // Re-fetch based on original source
      let newUrl: string | null = null;
      if (photo.source === 'wikipedia') {
        const url = await fetchFromWikipedia(scientificName);
        if (url) newUrl = url;
      } else {
        const urls = await fetchFromINaturalist(scientificName);
        if (urls.length > 0) newUrl = urls[0];
      }

      if (newUrl) {
        await prisma.plantPhoto.update({ where: { id: photoId }, data: { url: newUrl } });
        res.json({ url: newUrl });
      } else {
        // No replacement found — remove the broken photo
        await prisma.plantPhoto.delete({ where: { id: photoId } });
        res.json({ url: null });
      }
    } catch (error) {
      console.error('Error refreshing photo:', error);
      res.status(500).json({ error: 'Failed to refresh photo' });
    }
  });

  // POST /api/plants/:plantId/refresh-photo — re-fetch a broken canonical plant photo
  router.post('/:plantId/refresh-photo', async (req, res) => {
    try {
      const plantId = Number(req.params['plantId']);
      if (!plantId) {
        res.status(400).json({ error: 'Invalid plant ID' });
        return;
      }

      const plant = await prisma.plant.findUnique({ where: { id: plantId } });
      if (!plant) {
        res.status(404).json({ error: 'Plant not found' });
        return;
      }

      // Clear existing broken photo so ensurePlantPhoto will re-fetch
      await prisma.plant.update({
        where: { id: plantId },
        data: { photoUrl: null, photoSource: null },
      });

      const url = await ensurePlantPhoto(
        { id: plantId, photoUrl: null, scientificName: plant.scientificName },
        prisma,
      );

      res.json({ url: url || null });
    } catch (error) {
      console.error('Error refreshing plant photo:', error);
      res.status(500).json({ error: 'Failed to refresh plant photo' });
    }
  });

  return router;
}
