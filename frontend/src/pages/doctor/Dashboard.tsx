import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { maskPassport, maskPhone } from "@/lib/validators";
import { Eye, Send, RefreshCw, Users, Clock, CheckCircle2, Mail, Loader2, Paperclip, ZoomIn, Copy, FileText, ExternalLink, Image as ImageIcon, AlertTriangle } from "lucide-react";

interface PreviewDocState {
  rawUrl: string;
  viewUrl: string;
  fileName: string;
  isPdf: boolean;
  isImage: boolean;
}

interface ConsultationRow {
  id: string;
  status: string;
  priority_score: number;
  consultation_link: string | null;
  diagnosis: string | null;
  prescription: string | null;
  recommendations: string | null;
  follow_up_notes: string | null;
  created_at: string;
  patients: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    date_of_birth: string;
    nationality: string;
    passport_number: string;
    hotel_address: string | null;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    tracking_code: string;
  };
  consultation_types: {
    display_name: string;
    name: string;
  };
  medical_prechecks: {
    chief_complaint: string;
    symptoms: string[];
    symptom_duration: string;
    allergies: string | null;
    current_medications: string | null;
    medical_history: string | null;
    has_chronic_conditions: boolean;
    chronic_conditions_detail: string | null;
    file_urls?: string[];
  } | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  scheduled: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  referred: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function DoctorDashboard() {
  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [selected, setSelected] = useState<ConsultationRow | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [consultLink, setConsultLink] = useState("");
  const [diagnosisForm, setDiagnosisForm] = useState({ diagnosis: "", prescription: "", recommendations: "", follow_up_notes: "" });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [savingDiagnosis, setSavingDiagnosis] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PreviewDocState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleOpenPreview = (doc: PreviewDocState) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    setPreviewError(null);
  };

  const fetchConsultations = useCallback(async () => {
    const { data } = await api.consultations.getQueue();
    if (data) setConsultations(data as unknown as ConsultationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConsultations();
    const interval = setInterval(fetchConsultations, 30000);
    return () => clearInterval(interval);
  }, [fetchConsultations]);

  const openDetail = (c: ConsultationRow) => {
    setSelected(c);
    setConsultLink(c.consultation_link || "");
    setDiagnosisForm({
      diagnosis: c.diagnosis || "",
      prescription: c.prescription || "",
      recommendations: c.recommendations || "",
      follow_up_notes: c.follow_up_notes || "",
    });
    setShowDetail(true);
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();

    await api.consultations.update(id, updates);
    toast({ title: "Status Updated" });
    fetchConsultations();
    setShowDetail(false);
  };

  const saveLink = async (id: string) => {
    setSavingLink(true);
    try {
      const res = await api.consultations.update(id, { consultation_link: consultLink });
      if (res.emailResult?.success) {
        toast({
          title: "Link Saved & Emailed",
          description: `Meeting link delivered to ${selected?.patients?.email || "patient"}.`,
        });
      } else {
        toast({ title: "Consultation Link Saved" });
      }
      fetchConsultations();
    } catch (err: any) {
      toast({ title: "Error Saving Link", description: err.message, variant: "destructive" });
    } finally {
      setSavingLink(false);
    }
  };

  const saveDiagnosis = async (id: string, sendEmail = true) => {
    setSavingDiagnosis(true);
    try {
      const res = await api.consultations.update(id, {
        ...diagnosisForm,
        sendEmail,
      });

      if (res.emailResult?.success) {
        toast({
          title: "Diagnosis Saved & Emailed",
          description: `Consultation summary sent to ${selected?.patients?.email || "patient"}.`,
        });
      } else if (res.emailResult?.skipped) {
        toast({
          title: "Diagnosis Saved",
          description: "Saved! Note: RESEND_API_KEY is not configured in server/.env yet.",
        });
      } else if (res.emailResult?.error) {
        toast({
          title: "Diagnosis Saved",
          description: `Saved! Email delivery note: ${res.emailResult.error}`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Diagnosis Saved Successfully" });
      }

      fetchConsultations();
    } catch (err: any) {
      toast({
        title: "Error Saving Diagnosis",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingDiagnosis(false);
    }
  };

  const handleSendEmail = async (id: string) => {
    if (!selected?.patients?.email) {
      toast({
        title: "No Email Found",
        description: "This patient does not have an email address recorded.",
        variant: "destructive",
      });
      return;
    }

    setSendingEmail(true);
    try {
      const res = await api.consultations.sendEmail(id);
      if (res.emailResult?.success || res.data?.success) {
        toast({
          title: "Email Sent Successfully",
          description: `Consultation summary delivered to ${selected.patients.email}`,
        });
      } else if (res.emailResult?.skipped) {
        toast({
          title: "API Key Missing",
          description: "Please configure RESEND_API_KEY in server/.env to send real emails.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email Failed",
          description: res.emailResult?.error || res.error?.message || "Could not send email.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Error Sending Email", description: err.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const stats = {
    total: consultations.length,
    waiting: consultations.filter((c) => ["pending", "paid"].includes(c.status)).length,
    inProgress: consultations.filter((c) => c.status === "in_progress").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Consultation Queue</h1>
          <Button variant="outline" size="sm" onClick={fetchConsultations}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <Clock className="h-8 w-8 text-medical-warning" />
              <div>
                <p className="text-2xl font-bold">{stats.waiting}</p>
                <p className="text-sm text-muted-foreground">Waiting</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <CheckCircle2 className="h-8 w-8 text-medical-success" />
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : consultations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No active consultations in the queue.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {consultations.map((c) => (
              <Card key={c.id} className="transition-colors hover:bg-secondary/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                      c.consultation_types?.name === "priority"
                        ? "bg-destructive/10 text-destructive"
                        : c.consultation_types?.name === "standard"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {c.priority_score}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{c.patients?.full_name || "Patient"}</p>
                        {Array.isArray(c.medical_prechecks?.file_urls) && c.medical_prechecks.file_urls.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary" title={`${c.medical_prechecks.file_urls.length} medical document(s) uploaded`}>
                            <Paperclip className="h-3 w-3" /> {c.medical_prechecks.file_urls.length}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {c.consultation_types?.display_name || "Consultation"} · {c.patients?.nationality || "Visitor"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={statusColors[c.status] || "bg-gray-100 text-gray-800"}>
                      {(c.status || "pending").replace("_", " ")}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => openDetail(c)}>
                      <Eye className="mr-1 h-4 w-4" /> View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
                  {selected.patients?.full_name || "Patient Consultation"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Patient Info */}
                <div>
                  <h3 className="mb-2 font-semibold">Patient Info</h3>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div><span className="text-muted-foreground">Email:</span> {selected.patients?.email || "N/A"}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {selected.patients?.phone ? maskPhone(selected.patients.phone) : "N/A"}</div>
                    <div><span className="text-muted-foreground">DOB:</span> {selected.patients?.date_of_birth || "N/A"}</div>
                    <div><span className="text-muted-foreground">Nationality:</span> {selected.patients?.nationality || "N/A"}</div>
                    <div><span className="text-muted-foreground">Passport:</span> {selected.patients?.passport_number ? maskPassport(selected.patients.passport_number) : "N/A"}</div>
                    <div><span className="text-muted-foreground">Tracking:</span> <span className="font-mono">{selected.patients?.tracking_code || "N/A"}</span></div>
                  </div>
                </div>

                {/* Medical Info */}
                {selected.medical_prechecks && (
                  <div>
                    <h3 className="mb-2 font-semibold">Medical Pre-Check</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-muted-foreground">Chief Complaint:</span> {selected.medical_prechecks.chief_complaint}</div>
                      <div><span className="text-muted-foreground">Symptoms:</span> {selected.medical_prechecks.symptoms?.join(", ")}</div>
                      <div><span className="text-muted-foreground">Duration:</span> {selected.medical_prechecks.symptom_duration}</div>
                      {selected.medical_prechecks.allergies && <div><span className="text-muted-foreground">Allergies:</span> {selected.medical_prechecks.allergies}</div>}
                      {selected.medical_prechecks.current_medications && <div><span className="text-muted-foreground">Medications:</span> {selected.medical_prechecks.current_medications}</div>}
                      {selected.medical_prechecks.medical_history && <div><span className="text-muted-foreground">History:</span> {selected.medical_prechecks.medical_history}</div>}
                      {selected.medical_prechecks.has_chronic_conditions && <div><span className="text-muted-foreground">Chronic:</span> {selected.medical_prechecks.chronic_conditions_detail}</div>}
                    </div>
                  </div>
                )}

                {/* Uploaded Medical Documents / Attachments */}
                {selected && (
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm">Uploaded Medical Documents & Reports</h3>
                      </div>
                      {(() => {
                        const urls = Array.isArray(selected.medical_prechecks?.file_urls)
                          ? selected.medical_prechecks.file_urls
                          : typeof selected.medical_prechecks?.file_urls === 'string'
                          ? JSON.parse(selected.medical_prechecks.file_urls || '[]')
                          : [];
                        return urls.length > 0 ? (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 font-medium">
                            {urls.length} {urls.length === 1 ? "Document" : "Documents"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Optional</span>
                        );
                      })()}
                    </div>

                    {(() => {
                      const urls: string[] = Array.isArray(selected.medical_prechecks?.file_urls)
                        ? selected.medical_prechecks.file_urls
                        : typeof selected.medical_prechecks?.file_urls === 'string'
                        ? JSON.parse(selected.medical_prechecks.file_urls || '[]')
                        : [];

                      if (urls.length === 0) {
                        return (
                          <div className="rounded-lg border border-dashed py-3.5 text-center text-xs text-muted-foreground bg-background/50">
                            No medical documents or lab reports attached for this consultation.
                          </div>
                        );
                      }

                      return (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {urls.map((rawUrl, idx) => {
                            const cleanUrl = rawUrl.split('?')[0];
                            const rawName = cleanUrl.split('/').pop() || `Document ${idx + 1}`;
                            const fileName = decodeURIComponent(rawName);
                            const isPdf = /\.pdf($|\?)/i.test(cleanUrl);
                            const isImage = /\.(jpg|jpeg|png|webp|gif|svg)($|\?)/i.test(cleanUrl);
                            const authorizedViewUrl = api.documents.getViewUrl(rawUrl);

                            const docState: PreviewDocState = {
                              rawUrl,
                              viewUrl: authorizedViewUrl,
                              fileName,
                              isPdf,
                              isImage,
                            };

                            return (
                              <div
                                key={idx}
                                className="group relative flex flex-col justify-between overflow-hidden rounded-lg border bg-card p-3 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm"
                              >
                                <div className="flex items-start gap-3">
                                  {/* Preview thumbnail or PDF Icon */}
                                  {isPdf ? (
                                    <div
                                      className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400 font-bold text-[10px] cursor-pointer hover:bg-red-200 transition-colors"
                                      onClick={() => handleOpenPreview(docState)}
                                      title="Click to preview PDF document"
                                    >
                                      <FileText className="h-6 w-6 mb-0.5" />
                                      PDF
                                    </div>
                                  ) : isImage ? (
                                    <div
                                      className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-md border bg-muted"
                                      onClick={() => handleOpenPreview(docState)}
                                      title="Click to zoom image"
                                    >
                                      <img
                                        src={authorizedViewUrl}
                                        alt={fileName}
                                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                                        <ZoomIn className="h-4 w-4 text-white" />
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground cursor-pointer"
                                      onClick={() => handleOpenPreview(docState)}
                                    >
                                      <Paperclip className="h-6 w-6" />
                                    </div>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-foreground" title={fileName}>
                                      {fileName}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1">
                                      {rawUrl.includes('cloudinary.com') ? (
                                        <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                                          Cloudinary Secure Cloud
                                        </span>
                                      ) : (
                                        <span>Medical Attachment</span>
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 flex items-center gap-2 border-t pt-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs flex-1"
                                    onClick={() => handleOpenPreview(docState)}
                                  >
                                    <ZoomIn className="mr-1 h-3.5 w-3.5" /> Preview
                                  </Button>
                                  <Button
                                    asChild
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs flex-1"
                                  >
                                    <a href={authorizedViewUrl} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
                                    </a>
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      navigator.clipboard.writeText(authorizedViewUrl);
                                      toast({ title: "Link Copied", description: "Secure document URL copied to clipboard." });
                                    }}
                                    title="Copy direct document URL"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Consultation Link */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">Consultation Link</h3>
                    {selected.patients?.email && (
                      <span className="text-xs text-muted-foreground">
                        Emails to: {selected.patients.email}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={consultLink}
                      onChange={(e) => setConsultLink(e.target.value)}
                      placeholder="WhatsApp or Google Meet link..."
                    />
                    <Button size="sm" onClick={() => saveLink(selected.id)} disabled={savingLink}>
                      {savingLink ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                      Save & Email Link
                    </Button>
                  </div>
                </div>

                {/* Diagnosis Form */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-semibold">Diagnosis & Notes</h3>
                    {selected.patients?.email && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 text-primary" /> Recipient: <strong>{selected.patients.email}</strong>
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Diagnosis</Label>
                      <Textarea
                        value={diagnosisForm.diagnosis}
                        onChange={(e) => setDiagnosisForm((f) => ({ ...f, diagnosis: e.target.value }))}
                        rows={3}
                        placeholder="Enter clinical assessment or findings..."
                      />
                    </div>
                    <div>
                      <Label>Prescription</Label>
                      <Textarea
                        value={diagnosisForm.prescription}
                        onChange={(e) => setDiagnosisForm((f) => ({ ...f, prescription: e.target.value }))}
                        rows={2}
                        placeholder="Medications, dosage, and instructions (Rx)..."
                      />
                    </div>
                    <div>
                      <Label>Recommendations</Label>
                      <Textarea
                        value={diagnosisForm.recommendations}
                        onChange={(e) => setDiagnosisForm((f) => ({ ...f, recommendations: e.target.value }))}
                        rows={2}
                        placeholder="Medical advice, precautions, or dietary recommendations..."
                      />
                    </div>
                    <div>
                      <Label>Follow-up Notes</Label>
                      <Textarea
                        value={diagnosisForm.follow_up_notes}
                        onChange={(e) => setDiagnosisForm((f) => ({ ...f, follow_up_notes: e.target.value }))}
                        rows={2}
                        placeholder="Follow-up timeframe or monitoring instructions..."
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button onClick={() => saveDiagnosis(selected.id, true)} disabled={savingDiagnosis}>
                        {savingDiagnosis ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                        Save Diagnosis & Email Patient
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleSendEmail(selected.id)}
                        disabled={sendingEmail || savingDiagnosis}
                      >
                        {sendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Email Patient Summary
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Status Actions */}
                <div>
                  <h3 className="mb-2 font-semibold">Update Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.status === "paid" && (
                      <Button onClick={() => updateStatus(selected.id, "in_progress")}>Start Consultation</Button>
                    )}
                    {selected.status === "in_progress" && (
                      <>
                        <Button onClick={() => updateStatus(selected.id, "completed")} className="bg-medical-success hover:bg-medical-success/90">Mark Completed</Button>
                        <Button variant="outline" onClick={() => updateStatus(selected.id, "referred")}>Refer Patient</Button>
                      </>
                    )}
                    <Button variant="destructive" onClick={() => updateStatus(selected.id, "cancelled")}>Cancel</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog (PDF & Images) */}
      <Dialog open={Boolean(previewDoc)} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] p-4 flex flex-col items-center">
          <DialogHeader className="w-full flex flex-row items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2 max-w-[70%]">
              {previewDoc?.isPdf ? (
                <FileText className="h-5 w-5 text-red-500 shrink-0" />
              ) : (
                <ImageIcon className="h-5 w-5 text-primary shrink-0" />
              )}
              <DialogTitle className="text-sm font-semibold truncate" title={previewDoc?.fileName}>
                {previewDoc?.fileName || "Medical Document Preview"}
              </DialogTitle>
            </div>
            {previewDoc && (
              <Button asChild size="sm" variant="outline" className="h-8">
                <a href={previewDoc.viewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  {previewDoc.isPdf ? "Open Full Document" : "Open Full Image"}
                </a>
              </Button>
            )}
          </DialogHeader>

          {previewDoc && (
            <div className="relative flex-1 w-full flex items-center justify-center overflow-auto rounded-lg bg-muted/20 p-2 min-h-[50vh] max-h-[75vh]">
              {previewLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Loading secure document...</span>
                </div>
              )}

              {previewError ? (
                <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                  <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                  <h4 className="text-sm font-semibold text-foreground">Document Preview Unavailable</h4>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">{previewError}</p>
                  <Button asChild size="sm" variant="default">
                    <a href={previewDoc.viewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Try Opening in New Tab
                    </a>
                  </Button>
                </div>
              ) : previewDoc.isPdf ? (
                <iframe
                  src={previewDoc.viewUrl}
                  title={previewDoc.fileName}
                  className="w-full h-[72vh] rounded border bg-white shadow-xs"
                  onLoad={() => setPreviewLoading(false)}
                  onError={() => {
                    setPreviewLoading(false);
                    setPreviewError("Unable to embed PDF preview. Please open the document in a new tab.");
                  }}
                />
              ) : (
                <img
                  src={previewDoc.viewUrl}
                  alt={previewDoc.fileName}
                  className="max-h-[72vh] w-auto max-w-full rounded object-contain shadow-md"
                  onLoad={() => setPreviewLoading(false)}
                  onError={() => {
                    setPreviewLoading(false);
                    setPreviewError("Failed to load image preview. Please open the document in a new tab.");
                  }}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
