import type { Request, Response } from 'express';
import { query, isDbConnected } from '../config/db.js';
import { memoryConsultations } from './consultationController.js';

function getDateFilterClause(columnName: string, range: string): { sql: string; params: any[] } {
  switch (range) {
    case '7d':
      return { sql: `${columnName} >= NOW() - INTERVAL '7 days'`, params: [] };
    case '30d':
      return { sql: `${columnName} >= NOW() - INTERVAL '30 days'`, params: [] };
    case 'month':
      return { sql: `${columnName} >= DATE_TRUNC('month', NOW())`, params: [] };
    case 'year':
      return { sql: `${columnName} >= DATE_TRUNC('year', NOW())`, params: [] };
    case 'all':
    default:
      return { sql: '1=1', params: [] };
  }
}

/**
 * GET /api/reports/doctor
 * Complete Consultation & Clinical Analytics Dashboard.
 */
export async function getDoctorStats(req: Request, res: Response): Promise<void> {
  const range = typeof req.query.range === 'string' ? req.query.range : 'all';

  try {
    if (isDbConnected()) {
      const dateFilter = getDateFilterClause('c.created_at', range);

      // 1. Overview metrics
      const overviewRes = await query(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE c.status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE c.status = 'pending')::int as pending,
          COUNT(*) FILTER (WHERE c.status = 'cancelled')::int as cancelled,
          COUNT(*) FILTER (WHERE c.status = 'paid')::int as paid,
          COUNT(*) FILTER (WHERE c.status = 'in_progress')::int as in_progress
        FROM consultations c
        WHERE ${dateFilter.sql}
      `);
      const overview = overviewRes.rows[0] || {
        total: 0,
        completed: 0,
        pending: 0,
        cancelled: 0,
        paid: 0,
        in_progress: 0,
      };

      // 2. Status distribution
      const statusRes = await query(`
        SELECT c.status, COUNT(*)::int as count
        FROM consultations c
        WHERE ${dateFilter.sql}
        GROUP BY c.status
        ORDER BY count DESC
      `);
      const statusColors: Record<string, string> = {
        completed: '#10b981', // green
        paid: '#3b82f6',      // blue
        pending: '#f59e0b',   // amber
        in_progress: '#8b5cf6', // purple
        cancelled: '#ef4444', // red
        referred: '#6366f1',  // indigo
      };
      const statusDistribution = statusRes.rows.map((row) => ({
        name: row.status.charAt(0).toUpperCase() + row.status.slice(1).replace('_', ' '),
        value: row.count,
        status: row.status,
        fill: statusColors[row.status] || '#94a3b8',
      }));

      // 3. Consultation type breakdown (Online vs Standard vs Priority)
      const typeRes = await query(`
        SELECT 
          ct.display_name as type,
          COUNT(c.id)::int as count
        FROM consultations c
        JOIN consultation_types ct ON ct.id = c.consultation_type_id
        WHERE ${dateFilter.sql}
        GROUP BY ct.display_name
        ORDER BY count DESC
      `);
      const totalTypeCounts = typeRes.rows.reduce((acc, r) => acc + r.count, 0);
      const typeBreakdown = typeRes.rows.map((r) => ({
        type: r.type,
        count: r.count,
        percentage: totalTypeCounts > 0 ? Math.round((r.count / totalTypeCounts) * 100) : 0,
      }));

      // 4. Consultation trends (Daily, Weekly, Monthly)
      const dailyTrendsRes = await query(`
        SELECT 
          TO_CHAR(c.created_at, 'YYYY-MM-DD') as date,
          TO_CHAR(c.created_at, 'Mon DD') as label,
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE c.status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE c.status = 'cancelled')::int as cancelled,
          COUNT(*) FILTER (WHERE c.status IN ('paid', 'in_progress'))::int as active
        FROM consultations c
        WHERE ${dateFilter.sql}
        GROUP BY TO_CHAR(c.created_at, 'YYYY-MM-DD'), TO_CHAR(c.created_at, 'Mon DD')
        ORDER BY date ASC
      `);

      const monthlyTrendsRes = await query(`
        SELECT 
          TO_CHAR(c.created_at, 'YYYY-MM') as month,
          TO_CHAR(c.created_at, 'Mon YYYY') as label,
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE c.status = 'completed')::int as completed,
          COUNT(*) FILTER (WHERE c.status = 'cancelled')::int as cancelled
        FROM consultations c
        GROUP BY TO_CHAR(c.created_at, 'YYYY-MM'), TO_CHAR(c.created_at, 'Mon YYYY')
        ORDER BY month ASC
      `);

      // 5. Patient Analytics
      const patientDateFilter = getDateFilterClause('created_at', range);
      const patientStatsRes = await query(`
        SELECT 
          COUNT(*)::int as total_patients,
          COUNT(*) FILTER (WHERE ${patientDateFilter.sql})::int as new_patients_period,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int as new_patients_7d,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int as new_patients_30d
        FROM patients
      `);
      const patientRegistrationTrendsRes = await query(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM-DD') as date,
          TO_CHAR(created_at, 'Mon DD') as label,
          COUNT(*)::int as count
        FROM patients
        WHERE ${patientDateFilter.sql}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD'), TO_CHAR(created_at, 'Mon DD')
        ORDER BY date ASC
      `);

      // 6. Doctor Analytics
      const doctorUsersRes = await query(`
        SELECT 
          u.id,
          u.full_name,
          u.email,
          u.role,
          (SELECT COUNT(*)::int FROM consultations WHERE status = 'completed') as consultations_completed,
          (SELECT COUNT(*)::int FROM consultations WHERE status IN ('paid', 'in_progress')) as consultations_in_queue
        FROM users u
        WHERE u.role IN ('doctor', 'admin')
        ORDER BY u.created_at ASC
      `);
      const totalDoctors = doctorUsersRes.rows.length;
      const activeDoctors = doctorUsersRes.rows.length;

      // 7. Recent Consultation Activity table
      const recentRes = await query(`
        SELECT 
          c.id,
          c.status,
          c.priority_score,
          c.created_at,
          c.started_at,
          c.completed_at,
          p.full_name as patient_name,
          p.email as patient_email,
          p.nationality,
          ct.display_name as consultation_type
        FROM consultations c
        JOIN patients p ON p.id = c.patient_id
        JOIN consultation_types ct ON ct.id = c.consultation_type_id
        WHERE ${dateFilter.sql}
        ORDER BY c.created_at DESC
        LIMIT 25
      `);

      res.json({
        data: {
          overview: {
            totalConsultations: overview.total,
            completedConsultations: overview.completed,
            pendingConsultations: overview.pending,
            cancelledConsultations: overview.cancelled,
            paidConsultations: overview.paid,
            inProgressConsultations: overview.in_progress,
          },
          statusDistribution,
          typeBreakdown,
          trends: {
            daily: dailyTrendsRes.rows,
            monthly: monthlyTrendsRes.rows,
          },
          patientAnalytics: {
            totalPatients: patientStatsRes.rows[0]?.total_patients || 0,
            newPatientsPeriod: patientStatsRes.rows[0]?.new_patients_period || 0,
            newPatients7d: patientStatsRes.rows[0]?.new_patients_7d || 0,
            newPatients30d: patientStatsRes.rows[0]?.new_patients_30d || 0,
            registrationTrends: patientRegistrationTrendsRes.rows,
          },
          doctorAnalytics: {
            totalDoctors,
            activeDoctors,
            doctors: doctorUsersRes.rows.map((d) => ({
              id: d.id,
              name: d.full_name,
              email: d.email,
              role: d.role,
              consultationsHandled: d.consultations_completed,
              inQueue: d.consultations_in_queue,
              status: 'Active',
            })),
          },
          recentActivity: recentRes.rows,
          filterRange: range,
        },
      });
      return;
    }

    // In-memory fallback
    const total = memoryConsultations.length;
    const completed = memoryConsultations.filter((c) => c.status === 'completed').length;
    const pending = memoryConsultations.filter((c) => c.status === 'pending').length;
    const cancelled = memoryConsultations.filter((c) => c.status === 'cancelled').length;

    res.json({
      data: {
        overview: {
          totalConsultations: total || 1,
          completedConsultations: completed,
          pendingConsultations: pending,
          cancelledConsultations: cancelled,
          paidConsultations: memoryConsultations.filter((c) => c.status === 'paid').length,
          inProgressConsultations: 0,
        },
        statusDistribution: [
          { name: 'Completed', value: completed, fill: '#10b981' },
          { name: 'Pending', value: pending, fill: '#f59e0b' },
          { name: 'Cancelled', value: cancelled, fill: '#ef4444' },
        ],
        typeBreakdown: [{ type: 'Standard Consultation', count: total || 1, percentage: 100 }],
        trends: { daily: [], monthly: [] },
        patientAnalytics: { totalPatients: 1, newPatientsPeriod: 1, newPatients7d: 1, newPatients30d: 1, registrationTrends: [] },
        doctorAnalytics: { totalDoctors: 1, activeDoctors: 1, doctors: [] },
        recentActivity: [],
        filterRange: range,
      },
    });
  } catch (err: any) {
    console.error('[Reports Doctor Error]', err);
    res.status(500).json({ message: 'Error generating clinical reports', error: err.message });
  }
}

