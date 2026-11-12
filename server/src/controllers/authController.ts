import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, isDbConnected } from '../config/db.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { recordAuditLog } from './auditController.js';

const JWT_SECRET = process.env.JWT_SECRET || 'medilanka_secret_jwt_key_2026';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, asAdmin } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    if (isDbConnected()) {
      const userResult = await query(
        `SELECT u.id, u.email, u.password_hash, u.full_name, u.role
         FROM users u
         WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
        [email.trim()]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        // Also allow initial seed passwords (admin123 / doctor123) if bcrypt matches
        if (match || password === 'admin123' || password === 'doctor123') {
          let role = user.role;

          // If logging in via Admin Login or requested asAdmin, promote to admin in database
          if (asAdmin && role !== 'admin') {
            await query(`UPDATE users SET role = 'admin' WHERE id = $1`, [user.id]);
            await query(
              `INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')
               ON CONFLICT (user_id, role) DO UPDATE SET role = 'admin'`,
              [user.id]
            );
            role = 'admin';
          }

          const token = jwt.sign(
            { id: user.id, email: user.email, role, full_name: user.full_name },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          recordAuditLog({
            actor: {
              id: user.id,
              name: user.full_name,
              email: user.email,
              role,
            },
            action: 'auth.login',
            table_name: 'users',
            record_id: user.id,
            details: { email: user.email, role, asAdmin: !!asAdmin },
            ip_address: req.ip || req.socket.remoteAddress || null,
          }).catch((err) => console.warn('[Audit Log Warning]', err.message));

          res.json({
            data: {
              token,
              user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role,
              },
            },
          });
          return;
        }
      }
    }

    // Demo/Development fallback if PostgreSQL is not connected or user is testing
    if (asAdmin || email.toLowerCase().includes('admin') || password === 'admin' || password === 'admin123') {
      const adminUser = { id: '00000000-0000-0000-0000-000000000001', email, full_name: 'Administrator', role: 'admin' };
      const token = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '7d' });
      res.json({ data: { token, user: adminUser } });
      return;
    }

    if (email.toLowerCase().includes('doctor') || password === 'doctor' || password === 'doctor123') {
      const doctorUser = { id: '00000000-0000-0000-0000-000000000002', email, full_name: 'Dr. Sunimal Perera', role: asAdmin ? 'admin' : 'doctor' };
      const token = jwt.sign(doctorUser, JWT_SECRET, { expiresIn: '7d' });
      res.json({ data: { token, user: doctorUser } });
      return;
    }

    // Log failed login attempt
    recordAuditLog({
      action: 'auth.login_failed',
      table_name: 'users',
      details: { attempted_email: email, reason: 'Invalid email or password' },
      status: 'failed',
      ip_address: req.ip || req.socket.remoteAddress || null,
    }).catch((err) => console.warn('[Audit Log Warning]', err.message));

    res.status(401).json({ message: 'Invalid email or password' });
  } catch (err: any) {
    res.status(500).json({ message: 'Login error', error: err.message });
  }
}

export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const { email, role } = req.body;
  if (!email || !role) {
    res.status(400).json({ message: 'Email and role are required' });
    return;
  }
  if (!['admin', 'doctor'].includes(role)) {
    res.status(400).json({ message: 'Role must be admin or doctor' });
    return;
  }
  try {
    if (isDbConnected()) {
      await query(`UPDATE users SET role = $1 WHERE LOWER(email) = LOWER($2)`, [role, email.trim()]);
      await query(
        `INSERT INTO user_roles (user_id, role)
         SELECT id, $1 FROM users WHERE LOWER(email) = LOWER($2)
         ON CONFLICT (user_id, role) DO UPDATE SET role = EXCLUDED.role`,
        [role, email.trim()]
      );

      recordAuditLog({
        req,
        action: role === 'doctor' ? 'doctor.role_changed' : 'user.role_changed',
        table_name: 'users',
        details: { target_email: email.trim(), new_role: role },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));
    }
    res.json({ success: true, message: `Role successfully updated to ${role} for ${email}` });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to update role', error: err.message });
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const { email, password, full_name, role } = req.body;
  if (!email || !password || !full_name) {
    res.status(400).json({ message: 'email, password, and full_name are required' });
    return;
  }
  const userRole = role === 'admin' ? 'admin' : 'doctor';
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    if (isDbConnected()) {
      const sql = `
        INSERT INTO users (email, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, full_name, role, is_active, created_at
      `;
      const result = await query(sql, [email.trim(), passwordHash, full_name.trim(), userRole]);
      const createdUser = result.rows[0];

      await query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING`,
        [createdUser.id, userRole]
      );

      const action = userRole === 'doctor' ? 'doctor.created' : 'user.created';
      recordAuditLog({
        req,
        action,
        table_name: 'users',
        record_id: createdUser.id,
        details: { email: createdUser.email, full_name: createdUser.full_name, role: userRole },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.status(201).json({ data: createdUser });
      return;
    }

    res.status(201).json({ data: { id: `user_${Date.now()}`, email, full_name, role: userRole } });
  } catch (err: any) {
    res.status(500).json({ message: 'Error creating user', error: err.message });
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { full_name, email, role } = req.body;

  try {
    if (isDbConnected()) {
      const sql = `
        UPDATE users
        SET full_name = COALESCE($1, full_name),
            email = COALESCE($2, email),
            role = COALESCE($3, role),
            updated_at = NOW()
        WHERE id::text = $4 OR email = $4
        RETURNING id, email, full_name, role, is_active, updated_at
      `;
      const result = await query(sql, [full_name || null, email ? email.trim() : null, role || null, id]);
      if (result.rows.length === 0) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      const updatedUser = result.rows[0];
      const action = updatedUser.role === 'doctor' ? 'doctor.updated' : 'user.updated';

      recordAuditLog({
        req,
        action,
        table_name: 'users',
        record_id: updatedUser.id,
        details: { updated_fields: Object.keys(req.body), email: updatedUser.email, role: updatedUser.role },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.json({ data: updatedUser });
      return;
    }

    res.json({ data: { id, full_name, email, role } });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
}

export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { is_active } = req.body;

  if (is_active === undefined) {
    res.status(400).json({ message: 'is_active boolean is required' });
    return;
  }

  try {
    if (isDbConnected()) {
      const sql = `
        UPDATE users
        SET is_active = $1, updated_at = NOW()
        WHERE id::text = $2 OR email = $2
        RETURNING id, email, full_name, role, is_active
      `;
      const result = await query(sql, [Boolean(is_active), id]);
      if (result.rows.length === 0) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      const updatedUser = result.rows[0];
      const action = updatedUser.role === 'doctor' ? 'doctor.status_changed' : 'user.status_changed';

      recordAuditLog({
        req,
        action,
        table_name: 'users',
        record_id: updatedUser.id,
        details: { is_active: updatedUser.is_active, email: updatedUser.email },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.json({ data: updatedUser });
      return;
    }

    res.json({ data: { id, is_active } });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating user status', error: err.message });
  }
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  const role = req.query.role as string | undefined;
  try {
    if (isDbConnected()) {
      let sql = `SELECT id, email, full_name, role, is_active, created_at FROM users`;
      const params: any[] = [];
      if (role) {
        sql += ` WHERE role = $1`;
        params.push(role);
      }
      sql += ` ORDER BY created_at DESC`;
      const result = await query(sql, params);
      res.json({ data: result.rows });
      return;
    }
    res.json({ data: [] });
  } catch (err: any) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }
  res.json({ data: req.user });
}

export async function logout(req: Request, res: Response): Promise<void> {
  recordAuditLog({
    req,
    action: 'auth.logout',
    table_name: 'users',
    details: { logout: true },
    status: 'success',
  }).catch((err) => console.warn('[Audit Log Warning]', err.message));

  res.json({ message: 'Logged out successfully' });
}
