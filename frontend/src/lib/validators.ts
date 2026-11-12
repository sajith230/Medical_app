import { z } from "zod";

export const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const patientIntakeSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().min(7, "Invalid phone number").max(20),
  date_of_birth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((val) => !val || val <= getTodayDateString(), {
      message: "Date of Birth cannot be a future date.",
    }),
  nationality: z.string().trim().min(2, "Nationality is required").max(100),
  passport_number: z.string().trim().min(5, "Invalid passport number").max(20),
  passport_expiry: z
    .string()
    .optional()
    .refine((val) => !val || val.trim() === "" || val >= getTodayDateString(), {
      message: "Passport Expiry Date cannot be in the past.",
    }),
  hotel_address: z.string().trim().max(500).optional(),
  emergency_contact_name: z.string().trim().min(2, "Emergency contact name is required").max(100),
  emergency_contact_phone: z.string().trim().min(7, "Invalid phone number").max(20),
  emergency_contact_relationship: z.string().trim().max(50).optional(),
  consent_given: z.literal(true, { errorMap: () => ({ message: "You must consent to proceed" }) }),
});

export const medicalPreCheckSchema = z.object({
  chief_complaint: z.string().trim().min(10, "Please describe your concern in detail").max(2000),
  symptoms: z.array(z.string()).min(1, "Select at least one symptom"),
  symptom_duration: z.string().trim().min(1, "How long have you had these symptoms?").max(200),
  allergies: z.string().trim().max(1000).optional(),
  current_medications: z.string().trim().max(1000).optional(),
  medical_history: z.string().trim().max(2000).optional(),
  has_chronic_conditions: z.boolean(),
  chronic_conditions_detail: z.string().trim().max(1000).optional(),
});

export const diagnosisSchema = z.object({
  diagnosis: z.string().trim().min(5, "Diagnosis is required").max(5000),
  prescription: z.string().trim().max(5000).optional(),
  recommendations: z.string().trim().max(5000).optional(),
  follow_up_notes: z.string().trim().max(5000).optional(),
});

export const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000),
});

export type PatientIntakeForm = z.infer<typeof patientIntakeSchema>;
export type MedicalPreCheckForm = z.infer<typeof medicalPreCheckSchema>;
export type DiagnosisForm = z.infer<typeof diagnosisSchema>;
export type ContactForm = z.infer<typeof contactFormSchema>;

export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateFile(file: File): string | null {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return "Only PDF and image files (JPEG, PNG, WebP) are allowed";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File size must be less than 5MB";
  }
  return null;
}

export function maskPassport(passport: string): string {
  if (passport.length <= 4) return "****";
  return "****" + passport.slice(-4);
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return phone.slice(0, 3) + "****" + phone.slice(-2);
}

export const SYMPTOM_OPTIONS = [
  "Fever", "Cough", "Headache", "Fatigue", "Nausea", "Vomiting",
  "Diarrhea", "Body aches", "Sore throat", "Shortness of breath",
  "Chest pain", "Abdominal pain", "Rash", "Dizziness",
  "Loss of appetite", "Joint pain", "Insomnia", "Other",
];
