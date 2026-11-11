export type AppRole = 'admin' | 'doctor';

export type ConsultationStatus =
  | 'pending'
  | 'paid'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'referred'
  | 'cancelled';

export type ConsultationTypeName = 'priority' | 'standard' | 'short' | (string & {});

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  role: AppRole | null;
}

export interface Session {
  token: string;
  user: User;
}

export interface ConsultationType {
  id: string;
  name: ConsultationTypeName;
  display_name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  priority_score: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Patient {
  id: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  nationality: string;
  passport_number: string;
  passport_expiry?: string | null;
  hotel_address?: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship?: string | null;
  consent_given: boolean;
  tracking_code: string;
  created_at: string;
  updated_at: string;
}

export interface MedicalPrecheck {
  id: string;
  patient_id: string;
  chief_complaint: string;
  symptoms: string[];
  symptom_duration?: string | null;
  allergies?: string | null;
  current_medications?: string | null;
  medical_history?: string | null;
  has_chronic_conditions: boolean;
  chronic_conditions_detail?: string | null;
  file_urls: string[];
  created_at: string;
}

export interface Consultation {
  id: string;
  patient_id: string;
  consultation_type_id: string;
  medical_precheck_id?: string | null;
  status: ConsultationStatus;
  priority_score: number;
  booking_session_id?: string | null;
  consultation_link?: string | null;
  diagnosis?: string | null;
  prescription?: string | null;
  recommendations?: string | null;
  follow_up_notes?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  patients?: Patient;
  consultation_types?: Pick<ConsultationType, 'display_name' | 'name'>;
  medical_prechecks?: MedicalPrecheck | null;
}

export interface Payment {
  id: string;
  consultation_id: string;
  stripe_payment_id?: string | null;
  stripe_session_id?: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
  consultations?: {
    patients: Pick<Patient, 'full_name' | 'email'>;
    consultation_types: Pick<ConsultationType, 'display_name'>;
  };
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  details: any;
  ip_address?: string | null;
  created_at: string;
}

export interface TrackingData {
  consultation_id: string;
  status: ConsultationStatus;
  consultation_link: string | null;
  consultation_type: string;
  duration_minutes?: number;
  price_cents?: number;
  priority_score?: number;
  created_at: string;
  scheduled_at: string | null;

  // Patient Info
  patient_id?: string;
  patient_name: string;
  patient_email?: string;
  patient_phone?: string;
  date_of_birth?: string;
  nationality?: string;
  passport_number?: string;
  passport_expiry?: string | null;
  hotel_address?: string | null;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string | null;
  tracking_code?: string;

  // Medical Precheck Info
  chief_complaint?: string;
  symptoms?: string[];
  symptom_duration?: string | null;
  allergies?: string | null;
  current_medications?: string | null;
  medical_history?: string | null;
  has_chronic_conditions?: boolean;
  chronic_conditions_detail?: string | null;
  file_urls?: string[];

  // Doctor diagnosis & prescription (when available)
  diagnosis?: string | null;
  prescription?: string | null;
  recommendations?: string | null;
  follow_up_notes?: string | null;
}

export interface DoctorReportsData {
  overview: {
    totalConsultations: number;
    completedConsultations: number;
    pendingConsultations: number;
    cancelledConsultations: number;
    paidConsultations: number;
    inProgressConsultations: number;
  };
  statusDistribution: Array<{
    name: string;
    value: number;
    status: string;
    fill: string;
  }>;
  typeBreakdown: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      label: string;
      total: number;
      completed: number;
      cancelled: number;
      active: number;
    }>;
    monthly: Array<{
      month: string;
      label: string;
      total: number;
      completed: number;
      cancelled: number;
    }>;
  };
  patientAnalytics: {
    totalPatients: number;
    newPatientsPeriod: number;
    newPatients7d: number;
    newPatients30d: number;
    registrationTrends: Array<{
      date: string;
      label: string;
      count: number;
    }>;
  };
  doctorAnalytics: {
    totalDoctors: number;
    activeDoctors: number;
    doctors: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      consultationsHandled: number;
      inQueue: number;
      status: string;
    }>;
  };
  recentActivity: Array<{
    id: string;
    status: string;
    priority_score: number;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    patient_name: string;
    patient_email: string;
    nationality: string;
    consultation_type: string;
  }>;
  filterRange: string;
}

export interface FinancialReportsData {
  financialOverview: {
    totalRevenue: number;
    monthlyRevenue: number;
    pendingAmount: number;
    refundedAmount: number;
  };
  paymentAnalytics: {
    successfulPayments: number;
    failedPayments: number;
    pendingTransactions: number;
    refundedTransactions: number;
    totalTransactions: number;
  };
  revenueAnalytics: {
    daily: Array<{ date: string; label: string; revenue: number; count: number }>;
    monthly: Array<{ month: string; label: string; revenue: number; count: number }>;
    yearly: Array<{ year: string; label: string; revenue: number; count: number }>;
    byType: Array<{ type: string; typeKey: string; revenue: number; count: number; percentage: number }>;
  };
  transactions: Array<{
    id: string;
    consultationId: string;
    amountCents: number;
    currency: string;
    status: string;
    cardBrand: string;
    cardLast4: string;
    stripePaymentId: string;
    createdAt: string;
    patientName: string;
    patientEmail: string;
    consultationType: string;
    consultationTypeKey: string;
  }>;
  filters: {
    range: string;
    status: string;
    type: string;
  };
}

