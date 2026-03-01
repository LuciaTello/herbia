import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';

export function userRouter(prisma: PrismaClient): Router {
  const router = Router();

  // PATCH /api/users/me - Update user preferences
  router.patch('/me', async (req, res) => {
    try {
      const { incrementMissionTip } = req.body;

      const data: Record<string, unknown> = {};
      if (incrementMissionTip) data.missionTipCount = { increment: 1 };

      await prisma.user.update({
        where: { id: req.userId! },
        data,
      });

      res.json({ ok: true });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  return router;
}
