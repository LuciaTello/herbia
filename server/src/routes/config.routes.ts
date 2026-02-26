import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';
import { isQuotaExhausted } from '../services/quota.service';

export function configRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/config — public endpoint to expose non-secret config to the frontend
  // Fail-closed: if quota check fails, don't expose the key (protect against unexpected charges)
  router.get('/', async (_req, res) => {
    try {
      const exhausted = await isQuotaExhausted(prisma);
      res.json({
        googleMapsApiKey: exhausted ? '' : (process.env['GOOGLE_MAPS_API_KEY'] || ''),
      });
    } catch (err) {
      console.error('Quota check failed, hiding key:', err);
      res.json({ googleMapsApiKey: '' });
    }
  });

  return router;
}
