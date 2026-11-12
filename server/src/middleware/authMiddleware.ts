import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query, isDbConnected } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'medilanka_secret_jwt_key_2026';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  full_name?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface VerifiedActor {
  id: string | null;
  name: string;
  email: string;
  role: string;
}

export async function resolveActorFromRequest(req: Request): Promise<VerifiedActor | null> {
  let user: any = (req as AuthenticatedRequest).user;

  if (!user && req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    try {
      user = jwt.verify(token, JWT_SECRET) as any;
    } catch {
      user = null;
    }
  }

  if (user && user.id) {
    let fullName = user.full_name;
    let email = user.email || '';
    let role = user.role || 'user';

    // Verify against DB for the most authoritative user profile
    if (isDbConnected()) {
      try {
        const uRes = await query('SELECT full_name, email, role FROM users WHERE id = $1', [user.id]);
        if (uRes.rows.length > 0) {
          fullName = uRes.rows[0].full_name || fullName;
          email = uRes.rows[0].email || email;
          role = uRes.rows[0].role || role;
        }
      } catch {
        // Fallback to token decoded fields
      }
    }

    return {
      id: user.id,
      name: fullName || email || 'Authenticated User',
      email,
      role,
    };
  }

  return null;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session token' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
      return;
    }
    next();
  };
}
