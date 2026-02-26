// TrekRoutes: like a @RestController for treks in Spring
// Handles CRUD for treks and marking plants as found

import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import type { PrismaClient } from '../generated/prisma/client';
import { uploadPhoto, deletePhoto } from '../services/cloudinary.service';
import { identifyPlant } from '../services/plantnet.service';

const upload = multer({
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png'];

const DAILY_TREK_LIMIT = 100;

// Factory function (same pattern as collectionRouter/authRouter)
export function trekRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/treks - Create a new trek or return existing one for this month
  router.post('/', async (req, res) => {
    try {
      const { origin, destination, description, plants: clientPlants } = req.body;
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      const year = now.getFullYear();

      // Normalize origin/destination for comparison (trim + uppercase to match frontend format)
      const normalizedOrigin = origin.trim().toUpperCase();
      const normalizedDestination = destination.trim().toUpperCase();

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
        include: { plants: { include: { photos: true }, orderBy: { rarity: 'asc' } } },
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

      // Plants come from the frontend preview (already fetched from Gemini + enriched with photos)
      // No second Gemini call needed!
      const trek = await prisma.trek.create({
        data: {
          origin: normalizedOrigin,
          destination: normalizedDestination,
          description: description || '',
          month,
          year,
          userId: req.userId!,
          plants: {
            create: (clientPlants || []).map((p: any) => ({
              commonName: p.commonName,
              scientificName: p.scientificName,
              description: p.description,
              rarity: p.rarity || 'common',
              photos: {
                create: (p.photos || []).map((photo: any) => ({
                  url: photo.url,
                  source: photo.source,
                })),
              },
            })),
          },
        },
        include: { plants: { include: { photos: true }, orderBy: { rarity: 'asc' } } },
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
        include: { plants: { include: { photos: true }, orderBy: { rarity: 'asc' } } },
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

      const now = new Date();

      // Mark ALL suggested plants with the same scientificName for this user as found
      await prisma.suggestedPlant.updateMany({
        where: {
          scientificName: plant.scientificName,
          found: false,
          trek: { userId: req.userId! },
        },
        data: { found: true, foundAt: now },
      });

      res.json({ scientificName: plant.scientificName, found: true, foundAt: now });
    } catch (error) {
      console.error('Error marking plant as found:', error);
      res.status(500).json({ error: 'Failed to mark plant as found' });
    }
  });

  // POST /api/treks/plants/:plantId/identify - Identify a plant photo via PlantNet
  router.post('/plants/:plantId/identify', upload.single('photo'), async (req, res) => {
    try {
      const plantId = parseInt(req.params['plantId'] as string);
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No photo provided' });
        return;
      }
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        res.status(400).json({ error: 'Invalid file type. Use JPEG or PNG' });
        return;
      }

      // Verify ownership
      const plant = await prisma.suggestedPlant.findUnique({
        where: { id: plantId },
        include: { trek: { select: { userId: true } } },
      });
      if (!plant || plant.trek.userId !== req.userId!) {
        res.status(404).json({ error: 'Plant not found' });
        return;
      }

      const result = await identifyPlant(file.buffer, file.mimetype, plant.scientificName);
      res.json(result);
    } catch (error) {
      console.error('Error identifying plant:', error);
      res.status(500).json({ error: 'Identification failed' });
    }
  });

  // POST /api/treks/plants/:plantId/photo - Upload a user photo for a found plant
  router.post('/plants/:plantId/photo', upload.single('photo'), async (req, res) => {
    try {
      const plantId = parseInt(req.params['plantId'] as string);
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No photo provided' });
        return;
      }
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        res.status(400).json({ error: 'Invalid file type. Use JPEG or PNG' });
        return;
      }

      // Verify ownership + found status
      const plant = await prisma.suggestedPlant.findUnique({
        where: { id: plantId },
        include: { trek: { select: { userId: true } } },
      });
      if (!plant || plant.trek.userId !== req.userId!) {
        res.status(404).json({ error: 'Plant not found' });
        return;
      }
      if (!plant.found) {
        res.status(400).json({ error: 'Plant must be marked as found before adding a photo' });
        return;
      }

      // Count user photos GLOBALLY for this species (across all treks of this user)
      const userPhotoCount = await prisma.plantPhoto.count({
        where: {
          source: 'user',
          plant: { scientificName: plant.scientificName, trek: { userId: req.userId! } },
        },
      });
      if (userPhotoCount >= 4) {
        res.status(409).json({ error: 'Maximum 4 photos per species' });
        return;
      }

      const url = await uploadPhoto(file.buffer, plantId);

      const photo = await prisma.plantPhoto.create({
        data: { url, source: 'user', plantId },
      });

      res.status(201).json(photo);
    } catch (error) {
      console.error('Error uploading plant photo:', error);
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  });

  // POST /api/treks/:trekId/add-plant - Add a user-found plant via PlantNet identification
  router.post('/:trekId/add-plant', upload.single('photo'), async (req, res) => {
    try {
      const trekId = parseInt(req.params['trekId'] as string);
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No photo provided' });
        return;
      }
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        res.status(400).json({ error: 'Invalid file type. Use JPEG or PNG' });
        return;
      }

      // Verify trek ownership
      const trek = await prisma.trek.findUnique({ where: { id: trekId } });
      if (!trek || trek.userId !== req.userId!) {
        res.status(404).json({ error: 'Trek not found' });
        return;
      }

      // Identify via PlantNet (no expected name — we just want to know what it is)
      const result = await identifyPlant(file.buffer, file.mimetype, '');
      const identified = result.identifiedAs !== '';
      const now = new Date();

      let plant;

      if (identified) {
        // Check if this species already exists in this trek (AI-suggested or user-added)
        const existingInTrek = await prisma.suggestedPlant.findFirst({
          where: { trekId, scientificName: result.identifiedAs },
          include: { photos: true },
        });

        if (existingInTrek) {
          plant = existingInTrek;
        } else {
          plant = await prisma.suggestedPlant.create({
            data: {
              trekId,
              source: 'user',
              scientificName: result.identifiedAs,
              commonName: result.commonName,
              description: '',
              rarity: 'common',
              found: true,
              foundAt: now,
            },
            include: { photos: true },
          });
        }

        // Mark ALL plants with same scientificName as found (across all user treks)
        await prisma.suggestedPlant.updateMany({
          where: {
            scientificName: result.identifiedAs,
            found: false,
            trek: { userId: req.userId! },
          },
          data: { found: true, foundAt: now },
        });

        // Check global photo count for this species
        const globalPhotoCount = await prisma.plantPhoto.count({
          where: {
            source: 'user',
            plant: { scientificName: result.identifiedAs, trek: { userId: req.userId! } },
          },
        });
        if (globalPhotoCount >= 4) {
          res.status(409).json({ error: 'Maximum 4 photos per species' });
          return;
        }
      } else {
        // Unidentified: always create a new entry (no species to deduplicate against)
        plant = await prisma.suggestedPlant.create({
          data: {
            trekId,
            source: 'user',
            scientificName: '',
            commonName: '',
            description: '',
            rarity: 'common',
            found: true,
            foundAt: now,
          },
          include: { photos: true },
        });
      }

      // Upload to Cloudinary + create PlantPhoto
      const url = await uploadPhoto(file.buffer, plant.id);
      await prisma.plantPhoto.create({
        data: { url, source: 'user', plantId: plant.id },
      });

      // Re-fetch with photos to return complete data
      const updated = await prisma.suggestedPlant.findUnique({
        where: { id: plant.id },
        include: { photos: true },
      });

      res.status(201).json({ plant: updated, identified });
    } catch (error) {
      console.error('Error adding user plant:', error);
      res.status(500).json({ error: 'Failed to add plant' });
    }
  });

  // DELETE /api/treks/plants/:plantId - Delete a user-added plant and its photos
  router.delete('/plants/:plantId', async (req, res) => {
    try {
      const plantId = parseInt(req.params['plantId']);

      const plant = await prisma.suggestedPlant.findUnique({
        where: { id: plantId },
        include: { photos: true, trek: { select: { userId: true } } },
      });

      if (!plant || plant.trek.userId !== req.userId!) {
        res.status(404).json({ error: 'Plant not found' });
        return;
      }

      if (plant.source !== 'user') {
        res.status(403).json({ error: 'Cannot delete AI-suggested plants' });
        return;
      }

      // Delete photos from Cloudinary
      for (const photo of plant.photos.filter(p => p.source === 'user')) {
        await deletePhoto(photo.url);
      }

      // Cascade: deleting the plant also deletes its PlantPhoto rows
      await prisma.suggestedPlant.delete({ where: { id: plantId } });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting user plant:', error);
      res.status(500).json({ error: 'Failed to delete plant' });
    }
  });

  // DELETE /api/treks/photos/:photoId - Delete a user photo from a plant
  router.delete('/photos/:photoId', async (req, res) => {
    try {
      const photoId = parseInt(req.params['photoId']);

      const photo = await prisma.plantPhoto.findUnique({
        where: { id: photoId },
        include: { plant: { include: { trek: { select: { userId: true } } } } },
      });

      if (!photo || photo.plant.trek.userId !== req.userId!) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }

      if (photo.source !== 'user') {
        res.status(403).json({ error: 'Cannot delete reference photos' });
        return;
      }

      await deletePhoto(photo.url);
      await prisma.plantPhoto.deleteMany({ where: { id: photoId } });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting photo:', error);
      res.status(500).json({ error: 'Failed to delete photo' });
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