/**
 * GET /api/reports/admin
 * Dedicated Financial Reports & Revenue Analytics Dashboard.
 */
export async function getAdminStats(req: Request, res: Response): Promise<void> {
  const range = typeof req.query.range === 'string' ? req.query.range : 'all';
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'all';
  const typeFilter = typeof req.query.type === 'string' ? req.query.type : 'all';

  try {
    if (isDbConnected()) {
      // 1. Build dynamic WHERE conditions for financial query
      const whereClauses: string[] = [];
      const queryParams: any[] = [];
      let pIdx = 1;

      // Date range filter
      if (range === '7d') {
        whereClauses.push(`p.created_at >= NOW() - INTERVAL '7 days'`);
      } else if (range === '30d') {
        whereClauses.push(`p.created_at >= NOW() - INTERVAL '30 days'`);
      } else if (range === 'month') {
        whereClauses.push(`p.created_at >= DATE_TRUNC('month', NOW())`);
      } else if (range === 'year') {
        whereClauses.push(`p.created_at >= DATE_TRUNC('year', NOW())`);
      }

      // Status filter
      if (statusFilter !== 'all') {
        whereClauses.push(`p.status = $${pIdx++}`);
        queryParams.push(statusFilter);
      }

      // Consultation Type filter
      if (typeFilter !== 'all') {
        whereClauses.push(`ct.name = $${pIdx++}`);
        queryParams.push(typeFilter);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // 2. Financial Overview & Payment Analytics (from payments table)
      // Strictly verified completed payments count toward revenue
      const overviewRes = await query(`
        SELECT 
          COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'completed'), 0)::bigint as total_revenue,
          COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'completed' AND p.created_at >= DATE_TRUNC('month', NOW())), 0)::bigint as monthly_revenue,
          COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'pending'), 0)::bigint as pending_amount,
          COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'refunded'), 0)::bigint as refunded_amount,
          COUNT(*) FILTER (WHERE p.status = 'completed')::int as successful_count,
          COUNT(*) FILTER (WHERE p.status = 'pending')::int as pending_count,
          COUNT(*) FILTER (WHERE p.status = 'failed')::int as failed_count,
          COUNT(*) FILTER (WHERE p.status = 'refunded')::int as refunded_count,
          COUNT(*)::int as total_transactions
        FROM payments p
        LEFT JOIN consultations c ON c.id = p.consultation_id
        LEFT JOIN consultation_types ct ON ct.id = c.consultation_type_id
        ${whereSql}
      `, queryParams);

      const overview = overviewRes.rows[0] || {
        total_revenue: '0',
        monthly_revenue: '0',
        pending_amount: '0',
        refunded_amount: '0',
        successful_count: 0,
        pending_count: 0,
        failed_count: 0,
        refunded_count: 0,
        total_transactions: 0,
      };

      // 3. Revenue by Consultation Type
      const revenueByTypeRes = await query(`
        SELECT 
          COALESCE(ct.display_name, 'Standard Consultation') as type,
          COALESCE(ct.name, 'standard') as type_key,
          SUM(p.amount_cents)::bigint as revenue,
          COUNT(p.id)::int as count
        FROM payments p
        LEFT JOIN consultations c ON c.id = p.consultation_id
        LEFT JOIN consultation_types ct ON ct.id = c.consultation_type_id
        WHERE p.status = 'completed'
        GROUP BY ct.display_name, ct.name
        ORDER BY revenue DESC
      `);
      const totalRev = Number(overview.total_revenue) || 1;
      const revenueByType = revenueByTypeRes.rows.map((r) => ({
        type: r.type,
        typeKey: r.type_key,
        revenue: Number(r.revenue),
        count: r.count,
        percentage: Math.round((Number(r.revenue) / totalRev) * 100),
      }));

      // 4. Revenue Trends: Daily, Monthly, Yearly
      const dailyRevenueRes = await query(`
        SELECT 
          TO_CHAR(p.created_at, 'YYYY-MM-DD') as date,
          TO_CHAR(p.created_at, 'Mon DD') as label,
          SUM(p.amount_cents)::bigint as revenue,
          COUNT(p.id)::int as count
        FROM payments p
        WHERE p.status = 'completed'
        GROUP BY TO_CHAR(p.created_at, 'YYYY-MM-DD'), TO_CHAR(p.created_at, 'Mon DD')
        ORDER BY date ASC
      `);

      const monthlyRevenueRes = await query(`
        SELECT 
          TO_CHAR(p.created_at, 'YYYY-MM') as month,
          TO_CHAR(p.created_at, 'Mon YYYY') as label,
          SUM(p.amount_cents)::bigint as revenue,
          COUNT(p.id)::int as count
        FROM payments p
        WHERE p.status = 'completed'
        GROUP BY TO_CHAR(p.created_at, 'YYYY-MM'), TO_CHAR(p.created_at, 'Mon YYYY')
        ORDER BY month ASC
      `);

      const yearlyRevenueRes = await query(`
        SELECT 
          TO_CHAR(p.created_at, 'YYYY') as year,
          TO_CHAR(p.created_at, 'YYYY') as label,
          SUM(p.amount_cents)::bigint as revenue,
          COUNT(p.id)::int as count
        FROM payments p
        WHERE p.status = 'completed'
        GROUP BY TO_CHAR(p.created_at, 'YYYY')
        ORDER BY year ASC
      `);

      // 5. Payment History Table (Ledger)
      const transactionsRes = await query(`
        SELECT 
          p.id,
          p.consultation_id,
          p.amount_cents,
          p.currency,
          p.status,
          p.card_brand,
          p.card_last4,
          p.stripe_payment_id,
          p.created_at,
          COALESCE(pt.full_name, 'Patient') as patient_name,
          COALESCE(pt.email, '') as patient_email,
          COALESCE(ct.display_name, 'Standard Consultation') as consultation_type,
          COALESCE(ct.name, 'standard') as consultation_type_key
        FROM payments p
        LEFT JOIN consultations c ON c.id = p.consultation_id
        LEFT JOIN patients pt ON pt.id = c.patient_id
        LEFT JOIN consultation_types ct ON ct.id = c.consultation_type_id
        ${whereSql}
        ORDER BY p.created_at DESC
        LIMIT 100
      `, queryParams);

      res.json({
        data: {
          financialOverview: {
            totalRevenue: Number(overview.total_revenue),
            monthlyRevenue: Number(overview.monthly_revenue),
            pendingAmount: Number(overview.pending_amount),
            refundedAmount: Number(overview.refunded_amount),
          },
          paymentAnalytics: {
            successfulPayments: overview.successful_count,
            failedPayments: overview.failed_count,
            pendingTransactions: overview.pending_count,
            refundedTransactions: overview.refunded_count,
            totalTransactions: overview.total_transactions,
          },
          revenueAnalytics: {
            daily: dailyRevenueRes.rows.map((r) => ({ ...r, revenue: Number(r.revenue) })),
            monthly: monthlyRevenueRes.rows.map((r) => ({ ...r, revenue: Number(r.revenue) })),
            yearly: yearlyRevenueRes.rows.map((r) => ({ ...r, revenue: Number(r.revenue) })),
            byType: revenueByType,
          },
          transactions: transactionsRes.rows.map((t) => ({
            id: t.id,
            consultationId: t.consultation_id,
            amountCents: t.amount_cents,
            currency: t.currency || 'usd',
            status: t.status,
            cardBrand: t.card_brand || 'Card',
            cardLast4: t.card_last4 || '••••',
            stripePaymentId: t.stripe_payment_id || `txn_${t.id.slice(0, 8)}`,
            createdAt: t.created_at,
            patientName: t.patient_name,
            patientEmail: t.patient_email,
            consultationType: t.consultation_type,
            consultationTypeKey: t.consultation_type_key,
          })),
          filters: {
            range,
            status: statusFilter,
            type: typeFilter,
          },
        },
      });
      return;
    }

    // In-memory fallback
    res.json({
      data: {
        financialOverview: { totalRevenue: 15000, monthlyRevenue: 15000, pendingAmount: 0, refundedAmount: 0 },
        paymentAnalytics: { successfulPayments: 1, failedPayments: 0, pendingTransactions: 0, refundedTransactions: 0, totalTransactions: 1 },
        revenueAnalytics: { daily: [], monthly: [], yearly: [], byType: [] },
        transactions: [],
        filters: { range, status: statusFilter, type: typeFilter },
      },
    });
  } catch (err: any) {
    console.error('[Reports Admin Error]', err);
    res.status(500).json({ message: 'Error generating financial reports', error: err.message });
  }
}
