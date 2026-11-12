import type { Request, Response } from 'express';
import { query, isDbConnected } from '../config/db.js';
import { resolveActorFromRequest } from '../middleware/authMiddleware.js';

interface InMemoryAuditLog {
  id: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  user_role: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}

const memoryLogs: InMemoryAuditLog[] = [];

export interface AuditLogOptions {
  req?: Request;
  actor?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  action: string;
  table_name?: string | null;
  record_id?: string | null;
  details?: any;
  status?: 'success' | 'failed' | string;
  ip_address?: string | null;
}

/**
 * Universal backend helper to record immutable audit logs with verified server-side actor context.
 */
export async function recordAuditLog(options: AuditLogOptions): Promise<any> {
  const { req, action, table_name, record_id, details } = options;
  const status = options.status || 'success';
  const ip = options.ip_address || (req ? (req.ip || req.socket.remoteAddress || null) : null);

  let userId: string | null = null;
  let userName = 'Unknown User';
  let userEmail: string | null = null;
  let userRole = 'unknown';

  // 1. First priority: Server-side verified actor from request JWT / session
  if (req) {
    const verifiedActor = await resolveActorFromRequest(req);
    if (verifiedActor) {
      userId = verifiedActor.id;
      userName = verifiedActor.name;
      userEmail = verifiedActor.email;
      userRole = verifiedActor.role;
    }
  }

  // 2. Second priority: Explicit server-side actor passed by internal controller (e.g. patient intake/payment)
  if (userName === 'Unknown User' && options.actor) {
    if (options.actor.id) userId = options.actor.id;
    if (options.actor.name) userName = options.actor.name;
    if (options.actor.email) userEmail = options.actor.email;
    if (options.actor.role) userRole = options.actor.role;
  }

  if (isDbConnected()) {
    try {
      const sql = `
        INSERT INTO audit_logs (user_id, user_name, user_email, user_role, action, table_name, record_id, details, ip_address, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      const result = await query(sql, [
        userId,
        userName,
        userEmail,
        userRole,
        action,
        table_name || null,
        record_id ? String(record_id) : null,
        details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
        ip,
        status,
      ]);
      return result.rows[0];
    } catch (err: any) {
      console.error('[AuditLog Error]', err.message);
    }
  }

  // In-memory fallback
  const fallbackLog: InMemoryAuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId,
    user_name: userName,
    user_email: userEmail,
    user_role: userRole,
    action,
    table_name: table_name || null,
    record_id: record_id ? String(record_id) : null,
    details: details || null,
    ip_address: ip,
    created_at: new Date().toISOString(),
  };
  memoryLogs.unshift(fallbackLog);
  return fallbackLog;
}

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  const {
    q, search,
    user, actor,
    role, user_role,
    module, table, table_name,
    action,
    status,
    startDate, from,
    endDate, to,
    sort,
    page,
    limit
  } = req.query as Record<string, string | undefined>;

  const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
  const pageLimit = Math.min(200, Math.max(1, parseInt(limit || '50', 10) || 50));
  const offset = (pageNum - 1) * pageLimit;
  const isAsc = sort === 'asc';

  try {
    if (isDbConnected()) {
      const conditions: string[] = [];
      const params: any[] = [];
      let pIdx = 1;

      // Module / Table filter
      const targetTable = module || table || table_name;
      if (targetTable && targetTable !== 'all') {
        conditions.push(`table_name ILIKE $${pIdx}`);
        params.push(targetTable.trim());
        pIdx++;
      }

      // Role filter
      const targetRole = role || user_role;
      if (targetRole && targetRole !== 'all') {
        conditions.push(`user_role ILIKE $${pIdx}`);
        params.push(targetRole.trim());
        pIdx++;
      }

      // Action filter
      if (action && action !== 'all') {
        conditions.push(`action ILIKE $${pIdx}`);
        params.push(`%${action.trim()}%`);
        pIdx++;
      }

      // Status filter
      if (status && status !== 'all') {
        conditions.push(`status ILIKE $${pIdx}`);
        params.push(status.trim());
        pIdx++;
      }

      // Actor filter (name or email)
      const targetActor = user || actor;
      if (targetActor) {
        conditions.push(`(user_name ILIKE $${pIdx} OR user_email ILIKE $${pIdx})`);
        params.push(`%${targetActor.trim()}%`);
        pIdx++;
      }

      // Date Range filters
      const start = startDate || from;
      if (start) {
        conditions.push(`created_at >= $${pIdx}::timestamptz`);
        params.push(start);
        pIdx++;
      }

      const end = endDate || to;
      if (end) {
        conditions.push(`created_at <= $${pIdx}::timestamptz`);
        params.push(end);
        pIdx++;
      }

      // Free text search
      const searchQuery = q || search;
      if (searchQuery && searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        conditions.push(`(
          user_name ILIKE $${pIdx} OR 
          user_email ILIKE $${pIdx} OR 
          user_role ILIKE $${pIdx} OR 
          action ILIKE $${pIdx} OR 
          table_name ILIKE $${pIdx} OR 
          details::text ILIKE $${pIdx}
        )`);
        params.push(term);
        pIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countSql = `
        WITH enriched_logs AS (
          SELECT 
            a.id,
            a.user_id,
            COALESCE(NULLIF(a.user_name, ''), u.full_name, p.full_name, a.details->>'user_name', a.details->>'cardholder_name', 'Unknown User') as user_name,
            COALESCE(NULLIF(a.user_email, ''), u.email, p.email, a.details->>'user_email', '') as user_email,
            COALESCE(NULLIF(a.user_role, ''), u.role::text, a.details->>'user_role', CASE WHEN a.action LIKE 'payment.%' THEN 'patient' WHEN a.user_id IS NOT NULL THEN 'user' ELSE 'unknown' END) as user_role,
            a.action,
            a.table_name,
            a.record_id,
            a.details,
            a.ip_address,
            COALESCE(a.status, 'success') as status,
            a.created_at
          FROM audit_logs a
          LEFT JOIN users u ON u.id = a.user_id
          LEFT JOIN payments pay ON pay.id::text = a.record_id AND a.table_name = 'payments'
          LEFT JOIN consultations c ON c.id = pay.consultation_id
          LEFT JOIN patients p ON p.id = c.patient_id
        )
        SELECT COUNT(*) as total FROM enriched_logs ${whereClause}
      `;

      const countRes = await query(countSql, params);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataSql = `
        WITH enriched_logs AS (
          SELECT 
            a.id,
            a.user_id,
            COALESCE(NULLIF(a.user_name, ''), u.full_name, p.full_name, a.details->>'user_name', a.details->>'cardholder_name', 'Unknown User') as user_name,
            COALESCE(NULLIF(a.user_email, ''), u.email, p.email, a.details->>'user_email', '') as user_email,
            COALESCE(NULLIF(a.user_role, ''), u.role::text, a.details->>'user_role', CASE WHEN a.action LIKE 'payment.%' THEN 'patient' WHEN a.user_id IS NOT NULL THEN 'user' ELSE 'unknown' END) as user_role,
            a.action,
            a.table_name,
            a.record_id,
            a.details,
            a.ip_address,
            COALESCE(a.status, 'success') as status,
            a.created_at
          FROM audit_logs a
          LEFT JOIN users u ON u.id = a.user_id
          LEFT JOIN payments pay ON pay.id::text = a.record_id AND a.table_name = 'payments'
          LEFT JOIN consultations c ON c.id = pay.consultation_id
          LEFT JOIN patients p ON p.id = c.patient_id
        )
        SELECT * FROM enriched_logs
        ${whereClause}
        ORDER BY created_at ${isAsc ? 'ASC' : 'DESC'}
        LIMIT $${pIdx} OFFSET $${pIdx + 1}
      `;

      params.push(pageLimit, offset);
      const result = await query(dataSql, params);

      res.json({
        data: result.rows,
        total,
        page: pageNum,
        limit: pageLimit,
        totalPages: Math.max(1, Math.ceil(total / pageLimit)),
      });
      return;
    }

    res.json({
      data: memoryLogs,
      total: memoryLogs.length,
      page: pageNum,
      limit: pageLimit,
      totalPages: 1,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving audit logs', error: err.message });
  }
}

export async function createAuditLog(req: Request, res: Response): Promise<void> {
  const { action, table_name, record_id, details } = req.body;

  if (!action) {
    res.status(400).json({ message: 'Action is required' });
    return;
  }

  try {
    // If request does not have verified JWT, only permit non-admin client identities or mark unknown
    const unverifiedActor = {
      id: null,
      name: typeof req.body.user_name === 'string' ? req.body.user_name.trim() : undefined,
      email: typeof req.body.user_email === 'string' ? req.body.user_email.trim() : undefined,
      role: req.body.user_role === 'patient' ? 'patient' : 'unknown',
    };

    const savedLog = await recordAuditLog({
      req,
      actor: unverifiedActor,
      action,
      table_name,
      record_id,
      details,
      status: req.body.status || 'success',
    });

    res.status(201).json({ data: savedLog });
  } catch (err: any) {
    res.status(500).json({ message: 'Error creating audit log', error: err.message });
  }
}
