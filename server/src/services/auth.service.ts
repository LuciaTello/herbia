// AuthService: like @Service AuthService in Spring
// Handles password hashing (bcrypt) and JWT token creation/verification
//
// Java equivalents:
// - bcrypt.hash()    = BCryptPasswordEncoder.encode()
// - bcrypt.compare() = BCryptPasswordEncoder.matches()
// - jwt.sign()       = Jwts.builder().setSubject(userId).signWith(key).compact()
// - jwt.verify()     = Jwts.parserBuilder().build().parseClaimsJws(token)

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { PrismaClient } from '../generated/prisma/client';

// --- Types ---

// What the JWT contains (like Claims in Java's JJWT)
interface TokenPayload {
  userId: number;
}

// What register/login return to the caller (like a LoginResponseDto)
export interface AuthResult {
  token: string;
  user: { id: number; email: string; lang: string; hasSeenMissionTip: boolean };
}

// --- Constants ---

// bcrypt cost factor: how many rounds of hashing (like BCryptPasswordEncoder strength)
// 10 = ~100ms per hash, good balance between security and speed
const SALT_ROUNDS = 10;

// --- Public functions (exported = public) ---

export async function registerUser(
  prisma: PrismaClient,
  email: string,
  password: string,
  lang: string = 'es',
): Promise<AuthResult> {
  // Check if email already exists (like repository.findByEmail())
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('Email already registered');
  }

  // Hash the password (like passwordEncoder.encode(rawPassword))
  // bcrypt generates a random salt internally - you don't manage it yourself
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Save user (like repository.save(new User(email, passwordHash)))
  const user = await prisma.user.create({
    data: { email, passwordHash, lang },
  });

  // Generate JWT token
  const token = generateToken(user.id);

  return { token, user: { id: user.id, email: user.email, lang: user.lang, hasSeenMissionTip: user.hasSeenMissionTip } };
}

export async function loginUser(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<AuthResult> {
  // Find user by email (like userDetailsService.loadUserByUsername(email))
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Security: don't reveal whether the email exists or the password is wrong
    // Same "vague error" pattern as Spring Security
    throw new Error('Invalid email or password');
  }

  // Verify password (like passwordEncoder.matches(rawPassword, encodedPassword))
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const token = generateToken(user.id);
  return { token, user: { id: user.id, email: user.email, lang: user.lang, hasSeenMissionTip: user.hasSeenMissionTip } };
}

export async function checkEmailExists(
  prisma: PrismaClient,
  email: string,
): Promise<{ exists: boolean; lang?: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { exists: false };
  return { exists: true, lang: user.lang };
}

// Verify a JWT and return the userId inside it
// Used by the auth middleware (like JwtTokenProvider.validateToken() in Spring)
export function verifyToken(token: string): number {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET not configured');

  const payload = jwt.verify(token, secret) as TokenPayload;
  return payload.userId;
}

// --- Private helpers (not exported = private to this module) ---

function generateToken(userId: number): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET not configured');

  // Like Jwts.builder()
  //   .setSubject(String.valueOf(userId))
  //   .setExpiration(Date.from(Instant.now().plus(7, DAYS)))
  //   .signWith(key, SignatureAlgorithm.HS256)
  //   .compact()
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}
