import { Router } from 'express';
import multer, { memoryStorage } from 'multer';
import type { PrismaClient } from '../generated/prisma/client';
import { uploadAvatar, deleteAvatar } from '../services/cloudinary.service';

const upload = multer({
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const ALLOWED_MIMES = ['image/jpeg', 'image/png'];

export function userRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/users/me - Get current user profile
  router.get('/me', async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { id: true, email: true, lang: true, username: true, points: true, missionTipCount: true, photoUrl: true, bio: true },
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
      const { incrementMissionTip, username, email, bio } = req.body;

      const data: Record<string, unknown> = {};
      if (incrementMissionTip) data.missionTipCount = { increment: 1 };

      if (username !== undefined) {
        if (username) {
          const existing = await prisma.user.findUnique({ where: { username } });
          if (existing && existing.id !== req.userId!) {
            res.status(409).json({ error: 'username_taken' });
            return;
          }
        }
        data.username = username || null;
      }

      if (email !== undefined) {
        if (email) {
          const existing = await prisma.user.findUnique({ where: { email } });
          if (existing && existing.id !== req.userId!) {
            res.status(409).json({ error: 'email_taken' });
            return;
          }
        }
        data.email = email;
      }

      if (bio !== undefined) {
        data.bio = bio || null;
      }

      const user = await prisma.user.update({
        where: { id: req.userId! },
        data,
        select: { id: true, username: true, points: true, email: true, bio: true, photoUrl: true },
      });

      res.json(user);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // POST /api/users/me/photo - Upload avatar
  router.post('/me/photo', upload.single('photo'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      if (!ALLOWED_MIMES.includes(file.mimetype)) {
        res.status(400).json({ error: 'Only JPEG and PNG are allowed' });
        return;
      }

      // Delete old avatar if exists
      const current = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { photoUrl: true },
      });
      if (current?.photoUrl) {
        await deleteAvatar(current.photoUrl);
      }

      const url = await uploadAvatar(file.buffer, req.userId!);

      await prisma.user.update({
        where: { id: req.userId! },
        data: { photoUrl: url },
      });

      res.json({ photoUrl: url });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  });

  return router;
}
