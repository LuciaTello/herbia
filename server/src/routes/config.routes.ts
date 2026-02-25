import { Router } from 'express';

export function configRouter(): Router {
  const router = Router();

  // GET /api/config — public endpoint to expose non-secret config to the frontend
  router.get('/', (_req, res) => {
    res.json({
      googleMapsApiKey: process.env['GOOGLE_MAPS_API_KEY'] || '',
    });
  });

  return router;
}
