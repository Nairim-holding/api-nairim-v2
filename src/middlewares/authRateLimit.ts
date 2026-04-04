// src/middlewares/authRateLimit.ts
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/api-response';

interface FailedAttempt {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  blockedUntil?: number;
}

// Store for tracking failed attempts (in production, consider using Redis)
const failedAttempts = new Map<string, FailedAttempt>();

// Constants - hardcoded as requested
const MAX_ATTEMPTS = 3;
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, attempt] of failedAttempts.entries()) {
    if (attempt.blockedUntil && attempt.blockedUntil < now) {
      // Unblock if block duration has passed
      delete attempt.blockedUntil;
      attempt.count = 0;
    }
    
    // Remove entries older than 1 hour
    if (now - attempt.lastAttempt > 60 * 60 * 1000) {
      failedAttempts.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

export const authRateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const email = req.body.email?.toLowerCase().trim();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `${email}:${ip}`;

  // Skip if no email provided
  if (!email) {
    return next();
  }

  const now = Date.now();
  const attempt = failedAttempts.get(key);

  // Check if user is currently blocked
  if (attempt?.blockedUntil && attempt.blockedUntil > now) {
    const remainingTime = Math.ceil((attempt.blockedUntil - now) / 1000);
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    
    return res.status(429).json(
      ApiResponse.error(
        `Muitas tentativas de login falharam. Tente novamente em ${minutes}m ${seconds}s.`
      )
    );
  }

  // Add helper function to request body to track failed attempts
  (req as any).trackFailedLogin = () => {
    const current = failedAttempts.get(key) || {
      count: 0,
      firstAttempt: now,
      lastAttempt: now
    };

    current.count++;
    current.lastAttempt = now;

    // Block user if max attempts reached
    if (current.count >= MAX_ATTEMPTS) {
      current.blockedUntil = now + BLOCK_DURATION_MS;
      
      console.log(`🚫 User ${email} from IP ${ip} blocked for 5 minutes after ${current.count} failed attempts`);
    }

    failedAttempts.set(key, current);

    console.log(`❌ Failed login attempt ${current.count}/${MAX_ATTEMPTS} for ${email} from IP ${ip}`);
  };

  // Add helper function to reset on successful login
  (req as any).resetFailedLogin = () => {
    failedAttempts.delete(key);
    console.log(`✅ Login successful for ${email} - failed attempts reset`);
  };

  next();
};

// Export function to check current status (useful for testing)
export const getAuthRateLimitStatus = (email: string, ip: string) => {
  const key = `${email.toLowerCase()}:${ip}`;
  const attempt = failedAttempts.get(key);
  
  if (!attempt) {
    return { attempts: 0, blocked: false, remainingTime: null };
  }

  const now = Date.now();
  const isBlocked = attempt.blockedUntil && attempt.blockedUntil > now;
  
  return {
    attempts: attempt.count,
    blocked: isBlocked,
    remainingTime: isBlocked ? Math.ceil((attempt.blockedUntil! - now) / 1000) : null,
    maxAttempts: MAX_ATTEMPTS
  };
};
