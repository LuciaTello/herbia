// index.ts: Application entry point (like Application.java + @Configuration in Spring Boot)
// Only does setup and wiring - no business logic here!

import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { plantRouter } from './routes/plant.routes';
import { collectionRouter } from './routes/collection.routes';
import { initPlantService } from './services/plant.service';

// Load .env file (like Spring's application.properties)
// MUST be called before anything that uses process.env!
dotenv.config();

// Initialize services that depend on env vars (like @PostConstruct in Spring)
initPlantService(process.env['GEMINI_API_KEY'] || '');

// --- Infrastructure setup (like @Bean definitions in Spring) ---

const app = express();
const port = process.env['PORT'] || 3000;

// Prisma + PostgreSQL (like DataSource + EntityManager)
const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
const prisma = new PrismaClient({ adapter });

// --- Middleware (like Spring filters) ---

app.use(cors());
app.use(express.json());

// --- Route registration (like @ComponentScan finding your @RestControllers) ---
// app.use('/prefix', router) mounts a router at a path prefix
// So plantRouter's '/suggest' becomes '/api/plants/suggest'

app.use('/api/plants', plantRouter);
app.use('/api/collection', collectionRouter(prisma)); // We inject prisma here!

// --- Serve Angular frontend in production ---
// In dev, Angular CLI serves the frontend (ng serve + proxy)
// In prod, Express serves the compiled Angular files directly
const angularDist = path.join(__dirname, '../../dist/untitled/browser');
app.use(express.static(angularDist));

// For any route not starting with /api, serve Angular's index.html
// This lets Angular Router handle client-side routing (like /route, /collection)
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(angularDist, 'index.html'));
});

// --- Start server (like SpringApplication.run()) ---

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
