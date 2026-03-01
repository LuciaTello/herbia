// MissionRoutes: like a @RestController for missions in Spring
// Handles CRUD for missions and marking plants as found

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

const DAILY_MISSION_LIMIT = 100;

// Factory function (same pattern as collectionRouter/authRouter)
export function missionRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/missions - Create a new mission
  router.post('/', async (req, res) => {
    try {
      const { origin, destination, description, plants: clientPlants, country, countryCode, region, regionCode, originLat, originLng, destLat, destLng } = req.body;
      const dest = destination || origin;
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      const year = now.getFullYear();

      // Normalize origin/destination for comparison (trim + uppercase to match frontend format)
      const normalizedOrigin = origin.trim().toUpperCase();
      const normalizedDestination = dest.trim().toUpperCase();

      // Round coordinates to 2 decimals (~1km precision)
      const roundedOriginLat = originLat ? Math.round(originLat * 100) / 100 : null;
      const roundedOriginLng = originLng ? Math.round(originLng * 100) / 100 : null;

      // Rate limit: max missions per user per day (protects API quota)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayCount = await prisma.mission.count({
        where: { userId: req.userId!, createdAt: { gte: startOfDay } },
      });
      if (todayCount >= DAILY_MISSION_LIMIT) {
        res.status(429).json({ error: 'Daily search limit reached' });
        return;
      }

      // Plants come from the frontend preview (already fetched from LLM + enriched with photos)
      const mission = await prisma.mission.create({
        data: {
          origin: normalizedOrigin,
          destination: normalizedDestination,
          description: description || '',
          month,
          year,
          country: country || null,
          countryCode: countryCode || null,
          region: region || null,
          regionCode: regionCode || null,
          originLat: roundedOriginLat,
          originLng: roundedOriginLng,
          destLat: destLat ? Math.round(destLat * 100) / 100 : null,
          destLng: destLng ? Math.round(destLng * 100) / 100 : null,
          userId: req.userId!,
          plants: {
            create: (clientPlants || []).map((p: any) => ({
              commonName: p.commonName,
              scientificName: p.scientificName,
              description: p.description,
              hint: p.hint || '',
              rarity: p.rarity || 'common',
              genus: p.genus || '',
              family: p.family || '',
              photos: {
                create: (p.photos || []).map((photo: any) => ({
                  url: photo.url,
                  source: photo.source,
                })),
              },
            })),
          },
        },
        include: { plants: { include: { photos: true, foundInMission: { select: { origin: true, destination: true } } }, orderBy: { rarity: 'asc' } } },
      });

      res.status(201).json(mission);
    } catch (error) {
      console.error('Error creating mission:', error);
      res.status(500).json({ error: 'Failed to create mission' });
    }
  });

  // GET /api/missions - List all missions for the authenticated user
  router.get('/', async (req, res) => {
    try {
      const missions = await prisma.mission.findMany({
        where: { userId: req.userId! },
        include: { plants: { include: { photos: true, foundInMission: { select: { origin: true, destination: true } } }, orderBy: { rarity: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(missions);
    } catch (error) {
      console.error('Error fetching missions:', error);
      res.status(500).json({ error: 'Failed to fetch missions' });
    }
  });

  // PATCH /api/missions/plants/:plantId/found - Mark a suggested plant as found
  router.patch('/plants/:plantId/found', async (req, res) => {
    try {
      const plantId = parseInt(req.params['plantId']);

      // Verify ownership: the plant's mission must belong to this user
      const plant = await prisma.suggestedPlant.findUnique({
        where: { id: plantId },
        include: { mission: { select: { userId: true } } },
      });

      if (!plant || plant.mission.userId !== req.userId!) {
        res.status(404).json({ error: 'Plant not found' });
        return;
      }

      const now = new Date();

      // Mark ALL suggested plants with the same scientificName for this user as found
      // Store which mission it was originally found in
      await prisma.suggestedPlant.updateMany({
        where: {
          scientificName: plant.scientificName,
          found: false,
          mission: { userId: req.userId! },
        },
        data: { found: true, foundAt: now, foundInMissionId: plant.missionId },
      });

      res.json({ scientificName: plant.scientificName, found: true, foundAt: now, foundInMissionId: plant.missionId });
    } catch (error) {
      console.error('Error marking plant as found:', error);
      res.status(500).json({ error: 'Failed to mark plant as found' });
    }
  });

  // POST /api/missions/plants/:plantId/identify - Identify a plant photo via PlantNet
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
        include: { mission: { select: { userId: true } } },
      });
      if (!plant || plant.mission.userId !== req.userId!) {
        res.status(404).json({ error: 'Plant not found' });
        return;
      }

      const result = await identifyPlant(file.buffer, file.mimetype, plant.scientificName, plant.genus, plant.family);

      res.json(result);
    } catch (error) {
      console.error('Error identifying plant:', error);
      res.status(500).json({ error: 'Identification failed' });
    }
  });

  // POST /api/missions/plants/:plantId/photo - Upload a user photo for a found plant
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
        include: { mission: { select: { userId: true } } },
      });
      if (!plant || plant.mission.userId !== req.userId!) {
        res.status(404).json({ error: 'Plant not found' });
        return;
      }
      if (!plant.found) {
        res.status(400).json({ error: 'Plant must be marked as found before adding a photo' });
        return;
      }

      // Count user photos GLOBALLY for this species (across all missions of this user)
      const userPhotoCount = await prisma.plantPhoto.count({
        where: {
          source: 'user',
          plant: { scientificName: plant.scientificName, mission: { userId: req.userId! } },
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

  // POST /api/missions/:missionId/add-plant - Add a user-found plant via PlantNet identification
  router.post('/:missionId/add-plant', upload.single('photo'), async (req, res) => {
    try {
      const missionId = parseInt(req.params['missionId'] as string);
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No photo provided' });
        return;
      }
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        res.status(400).json({ error: 'Invalid file type. Use JPEG or PNG' });
        return;
      }

      // Verify mission ownership
      const mission = await prisma.mission.findUnique({ where: { id: missionId } });
      if (!mission || mission.userId !== req.userId!) {
        res.status(404).json({ error: 'Mission not found' });
        return;
      }

      // Use pre-identified result if provided (avoids double PlantNet call)
      const preIdentifiedAs = req.body.identifiedAs;
      const preCommonName = req.body.commonName;
      let result;
      if (preIdentifiedAs !== undefined) {
        result = { match: false, score: 0, identifiedAs: preIdentifiedAs, commonName: preCommonName || '', similarity: 0 };
      } else {
        result = await identifyPlant(file.buffer, file.mimetype, '');
      }
      const identified = result.identifiedAs !== '';
      const now = new Date();

      let plant;

      if (identified) {
        // Check if this species already exists in this mission (AI-suggested or user-added)
        const existingInMission = await prisma.suggestedPlant.findFirst({
          where: { missionId, scientificName: result.identifiedAs },
          include: { photos: true },
        });

        if (existingInMission) {
          plant = existingInMission;
        } else {
          plant = await prisma.suggestedPlant.create({
            data: {
              missionId,
              source: 'user',
              scientificName: result.identifiedAs,
              commonName: result.commonName,
              description: '',
              rarity: 'common',
              found: true,
              foundAt: now,
              foundInMissionId: missionId,
            },
            include: { photos: true },
          });
        }

        // Mark ALL plants with same scientificName as found (across all user missions)
        await prisma.suggestedPlant.updateMany({
          where: {
            scientificName: result.identifiedAs,
            found: false,
            mission: { userId: req.userId! },
          },
          data: { found: true, foundAt: now, foundInMissionId: missionId },
        });

        // Check global photo count for this species
        const globalPhotoCount = await prisma.plantPhoto.count({
          where: {
            source: 'user',
            plant: { scientificName: result.identifiedAs, mission: { userId: req.userId! } },
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
            missionId,
            source: 'user',
            scientificName: '',
            commonName: '',
            description: '',
            rarity: 'common',
            found: true,
            foundAt: now,
            foundInMissionId: missionId,
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

  // DELETE /api/missions/plants/:plantId - Delete a user-added plant and its photos
  router.delete('/plants/:plantId', async (req, res) => {
    try {
      const plantId = parseInt(req.params['plantId']);

      const plant = await prisma.suggestedPlant.findUnique({
        where: { id: plantId },
        include: { photos: true, mission: { select: { userId: true } } },
      });

      if (!plant || plant.mission.userId !== req.userId!) {
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

  // DELETE /api/missions/photos/:photoId - Delete a user photo from a plant
  router.delete('/photos/:photoId', async (req, res) => {
    try {
      const photoId = parseInt(req.params['photoId']);

      const photo = await prisma.plantPhoto.findUnique({
        where: { id: photoId },
        include: { plant: { include: { mission: { select: { userId: true } } } } },
      });

      if (!photo || photo.plant.mission.userId !== req.userId!) {
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

  // PATCH /api/missions/:id/complete - Mark a mission as completed
  router.patch('/:id/complete', async (req, res) => {
    try {
      const id = parseInt(req.params['id']);
      const result = await prisma.mission.updateMany({
        where: { id, userId: req.userId! },
        data: { status: 'completed' },
      });
      if (result.count === 0) {
        res.status(404).json({ error: 'Mission not found' });
        return;
      }
      res.json({ id, status: 'completed' });
    } catch (error) {
      console.error('Error completing mission:', error);
      res.status(500).json({ error: 'Failed to complete mission' });
    }
  });

  // DELETE /api/missions/:id - Delete a mission (cascade deletes its plants)
  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params['id']);
      const result = await prisma.mission.deleteMany({
        where: { id, userId: req.userId! },
      });
      if (result.count === 0) {
        res.status(404).json({ error: 'Mission not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting mission:', error);
      res.status(500).json({ error: 'Failed to delete mission' });
    }
  });

  return router;
}
