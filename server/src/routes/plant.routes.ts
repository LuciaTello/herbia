// PlantRoutes: like a @RestController for plants in Spring
// Only handles HTTP request/response, delegates logic to the service

import { Router } from 'express';
import { getSuggestedPlants } from '../services/plant.service';

// Router is like a mini @RestController - groups related endpoints
export const plantRouter = Router();

// POST /api/plants/suggest
plantRouter.post('/suggest', async (req, res) => {
  try {
    const { origin, destination, lang } = req.body;

    if (!origin || !destination) {
      res.status(400).json({ error: 'Origin and destination are required' });
      return;
    }

    const plants = await getSuggestedPlants(origin, destination, lang || 'es');
    res.json(plants);
  } catch (error) {
    console.error('Error calling Gemini:', error);
    res.status(500).json({ error: 'Failed to get plant suggestions' });
  }
});
