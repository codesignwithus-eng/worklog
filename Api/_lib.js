import { Redis } from '@upstash/redis';

// Initialize Upstash Redis connection from environment variables
export const redis = Redis.fromEnv();

// Helper to verify app password authorization
export function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  const appPassword = process.env.APP_PASSWORD;

  // If no password is set in env, allow access by default
  if (!appPassword) return true;

  if (!authHeader || authHeader !== `Bearer ${appPassword}`) {
    return false;
  }
  return true;
}

// Standard error response helper
export function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}
