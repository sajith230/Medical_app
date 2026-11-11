import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PublicLayout from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Zap, Clock, MessageSquare } from "lucide-react";

interface ConsultationType {
  id: string;
  name: string;
  display_name: string;
  description: string;
  price_cents: number;
  duration_minutes: number;
  priority_score: number;
}

const icons: Record<string, any> = {
  priority: Zap,
  standard: Clock,
  short: MessageSquare,
};

export default function ConsultationSelection() {
  const [types, setTypes] = useState<ConsultationType[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const patientId = sessionStorage.getItem("patient_id");
  const precheckId = sessionStorage.getItem("precheck_id");

  const getBookingSessionId = (): string => {
    let sessionId = sessionStorage.getItem("booking_session_id");
    if (!sessionId) {
      sessionId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `bk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem("booking_session_id", sessionId);
    }
    return sessionId;
  };

  useEffect(() => {
    const savedTypeId = sessionStorage.getItem("selected_type_id");
    if (savedTypeId) {
      setSelected(savedTypeId);
    }

    api.consultations.getTypes().then(({ data }) => {
      if (data) setTypes(data as any as ConsultationType[]);
    });
  }, []);

  if (!patientId) {
    return (
      <PublicLayout>
        <div className="container py-16 text-center">
          <h2 className="text-2xl font-bold">Session Expired</h2>
          <p className="mt-2 text-muted-foreground">Please start over from the intake form.</p>
          <Button className="mt-4" onClick={() => navigate("/consultation/intake")}>Go to Intake Form</Button>
        </div>
      </PublicLayout>
    );
  }

  const handleContinue = async () => {
    if (!selected || loading) return;
    setLoading(true);

    const type = types.find((t) => t.id === selected)!;
    const bookingSessionId = getBookingSessionId();
    const existingConsultationId = sessionStorage.getItem("consultation_id");

    const { data: consultationId, error } = await api.consultations.create({
      consultation_id: existingConsultationId || undefined,
      booking_session_id: bookingSessionId,
      patient_id: patientId,
      consultation_type_id: selected,
      medical_precheck_id: precheckId || null,
      priority_score: type.priority_score,
    });

    if (error || !consultationId) {
      toast({ title: "Error", description: "Failed to create consultation.", variant: "destructive" });
      setLoading(false);
      return;
    }

    sessionStorage.setItem("consultation_id", consultationId);
    sessionStorage.setItem("selected_type_id", selected);
    sessionStorage.setItem("selected_type_price", String(type.price_cents));
    sessionStorage.setItem("selected_type_name", type.display_name);
    navigate("/consultation/payment");
  };

  return (
    <PublicLayout>
      <div className="container py-8">
        <div className="mx-auto max-w-3xl">
          <Progress value={60} className="mb-6" />
          <p className="mb-2 text-sm text-muted-foreground">Step 3 of 4</p>

          <h1 className="font-display text-2xl font-bold">Select Consultation Type</h1>
          <p className="mt-2 text-muted-foreground">Choose the consultation that best fits your needs.</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {types.map((type) => {
              const Icon = icons[type.name] || Clock;
              const isSelected = selected === type.id;
              return (
                <Card
                  key={type.id}
                  className={`cursor-pointer transition-all ${
                    isSelected ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"
                  } ${type.name === "priority" ? "relative" : ""}`}
                  onClick={() => setSelected(type.id)}
                >
                  {type.name === "priority" && (
                    <Badge className="absolute -top-2 right-4 bg-destructive text-destructive-foreground">
                      Urgent
                    </Badge>
                  )}
                  <CardHeader className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{type.display_name}</CardTitle>
                    <CardDescription>{type.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      ${(type.price_cents / 100).toFixed(0)}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{type.duration_minutes} minutes</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Button
            className="mt-8 w-full"
            size="lg"
            disabled={!selected || loading}
            onClick={handleContinue}
          >
            {loading ? "Processing..." : "Continue to Payment"}
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
