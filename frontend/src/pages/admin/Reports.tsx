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
import type { FinancialReportsData } from "@/types/database";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Printer,
  RefreshCw,
  Copy,
  Receipt,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useToast } from "@/hooks/use-toast";

const TYPE_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function AdminReports() {
  const [data, setData] = useState<FinancialReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Filters state
  const [range, setRange] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const fetchFinancials = useCallback(async () => {
    setRefreshing(true);
    const res = await api.reports.getAdminStats({ range, status, type });
    if (res.data) {
      setData(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [range, status, type]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  // Financial CSV Export
  const exportCSV = () => {
    if (!data) return;
    const rows = [
      [
        "Transaction ID",
        "Consultation ID",
        "Date",
        "Patient Name",
        "Patient Email",
        "Consultation Type",
        "Amount (USD)",
        "Payment Method",
        "Card Last 4",
        "Status",
      ],
    ];

    data.transactions.forEach((t) => {
      rows.push([
        t.stripePaymentId,
        t.consultationId,
        new Date(t.createdAt).toLocaleDateString(),
        `"${t.patientName.replace(/"/g, '""')}"`,
        t.patientEmail,
        `"${t.consultationType.replace(/"/g, '""')}"`,
        (t.amountCents / 100).toFixed(2),
        t.cardBrand,
        t.cardLast4,
        t.status,
      ]);
    });

    const csvContent = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial_ledger_${range}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case "completed":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700">Completed</Badge>;
      case "pending":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "refunded":
        return <Badge variant="outline" className="text-blue-600 border-blue-200">Refunded</Badge>;
      default:
        return <Badge variant="outline">{statusStr}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-medium">Loading financial reports & revenue data...</p>
        </div>
      </DashboardLayout>
    );
  }

  const overview = data?.financialOverview || {
    totalRevenue: 0,
    monthlyRevenue: 0,
    pendingAmount: 0,
    refundedAmount: 0,
  };

  const paymentStats = data?.paymentAnalytics || {
    successfulPayments: 0,
    failedPayments: 0,
    pendingTransactions: 0,
    refundedTransactions: 0,
    totalTransactions: 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 print:m-0 print:p-0">
        {/* Page Header with Actions & Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-6 w-6 text-emerald-600" />
              <h1 className="font-display text-2xl font-bold tracking-tight">Financial Reports</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Verified revenue analytics, payment volume, transaction ledger, and financial reconciliation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={fetchFinancials}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={exportCSV}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>

            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handlePrint}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
            </Button>
          </div>
        </div>

        {/* Filters Bar */}
        <Card className="border shadow-xs print:hidden">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                <Filter className="h-3.5 w-3.5" /> Filters:
              </div>

              {/* Date Range Filter */}
              <div className="w-[140px]">
                <Select value={range} onValueChange={setRange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="w-[150px]">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Payment status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed (Paid)</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Consultation Type Filter */}
              <div className="w-[160px]">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Consultation type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Consultation Types</SelectItem>
                    <SelectItem value="priority">Priority Consultation</SelectItem>
                    <SelectItem value="standard">Standard Consultation</SelectItem>
                    <SelectItem value="short">Short Consultation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(range !== "all" || status !== "all" || type !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setRange("all");
                    setStatus("all");
                    setType("all");
                  }}
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 1. Financial Overview Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Revenue */}
          <Card className="border shadow-xs border-emerald-500/20 bg-gradient-to-br from-card to-emerald-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Verified Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-emerald-600">
                {formatCurrency(overview.totalRevenue)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Successful completed settlements
              </p>
            </CardContent>
          </Card>

          {/* Monthly Revenue */}
          <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly Revenue
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {formatCurrency(overview.monthlyRevenue)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Current calendar month intake
              </p>
            </CardContent>
          </Card>

          {/* Pending Amount */}
          <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pending Settlements
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-amber-600">
                {formatCurrency(overview.pendingAmount)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {paymentStats.pendingTransactions} awaiting gateway capture
              </p>
            </CardContent>
          </Card>

          {/* Refunded Amount */}
          <Card className="border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Refunded Amount
              </CardTitle>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-muted-foreground">
                {formatCurrency(overview.refundedAmount)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {paymentStats.refundedTransactions} reversed transactions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2. Revenue Analytics Charts */}
        <div className="grid gap-6 lg:grid-cols-7">
          {/* Revenue Trends Chart (4 columns) */}
          <Card className="border shadow-xs lg:col-span-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Revenue Trends</CardTitle>
                  <CardDescription className="text-xs">
                    Historical revenue inflow dynamically calculated from verified payments
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="daily" className="w-full">
                <TabsList className="mb-4 grid w-64 grid-cols-3">
                  <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
                  <TabsTrigger value="yearly" className="text-xs">Yearly</TabsTrigger>
                </TabsList>

                <TabsContent value="daily">
                  {data?.revenueAnalytics.daily && data.revenueAnalytics.daily.length > 0 ? (
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.revenueAnalytics.daily} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `$${v / 100}`}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number) => [`$${(v / 100).toFixed(2)}`, "Revenue"]}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            name="Revenue"
                            stroke="#10b981"
                            fillOpacity={1}
                            fill="url(#colorRev)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
                      No revenue recorded for this period.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="monthly">
                  {data?.revenueAnalytics.monthly && data.revenueAnalytics.monthly.length > 0 ? (
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.revenueAnalytics.monthly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 100}`} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number) => [`$${(v / 100).toFixed(2)}`, "Revenue"]}
                          />
                          <Bar dataKey="revenue" name="Monthly Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
                      No monthly data available.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="yearly">
                  {data?.revenueAnalytics.yearly && data.revenueAnalytics.yearly.length > 0 ? (
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.revenueAnalytics.yearly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 100}`} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number) => [`$${(v / 100).toFixed(2)}`, "Revenue"]}
                          />
                          <Bar dataKey="revenue" name="Yearly Revenue" fill="#059669" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
                      No yearly records available.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Revenue by Consultation Type (3 columns) */}
          <Card className="border shadow-xs lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Revenue by Consultation Type</CardTitle>
              <CardDescription className="text-xs">
                Revenue contribution by service offering
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.revenueAnalytics.byType && data.revenueAnalytics.byType.length > 0 ? (
                <div className="flex flex-col items-center">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.revenueAnalytics.byType}
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="revenue"
                        >
                          {data.revenueAnalytics.byType.map((_, index) => (
                            <Cell key={`type-cell-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => [`$${(v / 100).toFixed(2)}`, "Revenue"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="w-full space-y-2 mt-2">
                    {data.revenueAnalytics.byType.map((item, idx) => (
                      <div key={item.type} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: TYPE_COLORS[idx % TYPE_COLORS.length] }}
                          />
                          <span className="font-medium">{item.type}</span>
                        </div>
                        <span className="font-semibold">{formatCurrency(item.revenue)} ({item.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
                  No revenue data by type available.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 3. Payment Volume & Gateway Statistics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{paymentStats.successfulPayments}</div>
                <div className="text-xs text-muted-foreground">Successful Payments</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-amber-500/10 p-2 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{paymentStats.pendingTransactions}</div>
                <div className="text-xs text-muted-foreground">Pending Transactions</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-destructive/10 p-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{paymentStats.failedPayments}</div>
                <div className="text-xs text-muted-foreground">Failed Payments</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-xs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-blue-500/10 p-2 text-blue-600">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold">{paymentStats.refundedTransactions}</div>
                <div className="text-xs text-muted-foreground">Refunded Transactions</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 4. Payment History Table (Ledger) */}
        <Card className="border shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Payment Transactions Ledger</CardTitle>
              <CardDescription className="text-xs">
                Comprehensive audit trail of customer payments and gateway settlements
              </CardDescription>
            </div>
            {data?.transactions && (
              <Badge variant="outline" className="text-xs font-medium">
                {data.transactions.length} Transactions
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Transaction Ref</TableHead>
                    <TableHead>Consultation Type</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.transactions && data.transactions.length > 0 ? (
                    data.transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-foreground">{t.patientName}</div>
                          {t.patientEmail && (
                            <div className="text-[11px] text-muted-foreground">{t.patientEmail}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                            <span>{t.stripePaymentId}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(t.stripePaymentId);
                                toast({ title: "Copied", description: "Transaction ID copied to clipboard." });
                              }}
                              className="hover:text-foreground"
                              title="Copy transaction ID"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{t.consultationType}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{t.cardBrand} •••• {t.cardLast4}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-xs text-foreground whitespace-nowrap">
                          {formatCurrency(t.amountCents)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {getStatusBadge(t.status)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                        No financial records found matching the active filters.
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
