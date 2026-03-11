// AuthMiddleware: verifies the Clerk session token and looks up the user in our DB
// Attaches req.userId (our internal DB id) for all downstream route handlers.

import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import type { PrismaClient } from '../generated/prisma/client';

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export function authMiddleware(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { userId: clerkId } = getAuth(req);

    if (!clerkId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Attach our internal userId — all route handlers use this, unchanged
    req.userId = user.id;
    next();
  };
}
