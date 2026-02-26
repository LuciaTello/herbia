// index.ts: Application entry point (like Application.java + @Configuration in Spring Boot)
// Only does setup and wiring - no business logic here!

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { plantRouter } from './routes/plant.routes';
import { collectionRouter } from './routes/collection.routes';
import { trekRouter } from './routes/trek.routes';
import { authRouter } from './routes/auth.routes';
import { configRouter } from './routes/config.routes';
import { authMiddleware } from './middleware/auth.middleware';
import { initPlantService } from './services/plant.service';

// Load .env file (like Spring's application.properties)
// MUST be called before anything that uses process.env!
dotenv.config();

// Initialize services that depend on env vars (like @PostConstruct in Spring)
initPlantService(process.env['GROQ_API_KEY'] || '');

// --- Infrastructure setup (like @Bean definitions in Spring) ---

const app = express();
const port = process.env['PORT'] || 3000;

// Prisma + PostgreSQL (like DataSource + EntityManager)
const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
const prisma = new PrismaClient({ adapter });

// --- Middleware (like Spring filters) ---

// CORS: allow the frontend (Cloudflare Pages) to call this backend (Render)
// In Spring this would be @CrossOrigin or a CorsFilter
app.use(cors({
  origin: process.env['FRONTEND_URL'] || 'http://localhost:4200',
}));
app.use(express.json());

// --- Route registration (like @ComponentScan finding your @RestControllers) ---
// Think of this as Spring Security's SecurityFilterChain:
//   .requestMatchers("/api/auth/**").permitAll()
//   .requestMatchers("/api/**").authenticated()

// Public routes (like .permitAll() - no token needed)
app.use('/api/auth', authRouter(prisma));
app.use('/api/config', configRouter(prisma));

// Protected routes (like .authenticated() - authMiddleware checks JWT first)
// If JWT is invalid, authMiddleware returns 401 and the route handler never runs
app.use('/api/plants', authMiddleware, plantRouter(prisma));
app.use('/api/collection', authMiddleware, collectionRouter(prisma));
app.use('/api/treks', authMiddleware, trekRouter(prisma));

// --- Start server (like SpringApplication.run()) ---

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
