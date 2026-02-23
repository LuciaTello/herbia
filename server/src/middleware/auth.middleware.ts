// AuthMiddleware: like a JwtAuthenticationFilter (OncePerRequestFilter) in Spring Security
// Intercepts every request to protected routes, reads the JWT from the Authorization header,
// verifies it, and attaches the userId to the request object.
//
// In Spring Security, this would be registered with:
//   http.addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
//
// In Express, we register it per route group:
//   app.use('/api/collection', authMiddleware, collectionRouter(prisma))

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';

// Extend Express Request to include userId
// In Spring, you'd use SecurityContextHolder.getContext().getAuthentication().getPrincipal()
// Here we just add a property to the request object (simpler!)
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

// This function IS the middleware (like doFilterInternal() in OncePerRequestFilter)
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Read the Authorization header
  // Format: "Bearer eyJhbGciOiJIUzI1NiIsInR..." (same format as Spring Security expects)
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  // Extract the token after "Bearer "
  const token = header.split(' ')[1];

  try {
    // Verify and decode the JWT (like JwtTokenProvider.validateToken())
    const userId = verifyToken(token);

    // Attach userId to request (like setting Authentication in SecurityContext)
    req.userId = userId;

    // Continue to the next middleware/route handler (like filterChain.doFilter())
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
