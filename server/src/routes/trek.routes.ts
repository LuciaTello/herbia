// TrekRoutes: like a @RestController for treks in Spring
// Handles CRUD for treks and marking plants as found

import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import type { PrismaClient } from '../generated/prisma/client';
import { uploadPhoto, deletePhoto } from '../services/cloudinary.service';
import { identifyPlant, callPlantNet, calculateSimilarity, normalize } from '../services/plantnet.service';
import { translatePlantNames } from '../services/plant.service';
import { checkQuizUnlock } from '../services/quiz-unlock.service';

const upload = multer({
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png'];

const DAILY_TREK_LIMIT = 100;

// Factory function (same pattern as collectionRouter/authRouter)
export function trekRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/treks - Create a new trek
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

      // Rate limit: max treks per user per day (protects API quota)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayCount = await prisma.trek.count({
        where: { userId: req.userId!, createdAt: { gte: startOfDay } },
      });
      if (todayCount >= DAILY_TREK_LIMIT) {
        res.status(429).json({ error: 'Daily search limit reached' });
        return;
      }

      // Get user language for canonical plant common names
      const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { lang: true } });
      const lang = user?.lang || 'es';

      // Upsert canonical Plants for each suggested plant
      const plantsWithIds = await Promise.all(
        (clientPlants || []).map(async (p: any) => {
          let plantId: number | null = null;
          let family = p.family || '';
          const genus = p.genus || (p.scientificName ? p.scientificName.trim().split(/\s+/)[0] : '') || '';

          // If family is missing, try to look it up from canonical table or GBIF
          if (!family && p.scientificName) {
            const existing = await prisma.plant.findUnique({ where: { scientificName: p.scientificName }, select: { family: true } });
            if (existing?.family) {
              family = existing.family;
            } else {
              try {
                const gbifRes = await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(p.scientificName)}&kingdom=Plantae`);
                const gbifData = await gbifRes.json() as any;
                family = gbifData.family || '';
              } catch {}
            }
          }

          if (p.scientificName) {
            const canonical = await prisma.plant.upsert({
              where: { scientificName: p.scientificName },
              update: { family: family || undefined },
              create: {
                scientificName: p.scientificName,
                commonNameEs: lang === 'es' ? p.commonName : null,
                commonNameFr: lang === 'fr' ? p.commonName : null,
                genus,
                family,
              },
            });
            plantId = canonical.id;
          }
          return { ...p, plantId, family, genus };
        })
      );

      // Plants come from the frontend preview (already fetched from LLM + enriched with photos)
      const trek = await prisma.trek.create({
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
            create: plantsWithIds.map((p: any) => ({
              commonName: p.commonName,
              scientificName: p.scientificName,
              description: p.description,
              hint: p.hint || '',
              rarity: p.rarity || 'common',
              genus: p.genus || '',
              family: p.family || '',
              plantId: p.plantId,
              photos: {
                create: (p.photos || []).map((photo: any) => ({
                  url: photo.url,
                  source: photo.source,
                })),
              },
            })),
          },
        },
        include: { plants: { include: { photos: true, foundInTrek: { select: { origin: true, destination: true } } }, orderBy: { family: 'asc' } } },
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
        include: { plants: { include: { photos: true, foundInTrek: { select: { origin: true, destination: true } } }, orderBy: { family: 'asc' } } },
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
      // Store which trek it was originally found in
      await prisma.suggestedPlant.updateMany({
        where: {
          scientificName: plant.scientificName,
          found: false,
          trek: { userId: req.userId! },
        },
        data: { found: true, foundAt: now, foundInTrekId: plant.trekId },
      });

      res.json({ scientificName: plant.scientificName, found: true, foundAt: now, foundInTrekId: plant.trekId });
    } catch (error) {
      console.error('Error marking plant as found:', error);
      res.status(500).json({ error: 'Failed to mark plant as found' });
    }
  });

  // POST /api/treks/:trekId/identify-all - Identify a photo against ALL plants in a trek
  router.post('/:trekId/identify-all', upload.single('photo'), async (req, res) => {
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
      const trek = await prisma.trek.findUnique({
        where: { id: trekId },
        include: { plants: { where: { source: 'ai' } } },
      });
      if (!trek || trek.userId !== req.userId!) {
        res.status(404).json({ error: 'Trek not found' });
        return;
      }

      // Get user language for translation
      const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { lang: true } });
      const lang = user?.lang || 'es';

      // Single PlantNet call — get ALL raw results
      const allResults = await callPlantNet(file.buffer, file.mimetype);

      if (!allResults.length) {
        res.json({
          plantnetResult: { identifiedAs: '', commonName: '', score: 0, genus: '', family: '' },
          matches: [],
        });
        return;
      }

      const best = allResults[0];
      const englishName = best.species.commonNames?.[0] || '';
      const sciName = best.species.scientificNameWithoutAuthor;

      // Try cached translation from canonical Plant table, else translate via Groq
      let localizedName = englishName;
      if (englishName && sciName) {
        const nameField = lang === 'fr' ? 'commonNameFr' : 'commonNameEs';
        const canonical = await prisma.plant.findUnique({ where: { scientificName: sciName }, select: { commonNameEs: true, commonNameFr: true } });
        const cachedName = lang === 'fr' ? canonical?.commonNameFr : canonical?.commonNameEs;
        if (cachedName) {
          localizedName = cachedName;
        } else {
          const translations = await translatePlantNames([{ scientificName: sciName, commonName: englishName }], lang);
          localizedName = translations.get(sciName) || englishName;
          // Cache for next time
          try {
            await prisma.plant.upsert({
              where: { scientificName: sciName },
              update: { [nameField]: localizedName },
              create: {
                scientificName: sciName,
                [nameField]: localizedName,
                genus: best.species.genus?.scientificNameWithoutAuthor || '',
                family: best.species.family?.scientificNameWithoutAuthor || '',
              },
            });
          } catch { /* ignore */ }
        }
      }

      const plantnetResult = {
        identifiedAs: sciName,
        commonName: localizedName,
        score: Math.round(best.score * 100),
        genus: best.species.genus?.scientificNameWithoutAuthor || '',
        family: best.species.family?.scientificNameWithoutAuthor || '',
      };

      // Compare ALL PlantNet results against each trek plant
      const matches: Array<{ plantId: number; commonName: string; scientificName: string; similarity: number; alreadyCaptured: boolean }> = [];

      for (const plant of trek.plants) {
        const sim = await calculateSimilarity(
          allResults,
          plant.scientificName,
          plant.genus,
          plant.family,
        );
        if (sim.similarity > 0) {
          const speciesPhotoCount = await prisma.plantPhoto.count({
            where: {
              source: 'user',
              plant: {
                scientificName: plant.scientificName,
                trek: { userId: req.userId! },
              },
            },
          });
          matches.push({
            plantId: plant.id,
            commonName: plant.commonName,
            scientificName: plant.scientificName,
            similarity: sim.similarity,
            alreadyCaptured: speciesPhotoCount >= 5,
          });
        }
      }

      // Sort by similarity descending
      matches.sort((a, b) => b.similarity - a.similarity);

      res.json({ plantnetResult, matches });
    } catch (error) {
      console.error('Error in identify-all:', error);
      res.status(500).json({ error: 'Identification failed' });
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

      const result = await identifyPlant(file.buffer, file.mimetype, plant.scientificName, plant.genus, plant.family);

      // Backfill genus/family in DB if they were missing (avoids repeated lookups)
      const backfill: Record<string, string> = {};
      if (!plant.genus && result.genus) backfill.genus = plant.scientificName.trim().split(/\s+/)[0];
      if (!plant.family && result.family) backfill.family = result.family;
      if (Object.keys(backfill).length) {
        await prisma.suggestedPlant.update({ where: { id: plantId }, data: backfill });
      }

      // Store pending similarity on plant (awarded when photo is actually uploaded)
      if (result.similarity > 0) {
        await prisma.suggestedPlant.update({
          where: { id: plantId },
          data: { pendingSimilarity: result.similarity },
        });
      }

      res.json({ ...result, similarity: multiplied });
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

      // Auto-mark as found when uploading a photo
      if (!plant.found) {
        const now = new Date();
        await prisma.suggestedPlant.updateMany({
          where: { scientificName: plant.scientificName, trek: { userId: req.userId! }, found: false },
          data: { found: true, foundAt: now, foundInTrekId: plant.trekId },
        });
      }

      // Award similarity points: use body param if provided (from identify-all), else pendingSimilarity
      const bodySimilarity = parseInt(req.body.similarity);
      const similarity = bodySimilarity > 0 ? bodySimilarity : (plant.pendingSimilarity || 0);
      const identifiedAs = req.body.identifiedAs || null;
      const identifiedCommonName = req.body.identifiedCommonName || null;

      // Limit: max 5 user photos per species per user (global, across all treks)
      const speciesPhotoCount = await prisma.plantPhoto.count({
        where: {
          source: 'user',
          plant: {
            scientificName: plant.scientificName,
            trek: { userId: req.userId! },
          },
        },
      });
      if (speciesPhotoCount >= 5) {
        // Award points but don't save the photo
        if (similarity > 0) {
          await prisma.user.update({
            where: { id: req.userId! },
            data: { points: { increment: similarity } },
          });
          await prisma.suggestedPlant.update({
            where: { id: plantId },
            data: { pendingSimilarity: 0 },
          });
          await checkQuizUnlock(prisma, req.userId!);
        }
        res.json({ pointsOnly: true, similarity });
        return;
      }

      const url = await uploadPhoto(file.buffer, plantId);
      const photo = await prisma.plantPhoto.create({
        data: { url, source: 'user', plantId, similarity, identifiedAs, identifiedCommonName },
      });

      if (similarity > 0) {
        await prisma.user.update({
          where: { id: req.userId! },
          data: { points: { increment: similarity } },
        });
        await prisma.suggestedPlant.update({
          where: { id: plantId },
          data: { pendingSimilarity: 0 },
        });
        await checkQuizUnlock(prisma, req.userId!);
      }

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

      // Get user language for translation
      const addPlantUser = await prisma.user.findUnique({ where: { id: req.userId! }, select: { lang: true } });
      const addPlantLang = addPlantUser?.lang || 'es';

      // Use pre-identified result if provided (avoids double PlantNet call)
      const preIdentifiedAs = req.body.identifiedAs;
      const preCommonName = req.body.commonName;
      let result;
      if (preIdentifiedAs !== undefined) {
        // commonName from identify-all is already translated
        result = { match: false, score: 0, identifiedAs: preIdentifiedAs, commonName: preCommonName || '', similarity: 0 };
      } else {
        result = await identifyPlant(file.buffer, file.mimetype, '');
        // Translate PlantNet English name
        if (result.identifiedAs && result.commonName) {
          const canonical = await prisma.plant.findUnique({ where: { scientificName: result.identifiedAs }, select: { commonNameEs: true, commonNameFr: true } });
          const cachedName = addPlantLang === 'fr' ? canonical?.commonNameFr : canonical?.commonNameEs;
          if (cachedName) {
            result.commonName = cachedName;
          } else {
            const translations = await translatePlantNames([{ scientificName: result.identifiedAs, commonName: result.commonName }], addPlantLang);
            result.commonName = translations.get(result.identifiedAs) || result.commonName;
          }
        }
      }
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
              foundInTrekId: trekId,
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
          data: { found: true, foundAt: now, foundInTrekId: trekId },
        });

        // Limit: max 5 user photos per species per user (global)
        const speciesPhotoCount = await prisma.plantPhoto.count({
          where: {
            source: 'user',
            plant: {
              scientificName: result.identifiedAs,
              trek: { userId: req.userId! },
            },
          },
        });
        if (speciesPhotoCount >= 5) {
          // Re-fetch with photos to return complete data
          const updated = await prisma.suggestedPlant.findUnique({
            where: { id: plant.id },
            include: { photos: true },
          });
          res.status(201).json({ plant: updated, identified, pointsOnly: true });
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
            foundInTrekId: trekId,
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
      const userPhotos = plant.photos.filter(p => p.source === 'user');
      for (const photo of userPhotos) {
        await deletePhoto(photo.url);
      }

      // Deduct points earned from all user photos of this plant
      const totalSimilarity = userPhotos.reduce((sum, p) => sum + p.similarity, 0);

      // Cascade: deleting the plant also deletes its PlantPhoto rows
      await prisma.suggestedPlant.delete({ where: { id: plantId } });

      if (totalSimilarity > 0) {
        await prisma.user.update({
          where: { id: req.userId! },
          data: { points: { decrement: totalSimilarity } },
        });
      }

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

      // Deduct points that were earned from this photo
      if (photo.similarity > 0) {
        await prisma.user.update({
          where: { id: req.userId! },
          data: { points: { decrement: photo.similarity } },
        });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting photo:', error);
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  });

  // PUT /api/treks/photos/:photoId/replace - Swap a saved user photo with a new one
  router.put('/photos/:photoId/replace', upload.single('photo'), async (req, res) => {
    try {
      const photoId = parseInt(req.params['photoId'] as string);
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'No photo provided' });
        return;
      }
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        res.status(400).json({ error: 'Invalid file type. Use JPEG or PNG' });
        return;
      }

      // Verify ownership + user source
      const photo = await prisma.plantPhoto.findUnique({
        where: { id: photoId },
        include: { plant: { include: { trek: { select: { userId: true } } } } },
      });

      if (!photo || photo.plant.trek.userId !== req.userId!) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }
      if (photo.source !== 'user') {
        res.status(403).json({ error: 'Cannot replace reference photos' });
        return;
      }

      // Delete old from Cloudinary, upload new
      await deletePhoto(photo.url);
      const newUrl = await uploadPhoto(file.buffer, photo.plantId);

      // New similarity from body (from a fresh identification)
      const newSimilarity = parseInt(req.body.similarity) || 0;
      const identifiedAs = req.body.identifiedAs || null;
      const identifiedCommonName = req.body.identifiedCommonName || null;

      // Adjust points: deduct old, add new
      const oldSimilarity = photo.similarity;
      const pointsDelta = newSimilarity - oldSimilarity;
      if (pointsDelta !== 0) {
        await prisma.user.update({
          where: { id: req.userId! },
          data: { points: { increment: pointsDelta } },
        });
        if (pointsDelta > 0) {
          await checkQuizUnlock(prisma, req.userId!);
        }
      }

      const updated = await prisma.plantPhoto.update({
        where: { id: photoId },
        data: { url: newUrl, similarity: newSimilarity, identifiedAs, identifiedCommonName },
      });

      res.json(updated);
    } catch (error) {
      console.error('Error replacing photo:', error);
      res.status(500).json({ error: 'Failed to replace photo' });
    }
  });

  // PATCH /api/treks/:id/complete - Mark a trek as completed
  router.patch('/:id/complete', async (req, res) => {
    try {
      const id = parseInt(req.params['id']);
      const result = await prisma.trek.updateMany({
        where: { id, userId: req.userId! },
        data: { status: 'completed' },
      });
      if (result.count === 0) {
        res.status(404).json({ error: 'Trek not found' });
        return;
      }
      res.json({ id, status: 'completed' });
    } catch (error) {
      console.error('Error completing trek:', error);
      res.status(500).json({ error: 'Failed to complete trek' });
    }
  });

  // PATCH /api/treks/:id/reactivate - Unarchive a completed trek
  router.patch('/:id/reactivate', async (req, res) => {
    try {
      const id = parseInt(req.params['id']);
      const result = await prisma.trek.updateMany({
        where: { id, userId: req.userId! },
        data: { status: 'active' },
      });
      if (result.count === 0) {
        res.status(404).json({ error: 'Trek not found' });
        return;
      }
      res.json({ id, status: 'active' });
    } catch (error) {
      console.error('Error reactivating trek:', error);
      res.status(500).json({ error: 'Failed to reactivate trek' });
    }
  });

  // DELETE /api/treks/:id - Delete a trek (cascade deletes its plants)
  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params['id']);

      // Fetch user photos before cascade delete so we can clean up Cloudinary + deduct points
      const userPhotos = await prisma.plantPhoto.findMany({
        where: {
          source: 'user',
          plant: { trek: { id, userId: req.userId! } },
        },
        select: { url: true, similarity: true },
      });

      const totalSimilarity = userPhotos.reduce((sum, p) => sum + p.similarity, 0);

      const result = await prisma.trek.deleteMany({
        where: { id, userId: req.userId! },
      });
      if (result.count === 0) {
        res.status(404).json({ error: 'Trek not found' });
        return;
      }

      // Deduct points earned from all photos in this trek
      if (totalSimilarity > 0) {
        await prisma.user.update({
          where: { id: req.userId! },
          data: { points: { decrement: totalSimilarity } },
        });
      }

      // Clean up Cloudinary (best-effort, don't fail the request)
      await Promise.allSettled(userPhotos.map(p => deletePhoto(p.url)));

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting trek:', error);
      res.status(500).json({ error: 'Failed to delete trek' });
    }
  });

  return router;
}
