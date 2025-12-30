/**
 * Supabase JWT Authentication Middleware
 * Verifies JWT tokens from the Authorization header
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from '../types/index.js';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

interface SupabaseJWTPayload {
  sub: string;
  email?: string;
  aud: string;
  exp: number;
  iat: number;
  role?: string;
}

/**
 * Middleware to verify Supabase JWT tokens
 */
export function authenticateToken(
  req: Request & AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide a valid Bearer token in the Authorization header',
    });
    return;
  }

  if (!SUPABASE_JWT_SECRET) {
    console.error('SUPABASE_JWT_SECRET not configured');
    res.status(500).json({
      error: 'Server configuration error',
      message: 'Authentication is not properly configured',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as SupabaseJWTPayload;

    // Verify token hasn't expired
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please sign in again.',
      });
      return;
    }

    // Attach user info to request
    req.userId = decoded.sub;
    req.userEmail = decoded.email;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or malformed',
      });
      return;
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred while verifying your credentials',
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export function optionalAuth(
  req: Request & AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || !SUPABASE_JWT_SECRET) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as SupabaseJWTPayload;
    req.userId = decoded.sub;
    req.userEmail = decoded.email;
  } catch {
    // Silently ignore invalid tokens for optional auth
  }

  next();
}
