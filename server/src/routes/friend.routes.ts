import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';

export function friendRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/friends - List accepted friends with their level info
  router.get('/', async (req, res) => {
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [{ senderId: req.userId! }, { receiverId: req.userId! }],
        },
        include: {
          sender: { select: { id: true, username: true, points: true } },
          receiver: { select: { id: true, username: true, points: true } },
        },
      });

      const friends = friendships.map(f =>
        f.senderId === req.userId! ? f.receiver : f.sender
      );

      res.json(friends);
    } catch (error) {
      console.error('Error fetching friends:', error);
      res.status(500).json({ error: 'Failed to fetch friends' });
    }
  });

  // GET /api/friends/pending - Received friend requests pending acceptance
  router.get('/pending', async (req, res) => {
    try {
      const pending = await prisma.friendship.findMany({
        where: { receiverId: req.userId!, status: 'pending' },
        include: {
          sender: { select: { id: true, username: true, points: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(pending.map(f => ({ friendshipId: f.id, id: f.sender.id, username: f.sender.username, points: f.sender.points })));
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
  });

  // POST /api/friends/request - Send a friend request by username
  router.post('/request', async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        res.status(400).json({ error: 'Username is required' });
        return;
      }

      const target = await prisma.user.findUnique({ where: { username } });
      if (!target) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      if (target.id === req.userId!) {
        res.status(400).json({ error: 'Cannot add yourself' });
        return;
      }

      // Check if friendship already exists (either direction)
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: req.userId!, receiverId: target.id },
            { senderId: target.id, receiverId: req.userId! },
          ],
        },
      });
      if (existing) {
        res.status(409).json({ error: 'Friend request already exists' });
        return;
      }

      await prisma.friendship.create({
        data: { senderId: req.userId!, receiverId: target.id },
      });

      res.status(201).json({ ok: true });
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ error: 'Failed to send request' });
    }
  });

  // PATCH /api/friends/:id/accept - Accept a friend request
  router.patch('/:id/accept', async (req, res) => {
    try {
      const id = parseInt(req.params['id']);
      const friendship = await prisma.friendship.findUnique({ where: { id } });

      if (!friendship || friendship.receiverId !== req.userId!) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }

      await prisma.friendship.update({
        where: { id },
        data: { status: 'accepted' },
      });

      res.json({ ok: true });
    } catch (error) {
      console.error('Error accepting friend request:', error);
      res.status(500).json({ error: 'Failed to accept request' });
    }
  });

  // DELETE /api/friends/:id - Reject or remove a friendship
  router.delete('/:id', async (req, res) => {
    try {
      const id = parseInt(req.params['id']);
      const friendship = await prisma.friendship.findUnique({ where: { id } });

      if (!friendship || (friendship.senderId !== req.userId! && friendship.receiverId !== req.userId!)) {
        res.status(404).json({ error: 'Friendship not found' });
        return;
      }

      await prisma.friendship.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting friendship:', error);
      res.status(500).json({ error: 'Failed to delete friendship' });
    }
  });

  // GET /api/friends/search?q= - Search users by username
  router.get('/search', async (req, res) => {
    try {
      const q = (req.query['q'] as string || '').trim();
      if (q.length < 2) {
        res.json([]);
        return;
      }

      const users = await prisma.user.findMany({
        where: {
          username: { contains: q, mode: 'insensitive' },
          id: { not: req.userId! },
        },
        select: { id: true, username: true, points: true },
        take: 10,
      });

      res.json(users);
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  return router;
}
