import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MOCK_REQUESTS } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { RequestStatus } from "@/types/procurement";

type FilterStatus = "All" | "Pending" | "Approved" | "Rejected";

const PENDING_STATUSES: RequestStatus[] = ["Draft", "Submitted", "Under Review", "Open"];
const APPROVED_STATUSES: RequestStatus[] = ["Approved", "Complete"];
const REJECTED_STATUSES: RequestStatus[] = ["Rejected"];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("All");
  const [activeCard, setActiveCard] = useState<FilterStatus | null>(null);

  const requests = MOCK_REQUESTS;

  const metrics = useMemo(() => ({
    all: requests.length,
    pending: requests.filter((r) => PENDING_STATUSES.includes(r.status)).length,
    approved: requests.filter((r) => APPROVED_STATUSES.includes(r.status)).length,
    rejected: requests.filter((r) => REJECTED_STATUSES.includes(r.status)).length,
  }), [requests]);

  const effectiveFilter = activeCard || statusFilter;

  const filtered = useMemo(() => {
    let list = requests;
    if (effectiveFilter === "Pending") list = list.filter((r) => PENDING_STATUSES.includes(r.status));
    else if (effectiveFilter === "Approved") list = list.filter((r) => APPROVED_STATUSES.includes(r.status));
    else if (effectiveFilter === "Rejected") list = list.filter((r) => REJECTED_STATUSES.includes(r.status));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.subject.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q));
    }
    return list;
  }, [requests, effectiveFilter, search]);

  const handleCardClick = (card: FilterStatus) => {
    setActiveCard((prev) => (prev === card ? null : card));
    setStatusFilter("All");
  };

  const handleRowClick = (request: typeof requests[0]) => {
    if (request.status === "Draft") {
      navigate("/new");
    } else {
      navigate(`/request/${request.id}`);
    }
  };

  const metricCards = [
    { key: "All" as FilterStatus, label: "All Requests", value: metrics.all, icon: <FileText className="w-5 h-5" />, color: "text-foreground" },
    { key: "Pending" as FilterStatus, label: "Pending", value: metrics.pending, icon: <Clock className="w-5 h-5" />, color: "text-warning-foreground" },
    { key: "Approved" as FilterStatus, label: "Approved", value: metrics.approved, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-success" },
    { key: "Rejected" as FilterStatus, label: "Rejected", value: metrics.rejected, icon: <XCircle className="w-5 h-5" />, color: "text-destructive" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onRefresh={() => {}} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metricCards.map((m) => (
            <button
              key={m.key}
              onClick={() => handleCardClick(m.key)}
              className={`section-card p-5 text-left transition-all hover:shadow-md ${activeCard === m.key ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`${m.color}`}>{m.icon}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{m.value}</p>
              <p className="text-sm text-muted-foreground">{m.label}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by subject or owner..."
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as FilterStatus); setActiveCard(null); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block section-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Tracker</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Subject</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Owner</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Dept</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Supplier</th>
                  <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Total (KWD)</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Created</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Approver</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handleRowClick(r)}
                    className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-primary font-medium">{r.trackerNumber}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[250px] truncate">{r.subject}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{r.owner}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{r.department}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{r.recommendedSupplier || "—"}</td>
                    <td className="px-4 py-3 text-sm text-foreground text-right font-mono">{r.totalValueKwd > 0 ? r.totalValueKwd.toLocaleString("en", { minimumFractionDigits: 3 }) : "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{r.currentApprover || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">No requests found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => handleRowClick(r)}
              className="section-card p-4 w-full text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-mono text-primary font-medium">{r.trackerNumber}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm font-medium text-foreground mb-2 line-clamp-2">{r.subject}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{r.owner}</span>
                <span>{r.department}</span>
              </div>
              {r.totalValueKwd > 0 && (
                <p className="text-sm font-mono font-medium text-foreground mt-2">
                  KWD {r.totalValueKwd.toLocaleString("en", { minimumFractionDigits: 3 })}
                </p>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No requests found.</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
