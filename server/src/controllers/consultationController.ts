import type { Request, Response } from 'express';
import { query, isDbConnected } from '../config/db.js';
import { sendConsultationSummaryEmail, sendConsultationLinkEmail } from '../services/emailService.js';
import { recordAuditLog } from './auditController.js';

export async function getConsultationTypes(req: Request, res: Response): Promise<void> {
  try {
    if (isDbConnected()) {
      const result = await query(
        `SELECT * FROM consultation_types WHERE is_active = true ORDER BY priority_score DESC`
      );
      res.json({ data: result.rows });
      return;
    }

    // Default types if database is not yet connected
    res.json({
      data: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'priority',
          display_name: 'Priority Consultation',
          description: 'Urgent medical consultation with highest queue priority. Ideal for time-sensitive conditions.',
          price_cents: 15000,
          duration_minutes: 30,
          priority_score: 100,
          is_active: true,
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'standard',
          display_name: 'Standard Consultation',
          description: 'Regular medical consultation for non-urgent conditions. Comprehensive assessment and advice.',
          price_cents: 10000,
          duration_minutes: 20,
          priority_score: 50,
          is_active: true,
        },
        {
          id: '33333333-3333-3333-3333-333333333333',
          name: 'short',
          display_name: 'Short Consultation',
          description: 'Quick consultation for simple medical queries, prescription renewals, or follow-ups.',
          price_cents: 5000,
          duration_minutes: 10,
          priority_score: 10,
          is_active: true,
        },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error fetching consultation types', error: err.message });
  }
}

export async function updateConsultationType(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { display_name, description, price_cents, duration_minutes, priority_score, is_active } = req.body;

  try {
    if (isDbConnected()) {
      const sql = `
        UPDATE consultation_types
        SET display_name = COALESCE($1, display_name),
            description = COALESCE($2, description),
            price_cents = COALESCE($3, price_cents),
            duration_minutes = COALESCE($4, duration_minutes),
            priority_score = COALESCE($5, priority_score),
            is_active = COALESCE($6, is_active),
            updated_at = NOW()
        WHERE id::text = $7 OR name = $7
        RETURNING *
      `;
      const result = await query(sql, [display_name, description, price_cents, duration_minutes, priority_score, is_active, id]);
      const updatedType = result.rows[0];

      recordAuditLog({
        req,
        action: 'pricing.updated',
        table_name: 'consultation_types',
        record_id: updatedType?.id || (Array.isArray(id) ? id[0] : (id as string)),
        details: {
          name: updatedType?.name,
          display_name: updatedType?.display_name,
          price_cents: updatedType?.price_cents,
          duration_minutes: updatedType?.duration_minutes,
        },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.json({ data: updatedType });
      return;
    }

    res.json({ data: { id, display_name, description, price_cents, duration_minutes, priority_score, is_active } });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating consultation type', error: err.message });
  }
}

export async function createConsultationType(req: Request, res: Response): Promise<void> {
  const { name, display_name, description, price_cents, duration_minutes, priority_score } = req.body;

  if (!display_name || price_cents === undefined || duration_minutes === undefined) {
    res.status(400).json({ message: 'display_name, price_cents, and duration_minutes are required' });
    return;
  }

  const slug = (name || display_name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 30);
  const uniqueName = `${slug}_${Date.now().toString(36)}`;
  const score = priority_score !== undefined ? priority_score : 10;

  try {
    if (isDbConnected()) {
      const sql = `
        INSERT INTO consultation_types (
          name, display_name, description, price_cents, duration_minutes, priority_score, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
      `;
      const result = await query(sql, [
        uniqueName,
        display_name,
        description || null,
        price_cents,
        duration_minutes,
        score,
      ]);
      const createdType = result.rows[0];

      recordAuditLog({
        req,
        action: 'pricing.created',
        table_name: 'consultation_types',
        record_id: createdType.id,
        details: {
          name: createdType.name,
          display_name: createdType.display_name,
          price_cents: createdType.price_cents,
          duration_minutes: createdType.duration_minutes,
        },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.status(201).json({ data: createdType });
      return;
    }

    const mockId = `type_${Date.now()}`;
    res.status(201).json({
      data: {
        id: mockId,
        name: uniqueName,
        display_name,
        description: description || null,
        price_cents,
        duration_minutes,
        priority_score: score,
        is_active: true,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Error creating consultation type', error: err.message });
  }
}

export async function deleteConsultationType(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    if (isDbConnected()) {
      await query(`DELETE FROM consultation_types WHERE id::text = $1 OR name = $1`, [id]);

      recordAuditLog({
        req,
        action: 'pricing.deleted',
        table_name: 'consultation_types',
        record_id: Array.isArray(id) ? id[0] : (id as string),
        details: { identifier: id },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.json({ data: { success: true, id } });
      return;
    }

    res.json({ data: { success: true, id } });
  } catch (err: any) {
    res.status(500).json({ message: 'Error deleting consultation type', error: err.message });
  }
}

interface InMemoryConsultation {
  id: string;
  patient_id: string;
  consultation_type_id: string;
  medical_precheck_id: string | null;
  priority_score: number;
  status: string;
  booking_session_id?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export const memoryConsultations: InMemoryConsultation[] = [];

export async function createConsultation(req: Request, res: Response): Promise<void> {
  const {
    _consultation_id, consultation_id,
    _booking_session_id, booking_session_id,
    _patient_id, patient_id,
    _consultation_type_id, consultation_type_id,
    _medical_precheck_id, medical_precheck_id,
    _priority_score, priority_score,
  } = req.body;

  const cId = _consultation_id || consultation_id || null;
  const sessionId = _booking_session_id || booking_session_id || null;
  const pId = _patient_id || patient_id;
  const tId = _consultation_type_id || consultation_type_id;
  const preId = _medical_precheck_id || medical_precheck_id || null;
  const score = _priority_score !== undefined ? _priority_score : (priority_score !== undefined ? priority_score : 0);

  try {
    if (isDbConnected()) {
      // 1. If explicit consultation_id provided, verify & reuse/update
      if (cId) {
        const existingById = await query(
          `SELECT id, status, patient_id FROM consultations WHERE id = $1`,
          [cId]
        );
        if (existingById.rows.length > 0) {
          const row = existingById.rows[0];
          if (row.status === 'pending') {
            await query(
              `UPDATE consultations
               SET consultation_type_id = $1,
                   priority_score = $2,
                   medical_precheck_id = COALESCE($3, medical_precheck_id),
                   booking_session_id = COALESCE($4, booking_session_id),
                   updated_at = NOW()
               WHERE id = $5`,
              [tId, score, preId, sessionId, cId]
            );
          }
          res.status(200).json({ data: { id: row.id } });
          return;
        }
      }

      // 2. If booking_session_id provided, check if consultation already exists for this booking session
      if (sessionId) {
        const existingBySession = await query(
          `SELECT id, status FROM consultations WHERE booking_session_id = $1`,
          [sessionId]
        );
        if (existingBySession.rows.length > 0) {
          const row = existingBySession.rows[0];
          if (row.status === 'pending') {
            await query(
              `UPDATE consultations
               SET consultation_type_id = $1,
                   priority_score = $2,
                   medical_precheck_id = COALESCE($3, medical_precheck_id),
                   updated_at = NOW()
               WHERE id = $4`,
              [tId, score, preId, row.id]
            );
          }
          res.status(200).json({ data: { id: row.id } });
          return;
        }
      }

      // 3. If patient_id already has a pending consultation from current booking session, reuse it
      if (pId) {
        const existingPending = await query(
          `SELECT id, status FROM consultations WHERE patient_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
          [pId]
        );
        if (existingPending.rows.length > 0) {
          const row = existingPending.rows[0];
          await query(
            `UPDATE consultations
             SET consultation_type_id = $1,
                 priority_score = $2,
                 medical_precheck_id = COALESCE($3, medical_precheck_id),
                 booking_session_id = COALESCE($4, booking_session_id),
                 updated_at = NOW()
             WHERE id = $5`,
            [tId, score, preId, sessionId, row.id]
          );
          res.status(200).json({ data: { id: row.id } });
          return;
        }
      }

      // 4. Atomic insert with ON CONFLICT if booking_session_id is provided
      if (sessionId) {
        const sql = `
          INSERT INTO consultations (
            patient_id, consultation_type_id, medical_precheck_id, priority_score, status, booking_session_id
          ) VALUES ($1, $2, $3, $4, 'pending', $5)
          ON CONFLICT (booking_session_id) DO UPDATE
          SET consultation_type_id = EXCLUDED.consultation_type_id,
              priority_score = EXCLUDED.priority_score,
              medical_precheck_id = COALESCE(EXCLUDED.medical_precheck_id, consultations.medical_precheck_id),
              updated_at = NOW()
          RETURNING id
        `;
        const result = await query(sql, [pId, tId, preId, score, sessionId]);
        const consultId = result.rows[0].id;

        recordAuditLog({
          req,
          action: 'consultation.created',
          table_name: 'consultations',
          record_id: consultId,
          details: {
            patient_id: pId,
            consultation_type_id: tId,
            priority_score: score,
            booking_session_id: sessionId,
          },
          status: 'success',
        }).catch((err) => console.warn('[Audit Log Warning]', err.message));

        res.status(201).json({ data: { id: consultId } });
        return;
      }

      // Normal insert if no session ID provided
      const sql = `
        INSERT INTO consultations (
          patient_id, consultation_type_id, medical_precheck_id, priority_score, status
        ) VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id
      `;
      const result = await query(sql, [pId, tId, preId, score]);
      const consultId = result.rows[0].id;

      recordAuditLog({
        req,
        action: 'consultation.created',
        table_name: 'consultations',
        record_id: consultId,
        details: {
          patient_id: pId,
          consultation_type_id: tId,
          priority_score: score,
        },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.status(201).json({ data: { id: consultId } });
      return;
    }

    // In-memory fallback
    let existing = memoryConsultations.find(c => 
      (cId && c.id === cId) ||
      (sessionId && c.booking_session_id === sessionId) ||
      (pId && c.patient_id === pId && c.status === 'pending')
    );

    if (existing) {
      if (existing.status === 'pending') {
        existing.consultation_type_id = tId;
        existing.priority_score = score;
        if (preId) existing.medical_precheck_id = preId;
        if (sessionId) existing.booking_session_id = sessionId;
        existing.updated_at = new Date().toISOString();
      }
      res.status(200).json({ data: { id: existing.id } });
      return;
    }

    const id = cId || `cns_${Date.now()}`;
    const newConsult: InMemoryConsultation = {
      id,
      patient_id: pId,
      consultation_type_id: tId,
      medical_precheck_id: preId,
      priority_score: score,
      status: 'pending',
      booking_session_id: sessionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryConsultations.push(newConsult);
    res.status(201).json({ data: { id } });
  } catch (err: any) {
    res.status(500).json({ message: 'Error creating consultation', error: err.message });
  }
}

export async function getConsultations(req: Request, res: Response): Promise<void> {
  const isQueue = req.query.queue === 'true';

  try {
    if (isDbConnected()) {
      let sql = `
        SELECT 
          c.*,
          row_to_json(p.*) as patients,
          json_build_object('display_name', ct.display_name, 'name', ct.name) as consultation_types,
          row_to_json(mp.*) as medical_prechecks
        FROM consultations c
        JOIN patients p ON p.id = c.patient_id
        JOIN consultation_types ct ON ct.id = c.consultation_type_id
        LEFT JOIN medical_prechecks mp ON mp.id = c.medical_precheck_id
      `;

      if (isQueue) {
        sql += ` WHERE c.status IN ('pending', 'paid', 'scheduled', 'in_progress') ORDER BY c.priority_score DESC, c.created_at ASC`;
      } else {
        sql += ` ORDER BY c.created_at DESC`;
      }

      const result = await query(sql);
      res.json({ data: result.rows });
      return;
    }

    res.json({ data: [] });
  } catch (err: any) {
    res.status(500).json({ message: 'Error retrieving consultations', error: err.message });
  }
}

export async function updateConsultation(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const updates = req.body;
  const shouldSendEmail = updates.sendEmail ?? updates.send_email;

  try {
    if (isDbConnected()) {
      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, val] of Object.entries(updates)) {
        // Safe key check
        if (['status', 'consultation_link', 'diagnosis', 'prescription', 'recommendations', 'follow_up_notes', 'started_at', 'completed_at'].includes(key)) {
          setClauses.push(`${key} = $${idx}`);
          values.push(val);
          idx++;
        }
      }

      if (setClauses.length === 0) {
        res.json({ data: null });
        return;
      }

      values.push(id);
      const sql = `UPDATE consultations SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
      const result = await query(sql, values);
      const updatedConsultation = result.rows[0];

      // Record doctor/admin audit log for consultation changes
      let actionName = 'consultation.updated';
      if (updates.status === 'in_progress') {
        actionName = 'queue.status_updated';
      } else if (updates.status === 'completed') {
        actionName = 'consultation.completed';
      } else if (updates.status === 'cancelled') {
        actionName = 'consultation.cancelled';
      } else if (updates.status) {
        actionName = `consultation.status_${updates.status}`;
      } else if (updates.doctor_id) {
        actionName = 'consultation.assigned';
      } else if (updates.diagnosis !== undefined || updates.prescription !== undefined) {
        actionName = 'consultation.diagnosis_updated';
      }

      recordAuditLog({
        req,
        action: actionName,
        table_name: 'consultations',
        record_id: Array.isArray(id) ? id[0] : (id as string),
        details: {
          updated_fields: Object.keys(updates),
          new_status: updates.status,
          doctor_id: updates.doctor_id,
          has_diagnosis: updates.diagnosis !== undefined,
          has_prescription: updates.prescription !== undefined,
          has_link: updates.consultation_link !== undefined,
        },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      // Check if we should trigger an email to patient
      let emailResult = null;
      const isDiagnosisUpdate =
        updates.diagnosis !== undefined ||
        updates.prescription !== undefined ||
        updates.recommendations !== undefined ||
        updates.follow_up_notes !== undefined;
      const isLinkOnlyUpdate = updates.consultation_link !== undefined && !isDiagnosisUpdate;

      // If doctor updated diagnosis fields or explicitly requested sendEmail
      if (isDiagnosisUpdate || shouldSendEmail) {
        const patientRes = await query(
          `SELECT c.*, p.full_name as patient_name, p.email as patient_email, p.tracking_code,
                  ct.display_name as consultation_type
           FROM consultations c
           JOIN patients p ON p.id = c.patient_id
           JOIN consultation_types ct ON ct.id = c.consultation_type_id
           WHERE c.id = $1`,
          [id]
        );

        if (patientRes.rows.length > 0) {
          const row = patientRes.rows[0];
          if (row.patient_email) {
            emailResult = await sendConsultationSummaryEmail({
              patientEmail: row.patient_email,
              patientName: row.patient_name,
              trackingCode: row.tracking_code,
              consultationType: row.consultation_type,
              diagnosis: updatedConsultation.diagnosis,
              prescription: updatedConsultation.prescription,
              recommendations: updatedConsultation.recommendations,
              followUpNotes: updatedConsultation.follow_up_notes,
              consultationLink: updatedConsultation.consultation_link,
            });
          }
        }
      } else if (isLinkOnlyUpdate && updates.consultation_link) {
        // Only link was updated - notify patient of meeting link
        const patientRes = await query(
          `SELECT c.*, p.full_name as patient_name, p.email as patient_email, p.tracking_code,
                  ct.display_name as consultation_type
           FROM consultations c
           JOIN patients p ON p.id = c.patient_id
           JOIN consultation_types ct ON ct.id = c.consultation_type_id
           WHERE c.id = $1`,
          [id]
        );

        if (patientRes.rows.length > 0 && patientRes.rows[0].patient_email) {
          const row = patientRes.rows[0];
          emailResult = await sendConsultationLinkEmail({
            patientEmail: row.patient_email,
            patientName: row.patient_name,
            trackingCode: row.tracking_code,
            consultationType: row.consultation_type,
            consultationLink: updates.consultation_link,
          });
        }
      }

      res.json({ data: updatedConsultation, emailResult });
      return;
    }

    res.json({ data: { id, ...updates } });
  } catch (err: any) {
    res.status(500).json({ message: 'Error updating consultation', error: err.message });
  }
}

export async function sendConsultationEmail(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    if (!isDbConnected()) {
      res.status(503).json({ message: 'Database not connected' });
      return;
    }

    const patientRes = await query(
      `SELECT c.*, p.full_name as patient_name, p.email as patient_email, p.tracking_code,
              ct.display_name as consultation_type
       FROM consultations c
       JOIN patients p ON p.id = c.patient_id
       JOIN consultation_types ct ON ct.id = c.consultation_type_id
       WHERE c.id = $1`,
      [id]
    );

    if (patientRes.rows.length === 0) {
      res.status(404).json({ message: 'Consultation not found' });
      return;
    }

    const row = patientRes.rows[0];
    if (!row.patient_email) {
      res.status(400).json({ message: 'Patient has no email address recorded' });
      return;
    }

    const emailResult = await sendConsultationSummaryEmail({
      patientEmail: row.patient_email,
      patientName: row.patient_name,
      trackingCode: row.tracking_code,
      consultationType: row.consultation_type,
      diagnosis: row.diagnosis,
      prescription: row.prescription,
      recommendations: row.recommendations,
      followUpNotes: row.follow_up_notes,
      consultationLink: row.consultation_link,
    });

    res.json({ success: emailResult.success, emailResult });
  } catch (err: any) {
    res.status(500).json({ message: 'Error sending consultation email', error: err.message });
  }
}

export async function getByTrackingCode(req: Request, res: Response): Promise<void> {
  const code = String(req.params.code || '');

  try {
    if (isDbConnected()) {
      const sql = `
        SELECT 
          COALESCE(c.id, p.id) as consultation_id,
          COALESCE(c.status, 'paid') as status,
          c.consultation_link,
          c.priority_score,
          c.diagnosis,
          c.prescription,
          c.recommendations,
          c.follow_up_notes,
          c.scheduled_at,
          COALESCE(c.created_at, p.created_at) as created_at,
          COALESCE(ct.display_name, 'Standard Consultation') as consultation_type,
          ct.duration_minutes,
          ct.price_cents,
          p.id as patient_id,
          p.full_name as patient_name,
          p.email as patient_email,
          p.phone as patient_phone,
          p.date_of_birth,
          p.nationality,
          p.passport_number,
          p.passport_expiry,
          p.hotel_address,
          p.emergency_contact_name,
          p.emergency_contact_phone,
          p.emergency_contact_relationship,
          p.tracking_code,
          mp.chief_complaint,
          mp.symptoms,
          mp.symptom_duration,
          mp.allergies,
          mp.current_medications,
          mp.medical_history,
          mp.has_chronic_conditions,
          mp.chronic_conditions_detail,
          mp.file_urls
        FROM patients p
        LEFT JOIN consultations c ON c.patient_id = p.id
        LEFT JOIN consultation_types ct ON ct.id = c.consultation_type_id
        LEFT JOIN medical_prechecks mp ON (mp.id = c.medical_precheck_id OR mp.patient_id = p.id)
        WHERE UPPER(p.tracking_code) = UPPER($1)
        ORDER BY c.created_at DESC NULLS LAST, mp.created_at DESC NULLS LAST
        LIMIT 1
      `;

      const result = await query(sql, [code.trim()]);
      res.json({ data: result.rows });
      return;
    }

    res.json({ data: [] });
  } catch (err: any) {
    res.status(500).json({ message: 'Error searching tracking code', error: err.message });
  }
}
