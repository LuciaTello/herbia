import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';

export function userRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/users/me - Get current user profile
  router.get('/me', async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { id: true, email: true, lang: true, username: true, points: true, missionTipCount: true },
      });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // PATCH /api/users/me - Update user preferences
  router.patch('/me', async (req, res) => {
    try {
      const { incrementMissionTip, username } = req.body;

      const data: Record<string, unknown> = {};
      if (incrementMissionTip) data.missionTipCount = { increment: 1 };
      if (username !== undefined) {
        // Check uniqueness
        if (username) {
          const existing = await prisma.user.findUnique({ where: { username } });
          if (existing && existing.id !== req.userId!) {
            res.status(409).json({ error: 'Username already taken' });
            return;
          }
        }
        data.username = username || null;
      }

      const user = await prisma.user.update({
        where: { id: req.userId! },
        data,
        select: { id: true, username: true, points: true },
      });

      res.json(user);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  return router;
}
