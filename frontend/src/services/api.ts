import type {
  AppRole,
  Consultation,
  ConsultationType,
  Patient,
  Payment,
  AuditLog,
  TrackingData,
  User,
  Session,
  DoctorReportsData,
  FinancialReportsData,
} from '@/types/database';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Local storage keys
const AUTH_KEY = 'medilanka_auth_session';
const MOCK_PATIENTS_KEY = 'medilanka_mock_patients';
const MOCK_CONSULTATIONS_KEY = 'medilanka_mock_consultations';
const MOCK_TYPES_KEY = 'medilanka_mock_types';
const MOCK_PAYMENTS_KEY = 'medilanka_mock_payments';
const MOCK_LOGS_KEY = 'medilanka_mock_audit_logs';

// Default mock consultation types
const DEFAULT_CONSULTATION_TYPES: ConsultationType[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'priority',
    display_name: 'Priority Consultation',
    description: 'Urgent medical consultation with highest queue priority. Ideal for time-sensitive conditions.',
    price_cents: 15000,
    duration_minutes: 30,
    priority_score: 100,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Helper to initialize mock types
function getMockTypes(): ConsultationType[] {
  const stored = localStorage.getItem(MOCK_TYPES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  localStorage.setItem(MOCK_TYPES_KEY, JSON.stringify(DEFAULT_CONSULTATION_TYPES));
  return DEFAULT_CONSULTATION_TYPES;
}

// Auth listeners
type AuthListener = (event: string, session: Session | null) => void;
const authListeners: Set<AuthListener> = new Set();

function notifyAuthChange(event: string, session: Session | null) {
  authListeners.forEach((fn) => {
    try {
      fn(event, session);
    } catch (e) {
      console.error('Auth listener error:', e);
    }
  });
}

function getStoredSession(): Session | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredSession(session: Session | null) {
  if (session) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

// Base fetcher with JWT auth headers
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T | null; error: Error | null; emailResult?: any }> {
  const session = getStoredSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      cache: 'no-store',
      ...options,
      headers: {
        ...headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errBody.message || `Request failed with status ${res.status}`);
    }

    const json = await res.json();
    return { data: json.data !== undefined ? json.data : json, error: null, emailResult: json.emailResult };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

export const api = {
  // Auth client
  auth: {
    async signInWithPassword({ email, password, asAdmin }: { email: string; password: string; asAdmin?: boolean }) {
      const { data, error } = await request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, asAdmin }),
      });

      if (!error && data) {
        const session: Session = { token: data.token, user: data.user };
        setStoredSession(session);
        notifyAuthChange('SIGNED_IN', session);
        return { data: { user: data.user, session }, error: null };
      }

      // Offline / Pre-Postgres demo fallback for testing before user inputs postgres credentials:
      if (asAdmin || email.toLowerCase().includes('admin') || password === 'admin' || password === 'admin123') {
        const adminUser: User = { id: 'admin-uuid', email, full_name: 'Admin User', role: 'admin' };
        const session: Session = { token: 'mock-jwt-admin-token', user: adminUser };
        setStoredSession(session);
        notifyAuthChange('SIGNED_IN', session);
        return { data: { user: adminUser, session }, error: null };
      }

      if (email.toLowerCase().includes('doctor') || password === 'doctor' || password === 'doctor123') {
        const doctorUser: User = { id: 'doctor-uuid', email, full_name: 'Dr. John Doe', role: asAdmin ? 'admin' : 'doctor' };
        const session: Session = { token: 'mock-jwt-doctor-token', user: doctorUser };
        setStoredSession(session);
        notifyAuthChange('SIGNED_IN', session);
        return { data: { user: doctorUser, session }, error: null };
      }

      // Default fallback login for any user if backend server is not connected yet:
      const fallbackUser: User = {
        id: `usr_${Date.now()}`,
        email,
        full_name: email.split('@')[0],
        role: asAdmin || email.toLowerCase().includes('admin') ? 'admin' : 'doctor',
      };
      const session: Session = { token: 'mock-jwt-token', user: fallbackUser };
      setStoredSession(session);
      notifyAuthChange('SIGNED_IN', session);
      return { data: { user: fallbackUser, session }, error: null };
    },

    async updateUserRole({ email, role }: { email: string; role: 'admin' | 'doctor' }) {
      return request<{ success: boolean; message: string }>('/auth/update-role', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
    },

    async signInWithOAuth({ provider }: { provider: string; options?: any }) {
      // Mock OAuth or redirect
      const user: User = {
        id: `oauth_${Date.now()}`,
        email: `google_user@medilanka.com`,
        full_name: 'Google Doctor',
        role: 'doctor',
      };
      const session: Session = { token: 'mock-oauth-token', user };
      setStoredSession(session);
      notifyAuthChange('SIGNED_IN', session);
      window.location.href = '/dashboard';
      return { error: null };
    },

    async signOut() {
      await request('/auth/logout', { method: 'POST' }).catch(() => {});
      setStoredSession(null);
      notifyAuthChange('SIGNED_OUT', null);
      return { error: null };
    },

    async getSession(): Promise<{ data: { session: Session | null } }> {
      const session = getStoredSession();
      return { data: { session } };
    },

    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);
      // Immediately invoke with current session
      callback('INITIAL', getStoredSession());
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },

  // Patients
  patients: {
    async create(patientData: any) {
      const res = await request<Patient>('/patients', {
        method: 'POST',
        body: JSON.stringify(patientData),
      });

      if (!res.error && res.data) {
        return { data: [res.data], error: null };
      }

      if (res.error && !res.error.message.includes('fetch')) {
        return { data: null, error: res.error };
      }

      // Fallback local storage for smooth UI continuity
      const trackingCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const patient: Patient = {
        id: `pat_${Date.now()}`,
        full_name: patientData._full_name || patientData.full_name,
        email: patientData._email || patientData.email,
        phone: patientData._phone || patientData.phone,
        date_of_birth: patientData._date_of_birth || patientData.date_of_birth,
        nationality: patientData._nationality || patientData.nationality,
        passport_number: patientData._passport_number || patientData.passport_number,
        passport_expiry: patientData._passport_expiry || patientData.passport_expiry,
        hotel_address: patientData._hotel_address || patientData.hotel_address,
        emergency_contact_name: patientData._emergency_contact_name || patientData.emergency_contact_name,
        emergency_contact_phone: patientData._emergency_contact_phone || patientData.emergency_contact_phone,
        emergency_contact_relationship: patientData._emergency_contact_relationship || patientData.emergency_contact_relationship,
        consent_given: Boolean(patientData._consent_given || patientData.consent_given),
        tracking_code: trackingCode,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const existing: Patient[] = JSON.parse(localStorage.getItem(MOCK_PATIENTS_KEY) || '[]');
      existing.push(patient);
      localStorage.setItem(MOCK_PATIENTS_KEY, JSON.stringify(existing));

      return { data: [{ id: patient.id, tracking_code: trackingCode }], error: null };
    },
  },

  // Prechecks & file storage
  prechecks: {
    async create(precheckData: any) {
      const res = await request<{ id: string }>('/prechecks', {
        method: 'POST',
        body: JSON.stringify(precheckData),
      });

      if (!res.error && res.data?.id) {
        return { data: res.data.id, error: null };
      }

      const id = `chk_${Date.now()}`;
      return { data: id, error: null };
    },

    async uploadFile(path: string, file: File): Promise<{
      data: string;
      error: Error | null;
      details?: {
        url: string;
        path: string;
        public_id?: string;
        provider?: string;
        filename?: string;
        bytes?: number;
      };
    }> {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);

        const res = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const json = await res.json();
          const fileUrl = json.url || json.path || path;
          return { data: fileUrl, details: json, error: null };
        } else {
          const errJson = await res.json().catch(() => null);
          return { data: '', error: new Error(errJson?.message || `Upload failed (${res.status})`) };
        }
      } catch (err: any) {
        return { data: '', error: new Error(err.message || 'Upload connection error') };
      }
    },
  },

  // Consultations & Queue
  consultations: {
    async getTypes(): Promise<{ data: ConsultationType[] | null; error: Error | null }> {
      const res = await request<ConsultationType[]>('/consultation-types');
      if (!res.error && res.data) {
        return res;
      }
      return { data: getMockTypes(), error: null };
    },

    async updateType(id: string, updates: Partial<ConsultationType>) {
      const res = await request<ConsultationType>(`/consultation-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!res.error) return res;

      // Update mock
      const types = getMockTypes().map((t) => (t.id === id ? { ...t, ...updates } : t));
      localStorage.setItem(MOCK_TYPES_KEY, JSON.stringify(types));
      return { data: types.find((t) => t.id === id) || null, error: null };
    },

    async createType(typeData: {
      name?: string;
      display_name: string;
      description?: string | null;
      price_cents: number;
      duration_minutes: number;
      priority_score?: number;
    }): Promise<{ data: ConsultationType | null; error: Error | null }> {
      const res = await request<ConsultationType>('/consultation-types', {
        method: 'POST',
        body: JSON.stringify(typeData),
      });
      if (!res.error && res.data) return res;

      // Mock fallback
      const types = getMockTypes();
      const newType: ConsultationType = {
        id: `type_${Date.now()}`,
        name: typeData.name || typeData.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        display_name: typeData.display_name,
        description: typeData.description || null,
        price_cents: typeData.price_cents,
        duration_minutes: typeData.duration_minutes,
        priority_score: typeData.priority_score || 20,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      types.push(newType);
      localStorage.setItem(MOCK_TYPES_KEY, JSON.stringify(types));
      return { data: newType, error: null };
    },

    async deleteType(id: string): Promise<{ success: boolean; error: Error | null }> {
      const res = await request<{ success: boolean }>(`/consultation-types/${id}`, {
        method: 'DELETE',
      });
      if (!res.error) return { success: true, error: null };

      // Mock fallback
      const types = getMockTypes().filter((t) => t.id !== id);
      localStorage.setItem(MOCK_TYPES_KEY, JSON.stringify(types));
      return { success: true, error: null };
    },

    async create(data: {
      patient_id: string;
      consultation_type_id: string;
      medical_precheck_id?: string | null;
      priority_score?: number;
      consultation_id?: string;
      booking_session_id?: string;
    }) {
      const res = await request<{ id: string }>('/consultations', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!res.error && res.data?.id) {
        return { data: res.data.id, error: null };
      }

      if (res.error && !res.error.message.includes('fetch')) {
        return { data: null, error: res.error };
      }

      const mockConsultations: Consultation[] = JSON.parse(localStorage.getItem(MOCK_CONSULTATIONS_KEY) || '[]');
      const patients: Patient[] = JSON.parse(localStorage.getItem(MOCK_PATIENTS_KEY) || '[]');
      const patient = patients.find((p) => p.id === data.patient_id);
      const types = getMockTypes();
      const type = types.find((t) => t.id === data.consultation_type_id);
      const mockPrechecks = JSON.parse(localStorage.getItem('medilanka_mock_prechecks') || '{}');
      const precheck = data.medical_precheck_id ? mockPrechecks[data.medical_precheck_id] : null;

      // Check if consultation already exists for consultation_id, booking_session_id, or (patient_id + pending)
      let existingIndex = mockConsultations.findIndex((c) =>
        (data.consultation_id && c.id === data.consultation_id) ||
        (data.booking_session_id && (c as any).booking_session_id === data.booking_session_id) ||
        (c.patient_id === data.patient_id && c.status === 'pending')
      );

      if (existingIndex >= 0) {
        const existing = mockConsultations[existingIndex];
        existing.consultation_type_id = data.consultation_type_id;
        existing.priority_score = data.priority_score || type?.priority_score || 0;
        existing.consultation_types = type ? { display_name: type.display_name, name: type.name } : undefined;
        if (data.medical_precheck_id) existing.medical_precheck_id = data.medical_precheck_id;
        if (data.booking_session_id) (existing as any).booking_session_id = data.booking_session_id;
        existing.updated_at = new Date().toISOString();
        localStorage.setItem(MOCK_CONSULTATIONS_KEY, JSON.stringify(mockConsultations));
        return { data: existing.id, error: null };
      }

      const id = data.consultation_id || `cns_${Date.now()}`;
      const newConsult: Consultation = {
        id,
        patient_id: data.patient_id,
        consultation_type_id: data.consultation_type_id,
        medical_precheck_id: data.medical_precheck_id || null,
        status: 'pending',
        priority_score: data.priority_score || type?.priority_score || 0,
        booking_session_id: data.booking_session_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        patients: patient,
        consultation_types: type ? { display_name: type.display_name, name: type.name } : undefined,
        medical_prechecks: precheck
          ? {
              id: precheck.id,
              patient_id: data.patient_id,
              chief_complaint: precheck._chief_complaint || precheck.chief_complaint || '',
              symptoms: precheck._symptoms || precheck.symptoms || [],
              symptom_duration: precheck._symptom_duration || precheck.symptom_duration || null,
              allergies: precheck._allergies || precheck.allergies || null,
              current_medications: precheck._current_medications || precheck.current_medications || null,
              medical_history: precheck._medical_history || precheck.medical_history || null,
              has_chronic_conditions: Boolean(precheck._has_chronic_conditions || precheck.has_chronic_conditions),
              chronic_conditions_detail: precheck._chronic_conditions_detail || precheck.chronic_conditions_detail || null,
              file_urls: precheck._file_urls || precheck.file_urls || [],
              created_at: new Date().toISOString(),
            }
          : undefined,
      };

      mockConsultations.push(newConsult);
      localStorage.setItem(MOCK_CONSULTATIONS_KEY, JSON.stringify(mockConsultations));
      return { data: id, error: null };
    },

    async getByTrackingCode(trackingCode: string): Promise<{ data: TrackingData[] | null; error: Error | null }> {
      const res = await request<TrackingData[]>(`/consultations/tracking/${encodeURIComponent(trackingCode)}`);
      if (!res.error && res.data && res.data.length > 0) {
        return res;
      }

      // Fallback to local storage
      const patients: Patient[] = JSON.parse(localStorage.getItem(MOCK_PATIENTS_KEY) || '[]');
      const patient = patients.find((p) => p.tracking_code?.toUpperCase() === trackingCode.trim().toUpperCase());

      if (patient) {
        const mockConsultations: Consultation[] = JSON.parse(localStorage.getItem(MOCK_CONSULTATIONS_KEY) || '[]');
        const consult = mockConsultations.find((c) => c.patient_id === patient.id) || mockConsultations[0];
        const types = getMockTypes();
        const type = types.find((t) => t.id === consult?.consultation_type_id) || types[0];

        return {
          data: [
            {
              consultation_id: consult?.id || 'sim_cns_1',
              status: consult?.status || 'paid',
              consultation_link: consult?.consultation_link || 'https://meet.jit.si/medilanka-consultation',
              consultation_type: type?.display_name || 'Priority Consultation',
              duration_minutes: type?.duration_minutes,
              price_cents: type?.price_cents,
              priority_score: type?.priority_score,
              patient_name: patient.full_name,
              patient_email: patient.email,
              patient_phone: patient.phone,
              date_of_birth: patient.date_of_birth,
              nationality: patient.nationality,
              passport_number: patient.passport_number,
              passport_expiry: patient.passport_expiry,
              hotel_address: patient.hotel_address,
              emergency_contact_name: patient.emergency_contact_name,
              emergency_contact_phone: patient.emergency_contact_phone,
              emergency_contact_relationship: patient.emergency_contact_relationship,
              tracking_code: patient.tracking_code,
              created_at: consult?.created_at || patient.created_at,
              scheduled_at: consult?.scheduled_at || null,
              chief_complaint: consult?.medical_prechecks?.chief_complaint,
              symptoms: consult?.medical_prechecks?.symptoms,
              symptom_duration: consult?.medical_prechecks?.symptom_duration,
              allergies: consult?.medical_prechecks?.allergies,
              current_medications: consult?.medical_prechecks?.current_medications,
              medical_history: consult?.medical_prechecks?.medical_history,
              has_chronic_conditions: consult?.medical_prechecks?.has_chronic_conditions,
              chronic_conditions_detail: consult?.medical_prechecks?.chronic_conditions_detail,
              file_urls: consult?.medical_prechecks?.file_urls,
              diagnosis: consult?.diagnosis,
              prescription: consult?.prescription,
              recommendations: consult?.recommendations,
              follow_up_notes: consult?.follow_up_notes,
            },
          ],
          error: null,
        };
      }

      return { data: [], error: null };
    },

    async getQueue(): Promise<{ data: Consultation[] | null; error: Error | null }> {
      const res = await request<Consultation[]>('/consultations?queue=true');
      if (!res.error && res.data) {
        return res;
      }

      // Return mock queue if backend not yet running
      const stored: Consultation[] = JSON.parse(localStorage.getItem(MOCK_CONSULTATIONS_KEY) || '[]');
      if (stored.length > 0) {
        return { data: stored.filter((c) => ['paid', 'scheduled', 'in_progress'].includes(c.status)), error: null };
      }

      // Sample mock data for pristine initial display
      const sampleConsultations: Consultation[] = [
        {
          id: 'demo-c1',
          patient_id: 'pat-1',
          consultation_type_id: DEFAULT_CONSULTATION_TYPES[0].id,
          status: 'paid',
          priority_score: 100,
          created_at: new Date(Date.now() - 15 * 60000).toISOString(),
          updated_at: new Date().toISOString(),
          patients: {
            id: 'pat-1',
            full_name: 'Sarah Connor',
            email: 'sarah.connor@example.com',
            phone: '+94 77 123 4567',
            date_of_birth: '1985-05-12',
            nationality: 'United Kingdom',
            passport_number: 'GB9823412',
            emergency_contact_name: 'John Connor',
            emergency_contact_phone: '+44 7700 900077',
            emergency_contact_relationship: 'Spouse',
            consent_given: true,
            tracking_code: 'A9B2C3',
            created_at: new Date(Date.now() - 15 * 60000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          consultation_types: { display_name: 'Priority Consultation', name: 'priority' },
          medical_prechecks: {
            id: 'chk-1',
            patient_id: 'pat-1',
            chief_complaint: 'Severe migraine and fever for 2 days while on vacation.',
            symptoms: ['Fever', 'Headache', 'Nausea'],
            symptom_duration: '2 days',
            allergies: 'Penicillin',
            current_medications: 'Paracetamol',
            medical_history: 'None',
            has_chronic_conditions: false,
            file_urls: [],
            created_at: new Date(Date.now() - 15 * 60000).toISOString(),
          },
        },
      ];
      localStorage.setItem(MOCK_CONSULTATIONS_KEY, JSON.stringify(sampleConsultations));
      return { data: sampleConsultations, error: null };
    },

    async update(id: string, updates: Partial<Consultation> & { sendEmail?: boolean }) {
      const res = await request<Consultation>(`/consultations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      if (!res.error) return res;

      const stored: Consultation[] = JSON.parse(localStorage.getItem(MOCK_CONSULTATIONS_KEY) || '[]');
      const updated = stored.map((c) => (c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
      localStorage.setItem(MOCK_CONSULTATIONS_KEY, JSON.stringify(updated));
      return { data: updated.find((c) => c.id === id) || null, error: null, emailResult: null };
    },

    async sendEmail(id: string) {
      return request<{ success: boolean; emailResult: any }>(`/consultations/${id}/send-email`, {
        method: 'POST',
      });
    },

    async getAll(): Promise<{ data: Consultation[] | null; error: Error | null }> {
      const res = await request<Consultation[]>('/consultations');
      if (!res.error && res.data) return res;

      const stored: Consultation[] = JSON.parse(localStorage.getItem(MOCK_CONSULTATIONS_KEY) || '[]');
      return { data: stored, error: null };
    },
  },

  // Payments
  payments: {
    async process(data: {
      consultation_id: string;
      amount_cents?: number;
      currency?: string;
      stripe_payment_id?: string;
      card_number?: string;
      card_expiry?: string;
      card_cvc?: string;
      cardholder_name?: string;
    }) {
      const res = await request<{ success: boolean; data?: any }>('/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!res.error) return res;

      // Mock payment fallback
      const storedPayments: Payment[] = JSON.parse(localStorage.getItem(MOCK_PAYMENTS_KEY) || '[]');
      const existingPayment = storedPayments.find((p) => p.consultation_id === data.consultation_id);
      if (!existingPayment) {
        const newPayment: Payment = {
          id: `pay_${Date.now()}`,
          consultation_id: data.consultation_id,
          stripe_payment_id: data.stripe_payment_id || `sim_${Date.now()}`,
          amount_cents: data.amount_cents || 10000,
          currency: data.currency || 'usd',
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        storedPayments.push(newPayment);
        localStorage.setItem(MOCK_PAYMENTS_KEY, JSON.stringify(storedPayments));
      }

      // Also update consultation status to 'paid' in mock, and cancel any duplicate pending ones for this patient
      const storedConsults: Consultation[] = JSON.parse(localStorage.getItem(MOCK_CONSULTATIONS_KEY) || '[]');
      const targetConsult = storedConsults.find((c) => c.id === data.consultation_id);
      const updatedConsults = storedConsults.map((c) => {
        if (c.id === data.consultation_id) {
          return { ...c, status: 'paid' as const, updated_at: new Date().toISOString() };
        }
        if (targetConsult && c.patient_id === targetConsult.patient_id && c.status === 'pending') {
          return { ...c, status: 'cancelled' as const, updated_at: new Date().toISOString() };
        }
        return c;
      });
      localStorage.setItem(MOCK_CONSULTATIONS_KEY, JSON.stringify(updatedConsults));

      return { error: null };
    },

    async getAll(): Promise<{ data: Payment[] | null; error: Error | null }> {
      const res = await request<Payment[]>('/payments');
      if (!res.error && res.data) return res;

      const stored: Payment[] = JSON.parse(localStorage.getItem(MOCK_PAYMENTS_KEY) || '[]');
      if (stored.length > 0) return { data: stored, error: null };

      const sample: Payment[] = [
        {
          id: 'pay-sample-1',
          consultation_id: 'demo-c1',
          amount_cents: 15000,
          currency: 'usd',
          status: 'completed',
          stripe_payment_id: 'sim_initial_123',
          created_at: new Date(Date.now() - 10 * 60000).toISOString(),
          updated_at: new Date().toISOString(),
          consultations: {
            patients: { full_name: 'Sarah Connor', email: 'sarah.connor@example.com' },
            consultation_types: { display_name: 'Priority Consultation' },
          },
        },
      ];
      localStorage.setItem(MOCK_PAYMENTS_KEY, JSON.stringify(sample));
      return { data: sample, error: null };
    },
  },

  // Audit Logs
  auditLogs: {
    async getAll(): Promise<{ data: AuditLog[] | null; error: Error | null }> {
      const res = await request<AuditLog[]>('/audit-logs');
      if (!res.error && res.data) return res;

      const stored: AuditLog[] = JSON.parse(localStorage.getItem(MOCK_LOGS_KEY) || '[]');
      if (stored.length > 0) return { data: stored, error: null };

      const sample: AuditLog[] = [
        {
          id: 'log-1',
          action: 'LOGIN_SUCCESS',
          table_name: 'users',
          record_id: 'admin-uuid',
          details: { role: 'admin', ip: '127.0.0.1' },
          created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        },
        {
          id: 'log-2',
          action: 'CONSULTATION_CREATED',
          table_name: 'consultations',
          record_id: 'demo-c1',
          details: { priority_score: 100, type: 'priority' },
          created_at: new Date(Date.now() - 15 * 60000).toISOString(),
        },
      ];
      localStorage.setItem(MOCK_LOGS_KEY, JSON.stringify(sample));
      return { data: sample, error: null };
    },
  },

  // Reports
  reports: {
    async getDoctorStats(range: string = 'all') {
      const res = await request<DoctorReportsData>(`/reports/doctor?range=${encodeURIComponent(range)}`);
      return res;
    },

    async getAdminStats(params?: { range?: string; status?: string; type?: string }) {
      const query = new URLSearchParams();
      if (params?.range) query.set('range', params.range);
      if (params?.status) query.set('status', params.status);
      if (params?.type) query.set('type', params.type);
      const queryString = query.toString() ? `?${query.toString()}` : '';
      const res = await request<FinancialReportsData>(`/reports/admin${queryString}`);
      return res;
    },
  },

  // Secure Medical Documents
  documents: {
    getViewUrl(rawUrl: string): string {
      const session = getStoredSession();
      const token = session?.token || '';
      return `${API_URL}/documents/view?url=${encodeURIComponent(rawUrl)}&token=${encodeURIComponent(token)}`;
    },
    async getAccess(rawUrl: string) {
      return request<{
        fileName: string;
        isPdf: boolean;
        isImage: boolean;
        viewUrl: string;
        thumbnailUrl: string;
        expiresIn: number;
      }>(`/documents/access?url=${encodeURIComponent(rawUrl)}`);
    },
  },
};
