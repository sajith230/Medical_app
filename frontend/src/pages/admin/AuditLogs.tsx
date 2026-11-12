import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api } from "@/services/api";
import type { AuditLog } from "@/types/database";
import { 
  Search, 
  RefreshCw, 
  Shield, 
  Stethoscope, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  ArrowUpDown 
} from "lucide-react";

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const itemsPerPage = 10;

  const fetchLogs = () => {
    setLoading(true);
    api.auditLogs.getAll().then(({ data }) => {
      if (data) setLogs(data as AuditLog[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getInitials = (name?: string | null) => {
    if (!name || name === "Unknown User") return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const renderRoleBadge = (role?: string | null) => {
    const normalized = (role || "unknown").toLowerCase();
    switch (normalized) {
      case "admin":
        return (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 gap-1 font-medium text-xs"
          >
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        );
      case "doctor":
        return (
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 gap-1 font-medium text-xs"
          >
            <Stethoscope className="h-3 w-3" />
            Doctor
          </Badge>
        );
      case "patient":
        return (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1 font-medium text-xs"
          >
            <User className="h-3 w-3" />
            Patient
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 font-medium text-xs"
          >
            Unknown
          </Badge>
        );
    }
  };

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => {
        // Role filter
        if (roleFilter !== "all") {
          const logRole = (log.user_role || "unknown").toLowerCase();
          if (logRole !== roleFilter) return false;
        }

        // Search query
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchUser = (log.user_name || "").toLowerCase().includes(q);
          const matchEmail = (log.user_email || "").toLowerCase().includes(q);
          const matchRole = (log.user_role || "").toLowerCase().includes(q);
          const matchAction = (log.action || "").toLowerCase().includes(q);
          const matchTable = (log.table_name || "").toLowerCase().includes(q);
          const matchDetails = log.details
            ? JSON.stringify(log.details).toLowerCase().includes(q)
            : false;
          return matchUser || matchEmail || matchRole || matchAction || matchTable || matchDetails;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [logs, search, roleFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const currentLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const toggleSort = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    setCurrentPage(1);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Audit Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track user activity, identity accountability, and system changes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters and Search Bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by actor, email, action..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={roleFilter}
            onValueChange={(val) => {
              setRoleFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] text-sm">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="doctor">Doctor</SelectItem>
              <SelectItem value="patient">Patient</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleSort}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
            {sortOrder === "desc" ? "Newest First" : "Oldest First"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <Card className="mt-4 border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[260px]">User / Actor</TableHead>
                    <TableHead className="w-[180px]">Action</TableHead>
                    <TableHead className="w-[130px]">Table</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/20">
                      {/* 1. Timestamp */}
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>

                      {/* 2. User / Actor */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground uppercase border border-border/50">
                            {getInitials(log.user_name)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground text-sm truncate max-w-[150px]">
                                {log.user_name || "Unknown User"}
                              </span>
                              {renderRoleBadge(log.user_role)}
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {log.user_email || "No email available"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* 3. Action */}
                      <TableCell>
                        <span className="inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                          {log.action}
                        </span>
                      </TableCell>

                      {/* 4. Table */}
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.table_name || "-"}
                        </span>
                      </TableCell>

                      {/* 5. Details */}
                      <TableCell className="py-3">
                        <div className="flex items-center justify-between gap-2 max-w-sm">
                          <span className="truncate font-mono text-xs text-muted-foreground">
                            {log.details ? (typeof log.details === "string" ? log.details : JSON.stringify(log.details)) : "-"}
                          </span>
                          {log.details && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => setSelectedLog(log)}
                              title="Inspect Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {currentLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                        {search || roleFilter !== "all"
                          ? "No audit logs match your search criteria."
                          : "No audit logs found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
                <div>
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of{" "}
                  {filteredLogs.length} audit logs
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Previous Page</span>
                  </Button>
                  <span className="px-2 font-medium text-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 px-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Next Page</span>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail Inspection Modal Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Audit Log Details</span>
              {selectedLog && renderRoleBadge(selectedLog.user_role)}
            </DialogTitle>
            <DialogDescription>
              Recorded on {selectedLog && new Date(selectedLog.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/20">
                <div>
                  <span className="text-xs text-muted-foreground block">Actor Name</span>
                  <span className="font-semibold text-foreground">
                    {selectedLog.user_name || "Unknown User"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Actor Email</span>
                  <span className="text-foreground">
                    {selectedLog.user_email || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Action</span>
                  <span className="font-mono text-xs font-semibold text-primary">
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Target Table</span>
                  <span className="font-mono text-xs text-foreground">
                    {selectedLog.table_name || "N/A"}
                  </span>
                </div>
                {selectedLog.record_id && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">Record ID</span>
                    <span className="font-mono text-xs text-muted-foreground break-all">
                      {selectedLog.record_id}
                    </span>
                  </div>
                )}
                {selectedLog.ip_address && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">IP Address</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {selectedLog.ip_address}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">
                  Payload / Details
                </span>
                <pre className="max-h-60 overflow-y-auto rounded-lg bg-muted p-3 text-xs font-mono text-foreground">
                  {typeof selectedLog.details === "string"
                    ? selectedLog.details
                    : JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
