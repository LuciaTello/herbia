// CollectionRoutes: like a @RestController for the plant collection in Spring
// Handles CRUD operations, delegates database access to Prisma

import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';

// We receive prisma as a parameter (like constructor injection with @Autowired in Spring)
// This is a function that RETURNS a router, not a router directly
export function collectionRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/collection - like @GetMapping + repository.findAll()
  router.get('/', async (_req, res) => {
    try {
      const plants = await prisma.foundPlant.findMany({
        orderBy: { foundAt: 'desc' },
      });
      res.json(plants);
    } catch (error) {
      console.error('Error fetching collection:', error);
      res.status(500).json({ error: 'Failed to fetch collection' });
    }
  });

  // POST /api/collection - like @PostMapping + repository.save()
  router.post('/', async (req, res) => {
    try {
      const { commonName, scientificName, description, imageUrl, route } = req.body;
      const plant = await prisma.foundPlant.create({
        data: { commonName, scientificName, description, imageUrl, route },
      });
      res.status(201).json(plant);
    } catch (error) {
      console.error('Error adding to collection:', error);
      res.status(500).json({ error: 'Failed to add plant to collection' });
    }
  });

  // DELETE /api/collection/:id - like @DeleteMapping("/{id}") + repository.deleteById()
  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params['id']);
      await prisma.foundPlant.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting from collection:', error);
      res.status(500).json({ error: 'Failed to delete plant from collection' });
    }
  });

  return router;
}
