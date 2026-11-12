import type { Request, Response } from 'express';
import crypto from 'crypto';
import { query, isDbConnected } from '../config/db.js';
import { recordAuditLog } from './auditController.js';

export async function createPatient(req: Request, res: Response): Promise<void> {
  const {
    _full_name, full_name,
    _email, email,
    _phone, phone,
    _date_of_birth, date_of_birth,
    _nationality, nationality,
    _passport_number, passport_number,
    _passport_expiry, passport_expiry,
    _hotel_address, hotel_address,
    _emergency_contact_name, emergency_contact_name,
    _emergency_contact_phone, emergency_contact_phone,
    _emergency_contact_relationship, emergency_contact_relationship,
    _consent_given, consent_given,
    _user_id, user_id,
  } = req.body;

  const fullName = _full_name || full_name;
  const pEmail = _email || email;
  const pPhone = _phone || phone;
  const dob = _date_of_birth || date_of_birth;
  const pNat = _nationality || nationality;
  const passNum = _passport_number || passport_number;
  const passExp = _passport_expiry || passport_expiry || null;
  const hotel = _hotel_address || hotel_address || null;
  const emergName = _emergency_contact_name || emergency_contact_name || '';
  const emergPhone = _emergency_contact_phone || emergency_contact_phone || '';
  const emergRel = _emergency_contact_relationship || emergency_contact_relationship || null;
  const consent = _consent_given !== undefined ? _consent_given : (consent_given !== undefined ? consent_given : true);
  const uId = _user_id || user_id || null;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (dob) {
    const dobStr = typeof dob === 'string' ? dob.split('T')[0] : '';
    if (dobStr > todayStr) {
      res.status(400).json({ message: 'Date of Birth cannot be a future date.' });
      return;
    }
  }

  if (passExp) {
    const expStr = typeof passExp === 'string' ? passExp.split('T')[0] : '';
    if (expStr && expStr < todayStr) {
      res.status(400).json({ message: 'Passport Expiry Date cannot be in the past.' });
      return;
    }
  }

  const trackingCode = crypto.randomBytes(3).toString('hex').toUpperCase();

  try {
    if (isDbConnected()) {
      const sql = `
        INSERT INTO patients (
          full_name, email, phone, date_of_birth, nationality,
          passport_number, passport_expiry, hotel_address,
          emergency_contact_name, emergency_contact_phone,
          emergency_contact_relationship, consent_given, tracking_code, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, tracking_code
      `;

      const result = await query(sql, [
        fullName, pEmail, pPhone, dob, pNat,
        passNum, passExp, hotel,
        emergName, emergPhone, emergRel,
        consent, trackingCode, uId
      ]);

      const patientId = result.rows[0].id;

      recordAuditLog({
        actor: {
          id: uId,
          name: fullName,
          email: pEmail,
          role: 'patient',
        },
        action: 'patient.registered',
        table_name: 'patients',
        record_id: patientId,
        details: {
          full_name: fullName,
          email: pEmail,
          nationality: pNat,
          tracking_code: trackingCode,
        },
        status: 'success',
        ip_address: req.ip || req.socket.remoteAddress || null,
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.status(201).json({ data: result.rows[0] });
      return;
    }

    // In-memory fallback
    const id = `pat_${Date.now()}`;
    res.status(201).json({ data: { id, tracking_code: trackingCode } });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to create patient', error: err.message });
  }
}

export async function updatePatient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const updates = req.body;

  try {
    if (isDbConnected()) {
      const allowedFields = [
        'full_name', 'email', 'phone', 'date_of_birth', 'nationality',
        'passport_number', 'passport_expiry', 'hotel_address',
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship'
      ];

      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, val] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          setClauses.push(`${key} = $${idx}`);
          values.push(val);
          idx++;
        }
      }

      if (setClauses.length === 0) {
        res.status(400).json({ message: 'No valid fields to update' });
        return;
      }

      values.push(id);
      const sql = `UPDATE patients SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id::text = $${idx} RETURNING *`;
      const result = await query(sql, values);

      if (result.rows.length === 0) {
        res.status(404).json({ message: 'Patient not found' });
        return;
      }

      const updatedPatient = result.rows[0];

      recordAuditLog({
        req,
        actor: {
          id: updatedPatient.user_id,
          name: updatedPatient.full_name,
          email: updatedPatient.email,
          role: 'patient',
        },
        action: 'patient.updated',
        table_name: 'patients',
        record_id: updatedPatient.id,
        details: {
          updated_fields: Object.keys(updates),
          patient_name: updatedPatient.full_name,
        },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.json({ data: updatedPatient });
      return;
    }

    res.json({ data: { id, ...updates } });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to update patient', error: err.message });
  }
}

export async function deletePatient(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    if (isDbConnected()) {
      const getRes = await query(`SELECT id, full_name, email, user_id FROM patients WHERE id::text = $1`, [id]);
      const patient = getRes.rows[0];

      await query(`DELETE FROM patients WHERE id::text = $1`, [id]);

      recordAuditLog({
        req,
        action: 'patient.deleted',
        table_name: 'patients',
        record_id: Array.isArray(id) ? id[0] : (id as string),
        details: {
          patient_name: patient?.full_name || 'Patient',
          email: patient?.email,
        },
        status: 'success',
      }).catch((err) => console.warn('[Audit Log Warning]', err.message));

      res.json({ success: true, message: 'Patient record deleted', id });
      return;
    }

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to delete patient', error: err.message });
  }
}

export async function getPatientById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    if (isDbConnected()) {
      const result = await query(`SELECT * FROM patients WHERE id::text = $1`, [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ message: 'Patient not found' });
        return;
      }
      res.json({ data: result.rows[0] });
      return;
    }
    res.json({ data: null });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed to retrieve patient', error: err.message });
  }
}
