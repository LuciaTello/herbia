// AuthRoutes: like a @RestController for authentication in Spring
// POST /api/auth/register and POST /api/auth/login
//
// Same factory function pattern as collectionRouter:
// receives prisma as parameter (like constructor injection with @Autowired)

import { Router } from 'express';
import type { PrismaClient } from '../generated/prisma/client';
import { registerUser, loginUser, checkEmailExists } from '../services/auth.service';

export function authRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/auth/check-email - check if an email is already registered
  router.post('/check-email', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }
      const result = await checkEmailExists(prisma, email);
      res.json(result);
    } catch (error: any) {
      console.error('Check email error:', error);
      res.status(500).json({ error: 'Check email failed' });
    }
  });

  // POST /api/auth/register - like @PostMapping("/register")
  router.post('/register', async (req, res) => {
    try {
      const { email, password, lang } = req.body;

      // Basic validation (in Spring you'd use @Valid + @RequestBody RegisterDto)
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      const result = await registerUser(prisma, email, password, lang);
      res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'Email already registered') {
        // 409 Conflict = the resource (email) already exists
        res.status(409).json({ error: error.message });
      } else {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
      }
    }
  });

  // POST /api/auth/login - like @PostMapping("/login")
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const result = await loginUser(prisma, email, password);
      res.json(result);
    } catch (error: any) {
      if (error.message === 'Invalid email or password') {
        res.status(401).json({ error: error.message });
      } else {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
      }
    }
  });

  return router;
}
