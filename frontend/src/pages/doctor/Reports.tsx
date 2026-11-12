import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { api } from "@/services/api";
import type { DoctorReportsData } from "@/types/database";
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  Printer,
  RefreshCw,
  BarChart3,
  TrendingUp,
  UserCheck,
  Stethoscope,
  Activity,
  Calendar,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function DoctorReports() {
  const [data, setData] = useState<DoctorReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = useCallback(async (selectedRange: string) => {
    setRefreshing(true);
    const res = await api.reports.getDoctorStats(selectedRange);
    if (res.data) {
      setData(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchReports(range);
  }, [range, fetchReports]);

  // CSV Export for Consultation Analytics
  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ["Consultation ID", "Date", "Patient Name", "Email", "Nationality", "Type", "Priority Score", "Status"],
    ];

    data.recentActivity.forEach((c) => {
      rows.push([
        c.id,
        new Date(c.created_at).toLocaleDateString(),
        `"${c.patient_name.replace(/"/g, '""')}"`,
        c.patient_email,
        c.nationality,
        `"${c.consultation_type.replace(/"/g, '""')}"`,
        String(c.priority_score),
        c.status,
      ]);
    });

    const csvContent = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `consultation_analytics_${range}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700">Completed</Badge>;
      case "paid":
        return <Badge className="bg-blue-600 hover:bg-blue-700">Paid (In Queue)</Badge>;
      case "in_progress":
        return <Badge className="bg-purple-600 hover:bg-purple-700">In Progress</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400">Pending</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-medium">Loading clinical reports & analytics...</p>
        </div>
      </DashboardLayout>
    );
  }

  const overview = data?.overview || {
    totalConsultations: 0,
    completedConsultations: 0,
    pendingConsultations: 0,
    cancelledConsultations: 0,
    paidConsultations: 0,
    inProgressConsultations: 0,
  };

  const completionRate = overview.totalConsultations > 0
    ? Math.round((overview.completedConsultations / overview.totalConsultations) * 100)
    : 0;

  const inQueueCount = overview.paidConsultations + overview.inProgressConsultations + overview.pendingConsultations;

  return (
    <DashboardLayout>
      <div className="space-y-6 print:m-0 print:p-0">
        {/* Header with Title and Global Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="font-display text-2xl font-bold tracking-tight">Reports & Analytics</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Consultation trends, patient demographics, clinical volume, and doctor productivity metrics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <Calendar className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => fetchReports(range)}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleExportCSV}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>

            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handlePrint}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>

        {/* 1. Overview Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Consultations */}
          <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Consultations
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{overview.totalConsultations}</div>
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3 text-emerald-500" />
                <span>Across all consultation channels</span>
              </p>
            </CardContent>
          </Card>

          {/* Completed Consultations */}
          <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Completed
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{overview.completedConsultations}</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Completion rate</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{completionRate}%</span>
              </div>
            </CardContent>
          </Card>

          {/* In Queue / Pending */}
          <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                In Queue & Active
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{inQueueCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {overview.paidConsultations} paid waiting, {overview.pendingConsultations} intake pending
              </p>
            </CardContent>
          </Card>

          {/* Cancelled Consultations */}
          <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cancelled
              </CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{overview.cancelledConsultations}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Replaced or abandoned bookings
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2. Consultation Analytics: Trends & Status Distribution */}
        <div className="grid gap-6 lg:grid-cols-7">
          {/* Trends Area Chart (4 columns) */}
          <Card className="border shadow-xs lg:col-span-4">
            <CardHeader className="pb-3">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Consultation Trends</CardTitle>
                  <CardDescription className="text-xs">
                    Volume of booked, completed, and active consultations over time
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="daily" className="w-full">
                <TabsList className="mb-4 grid w-48 grid-cols-2">
                  <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
                </TabsList>

                <TabsContent value="daily">
                  {data?.trends.daily && data.trends.daily.length > 0 ? (
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.trends.daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                          <Area type="monotone" dataKey="total" name="Total Bookings" stroke="#2563eb" fillOpacity={1} fill="url(#colorTotal)" />
                          <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" fillOpacity={1} fill="url(#colorCompleted)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
                      No trend data available for this range.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="monthly">
                  {data?.trends.monthly && data.trends.monthly.length > 0 ? (
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.trends.monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                          <Bar dataKey="total" name="Total Volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
                      No monthly trend data available.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Status Distribution Donut Chart (3 columns) */}
          <Card className="border shadow-xs lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Status Distribution</CardTitle>
              <CardDescription className="text-xs">
                Breakdown of consultations by current processing state
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.statusDistribution && data.statusDistribution.length > 0 ? (
                <div className="flex flex-col items-center">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.statusDistribution}
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {data.statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="w-full space-y-2 mt-2">
                    {data.statusDistribution.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <span className="text-muted-foreground font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
                  No status data available.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 3. Consultation Types & Patient Analytics */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Consultation Type Breakdown */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Consultation Type Breakdown</CardTitle>
              <CardDescription className="text-xs">
                Patient demand by tier: Priority vs Standard vs Short consultations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data?.typeBreakdown && data.typeBreakdown.length > 0 ? (
                data.typeBreakdown.map((item) => (
                  <div key={item.type} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{item.type}</span>
                      <span className="text-muted-foreground font-semibold">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No consultation type records found.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Patient Analytics & Registration Trends */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Patient Analytics</CardTitle>
                  <CardDescription className="text-xs">
                    Patient registration metrics and acquisition trends
                  </CardDescription>
                </div>
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3 text-center">
                <div>
                  <div className="text-lg font-bold">{data?.patientAnalytics.totalPatients || 0}</div>
                  <div className="text-[11px] text-muted-foreground font-medium">Total Registered</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-primary">{data?.patientAnalytics.newPatientsPeriod || 0}</div>
                  <div className="text-[11px] text-muted-foreground font-medium">In Range</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-600">{data?.patientAnalytics.newPatients7d || 0}</div>
                  <div className="text-[11px] text-muted-foreground font-medium">Last 7 Days</div>
                </div>
              </div>

              {data?.patientAnalytics.registrationTrends && data.patientAnalytics.registrationTrends.length > 0 ? (
                <div className="h-[140px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.patientAnalytics.registrationTrends}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={25} />
                      <Tooltip contentStyle={{ borderRadius: 6, fontSize: 11 }} />
                      <Bar dataKey="count" name="New Patients" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Patient acquisition trend will chart automatically as new patients register.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 4. Doctor Analytics */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Doctor Activity & Productivity</CardTitle>
                <CardDescription className="text-xs">
                  Active physicians, consultations completed, and current workload queue
                </CardDescription>
              </div>
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead className="text-center">Consultations Completed</TableHead>
                  <TableHead className="text-center">Active Queue</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.doctorAnalytics.doctors && data.doctorAnalytics.doctors.length > 0 ? (
                  data.doctorAnalytics.doctors.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium text-xs sm:text-sm">
                        {doc.name}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{doc.role}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{doc.email}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600 text-xs sm:text-sm">
                        {doc.consultationsHandled}
                      </TableCell>
                      <TableCell className="text-center font-medium text-xs sm:text-sm">
                        {doc.inQueue}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400">
                          {doc.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                      No active doctors found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 5. Consultation Activity Ledger Table */}
        <Card className="border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Consultations Ledger</CardTitle>
              <CardDescription className="text-xs">
                Detailed record of patient consultations in the selected timeframe
              </CardDescription>
            </div>
            {data?.recentActivity && (
              <Badge variant="secondary" className="text-xs">
                {data.recentActivity.length} Records
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Consultation Type</TableHead>
                    <TableHead className="text-center">Priority</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recentActivity && data.recentActivity.length > 0 ? (
                    data.recentActivity.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-foreground">{c.patient_name}</div>
                          <div className="text-[11px] text-muted-foreground">{c.patient_email}</div>
                        </TableCell>
                        <TableCell className="text-xs">{c.nationality}</TableCell>
                        <TableCell className="text-xs">{c.consultation_type}</TableCell>
                        <TableCell className="text-center text-xs font-semibold">
                          {c.priority_score}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {getStatusBadge(c.status)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                        No consultations found for this filter range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
