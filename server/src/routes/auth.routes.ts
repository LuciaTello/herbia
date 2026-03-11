// AuthRoutes: public auth endpoints
//   POST /check-email  — check if email exists in our DB (used by login step 1)
//   POST /sync         — create our DB user after Clerk sign-up (protected by Clerk token)

import { Router } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import type { PrismaClient } from '../generated/prisma/client';

export function authRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/auth/check-email
  // Checks if the email exists in our DB, returns { exists, lang }
  // Used by login step 1 to decide whether to show login or register form.
  router.post('/check-email', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.json({ exists: false });
        return;
      }
      res.json({ exists: true, lang: user.lang });
    } catch (error) {
      console.error('Check email error:', error);
      res.status(500).json({ error: 'Check email failed' });
    }
  });

  // POST /api/auth/sync  (requires valid Clerk token)
  // Called right after Clerk sign-up completes.
  // Creates the user row in our DB using the Clerk identity.
  router.post('/sync', async (req, res) => {
    try {
      const { userId: clerkId } = getAuth(req);
      if (!clerkId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { lang, username } = req.body;

      // Fetch email from Clerk (the source of truth)
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) {
        res.status(400).json({ error: 'No email on Clerk user' });
        return;
      }

      const user = await prisma.user.create({
        data: {
          clerkId,
          email,
          lang: lang || 'es',
          username: username?.trim() || null,
        },
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          lang: user.lang,
          trekTipCount: user.trekTipCount,
          username: user.username,
          points: user.points,
          quizUnlocked: user.quizUnlocked,
          photoUrl: user.photoUrl,
          bio: user.bio,
        },
      });
    } catch (error: any) {
      console.error('Sync error:', error);
      res.status(500).json({ error: 'Sync failed' });
    }
  });

  return router;
}
