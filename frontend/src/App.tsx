import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import LoadingScreen from "@/components/LoadingScreen";

import Index from "./pages/Index";
import HowItWorks from "./pages/HowItWorks";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import EmergencyDisclaimer from "./pages/EmergencyDisclaimer";
import Login from "./pages/Login";

import IntakeForm from "./pages/patient/IntakeForm";
import MedicalPreCheck from "./pages/patient/MedicalPreCheck";
import ConsultationSelection from "./pages/patient/ConsultationSelection";
import Payment from "./pages/patient/Payment";
import StatusTracking from "./pages/patient/StatusTracking";

import DoctorDashboard from "./pages/doctor/Dashboard";
import DoctorReports from "./pages/doctor/Reports";

import AdminSettings from "./pages/admin/Settings";
import AdminPayments from "./pages/admin/Payments";
import AdminReports from "./pages/admin/Reports";
import AuditLogs from "./pages/admin/AuditLogs";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [initialLoading, setInitialLoading] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          {initialLoading && (
            <LoadingScreen onComplete={() => setInitialLoading(false)} />
          )}
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/emergency-disclaimer" element={<EmergencyDisclaimer />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin/login" element={<Login />} />

              {/* Patient Flow */}
              <Route path="/consultation/intake" element={<IntakeForm />} />
              <Route path="/consultation/medical-precheck" element={<MedicalPreCheck />} />
              <Route path="/consultation/select" element={<ConsultationSelection />} />
              <Route path="/consultation/payment" element={<Payment />} />
              <Route path="/track" element={<StatusTracking />} />

              {/* Doctor */}
              <Route path="/dashboard" element={<DoctorDashboard />} />
              <Route path="/dashboard/pricing" element={<AdminSettings />} />
              <Route path="/dashboard/reports" element={<DoctorReports />} />

              {/* Admin */}
              <Route path="/admin" element={<AdminSettings />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/audit-logs" element={<AuditLogs />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
