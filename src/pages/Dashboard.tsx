import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MOCK_REQUESTS } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import { Search, X, ArrowRight, ArrowUp, ArrowDown, Filter, Check } from "lucide-react";
import type { ProcurementRequest } from "@/types/procurement";

/* ---------- Derived row shape ---------- */
type DerivedStatus =
  | "Draft" | "Submitted" | "Under Review" | "Awaiting My Approval"
  | "Awaiting KIA" | "Referred to SAB" | "Approved" | "Complete" | "Rejected" | "Open";

interface Row {
  id: string;
  tracker: string;
  subject: string;
  owner: string;
  dept: string;
  supplier: string;
  kwd: number;
  approver: string;
  status: DerivedStatus;
  mine: boolean;
  urgent: boolean;
}

const STATUS_CHIP: Record<DerivedStatus, string> = {
  Draft: "chip-gray",
  Submitted: "chip-blue",
  "Under Review": "chip-blue",
  "Awaiting My Approval": "chip-amber",
  "Awaiting KIA": "chip-blue",
  "Referred to SAB": "chip-sab",
  Approved: "chip-green",
  Complete: "chip-green",
  Rejected: "chip-red",
  Open: "chip-blue",
};

function deriveRows(reqs: ProcurementRequest[], meName: string): Row[] {
  return reqs.map((r) => {
    const pendingApproval = r.approvals.find((a) => a.status === "Awaiting Approval");
    const isKia = pendingApproval?.stage === 2;
    const isMineToDecide = pendingApproval?.approverName === meName;
    let status: DerivedStatus = r.status as DerivedStatus;
    if (isMineToDecide) status = "Awaiting My Approval";
    else if (isKia) status = "Awaiting KIA";
    return {
      id: r.id,
      tracker: r.trackerNumber,
      subject: r.subject,
      owner: r.owner,
      dept: r.department,
      supplier: r.recommendedSupplier || "—",
      kwd: r.totalValueKwd,
      approver: pendingApproval?.approverName || "—",
      status,
      mine: r.owner === meName || isMineToDecide,
      urgent: isMineToDecide,
    };
  });
}

/* ---------- Action queue ---------- */
const ActionQueue = ({ rows, onOpen }: { rows: Row[]; onOpen: (id: string) => void }) => {
  const myActions = rows.filter((r) => r.mine && (r.status === "Awaiting My Approval" || r.status === "Referred to SAB"));
  if (myActions.length === 0) {
    return (
      <section>
        <div>
          <p className="eyebrow text-primary-600">Your queue</p>
          <h2 className="font-display text-[22px] font-bold tracking-tight text-foreground leading-tight mt-0.5">
            You're all caught up.
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Nothing in your action queue. Browse all requests below.</p>
        </div>
      </section>
    );
  }
  return (
    <section>
      <div className="flex items-end justify-between mb-3 gap-4 flex-wrap">
        <div>
          <p className="eyebrow text-primary-600">Your queue</p>
          <h2 className="font-display text-[22px] font-bold tracking-tight text-foreground leading-tight mt-0.5">
            {myActions.length} {myActions.length === 1 ? "request needs" : "requests need"} your attention
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--warning))" }} /> Awaiting your decision
          </span>
          <span className="flex items-center gap-1.5 ml-3">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--sab))" }} /> SAB follow-up
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {myActions.map((r) => (
          <button
            key={r.id}
            onClick={() => onOpen(r.id)}
            className="bg-card rounded-lg border border-border text-left hover:border-primary transition-colors p-4 group relative overflow-hidden"
          >
            <div
              className="absolute inset-y-0 left-0 w-[3px]"
              style={{ background: r.status === "Referred to SAB" ? "hsl(var(--sab))" : "hsl(var(--warning))" }}
            />
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono-tnum text-[11px] font-semibold text-primary-600">{r.tracker}</span>
              <span className={`chip ${STATUS_CHIP[r.status]}`}>{r.status}</span>
            </div>
            <p className="font-display text-[15px] font-bold leading-snug text-foreground tracking-tight">{r.subject}</p>
            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                <span className="text-muted-2">From</span> <span className="font-medium text-foreground">{r.owner}</span>
                <span className="mx-1.5 text-muted-2">·</span>
                <span className="font-mono-tnum num font-semibold text-foreground">KWD {r.kwd.toLocaleString()}</span>
              </span>
              <span className="text-primary-600 font-semibold inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {r.status === "Referred to SAB" ? "Continue Stage 2" : "Open & decide"} <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

/* ---------- KPI strip ---------- */
type KpiFilter = "all" | "pending" | "approved" | "sab" | "rejected" | null;

const PENDING_STATUSES: DerivedStatus[] = ["Submitted", "Under Review", "Awaiting My Approval", "Awaiting KIA", "Referred to SAB", "Open", "Draft"];

const KpiStrip = ({ rows, filter, setFilter }: { rows: Row[]; filter: KpiFilter; setFilter: (f: KpiFilter) => void }) => {
  const counts = {
    all: rows.length,
    pending: rows.filter((r) => PENDING_STATUSES.includes(r.status)).length,
    approved: rows.filter((r) => r.status === "Approved" || r.status === "Complete").length,
    sab: rows.filter((r) => r.status === "Referred to SAB").length,
    rejected: rows.filter((r) => r.status === "Rejected").length,
  };
  const tiles: { key: Exclude<KpiFilter, null>; label: string; v: number; accent?: "sab" }[] = [
    { key: "all", label: "All requests", v: counts.all },
    { key: "pending", label: "In progress", v: counts.pending },
    { key: "approved", label: "Approved", v: counts.approved },
    { key: "sab", label: "At SAB", v: counts.sab, accent: "sab" },
    { key: "rejected", label: "Rejected", v: counts.rejected },
  ];
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 border-t border-b border-border py-3.5">
      {tiles.map((t) => (
        <button
          key={t.key}
          onClick={() => setFilter(filter === t.key ? null : t.key)}
          className={`text-left px-3 py-1 rounded-md transition-colors border ${
            filter === t.key ? "border-primary bg-primary-50" : "border-transparent hover:bg-muted"
          }`}
        >
          <p className="text-[11px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">{t.label}</p>
          <p
            className="font-display text-[26px] font-bold tracking-tight leading-tight tabular-nums"
            style={{ color: t.accent === "sab" ? "hsl(var(--sab))" : undefined }}
          >
            {t.v}
          </p>
        </button>
      ))}
    </section>
  );
};

/* ---------- Column filter popover ---------- */
type Col = "tracker" | "subject" | "owner" | "dept" | "supplier" | "kwd" | "approver" | "status";
type FilterValue = string | string[] | { min?: string; max?: string } | undefined;

const CAT_COLS: Col[] = ["owner", "dept", "supplier", "approver", "status"];

const ColumnFilterPopover = ({
  col, anchor, value, options, onChange, onClose,
}: {
  col: Col; anchor: { left: number; bottom: number };
  value: FilterValue; options: string[];
  onChange: (v: FilterValue) => void; onClose: () => void;
}) => {
  const isText = col === "tracker" || col === "subject";
  const isRange = col === "kwd";
  const [q, setQ] = useState("");
  const sel = Array.isArray(value) ? value : [];

  const W = isRange ? 200 : 224;
  const left = Math.min(anchor.left, window.innerWidth - W - 12);
  const style: React.CSSProperties = { position: "fixed", top: anchor.bottom + 6, left, width: W, zIndex: 50 };
  const toggle = (v: string) => onChange(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
  const shown = options.filter((o) => !q || String(o).toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="fixed inset-0 z-[49]" onClick={onClose} />
      <div style={style} className="bg-card border border-border rounded-lg shadow-xl p-2 text-left normal-case tracking-normal">
        {isText && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground px-1 pb-1.5">Contains</p>
            <input
              autoFocus
              className="w-full h-[30px] text-xs px-2 rounded-md border border-input bg-background"
              placeholder={`Filter ${col}…`}
              value={(value as string) || ""}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        )}
        {isRange && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground px-1 pb-1.5">KWD range</p>
            <div className="flex items-center gap-1.5">
              <input
                className="w-full h-[30px] text-xs px-2 rounded-md border border-input bg-background num text-right"
                inputMode="numeric" placeholder="Min"
                value={(value as any)?.min ?? ""}
                onChange={(e) => onChange({ ...(value as any), min: e.target.value })}
              />
              <span className="text-muted-2 text-xs">–</span>
              <input
                className="w-full h-[30px] text-xs px-2 rounded-md border border-input bg-background num text-right"
                inputMode="numeric" placeholder="Max"
                value={(value as any)?.max ?? ""}
                onChange={(e) => onChange({ ...(value as any), max: e.target.value })}
              />
            </div>
          </div>
        )}
        {!isText && !isRange && (
          <div>
            <div className="flex items-center justify-between px-1 pb-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground">{sel.length ? `${sel.length} selected` : "All values"}</p>
              {sel.length > 0 && (
                <button onClick={() => onChange([])} className="text-[11px] text-primary-600 font-medium hover:underline">Clear</button>
              )}
            </div>
            {options.length > 6 && (
              <input
                className="w-full h-[28px] text-xs px-2 rounded-md border border-input bg-background mb-1.5"
                placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)}
              />
            )}
            <div className="max-h-[200px] overflow-y-auto space-y-0.5">
              {shown.map((o) => {
                const on = sel.includes(o);
                return (
                  <button
                    key={o} onClick={() => toggle(o)}
                    className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-muted text-left"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      on ? "bg-primary border-primary text-primary-foreground" : "border-border-strong bg-card"
                    }`}>
                      {on && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </span>
                    <span className="text-xs text-foreground truncate">{o === "—" ? "Unassigned" : o}</span>
                  </button>
                );
              })}
              {shown.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">No matches.</p>}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

/* ---------- Requests table ---------- */
const RequestsTable = ({ rows, filter, onOpen }: { rows: Row[]; filter: KpiFilter; onOpen: (id: string) => void }) => {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<Col | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [colFilters, setColFilters] = useState<Record<string, FilterValue>>({});
  const [openFilter, setOpenFilter] = useState<{ col: Col; anchor: { left: number; bottom: number } } | null>(null);

  const setColFilter = (col: Col, v: FilterValue) => setColFilters((prev) => ({ ...prev, [col]: v }));
  const filterActive = (col: Col) => {
    const v = colFilters[col];
    if (col === "kwd") { const r = v as any; return !!(r && (r.min || r.max)); }
    if (col === "tracker" || col === "subject") return !!(v && (v as string).trim());
    return Array.isArray(v) && v.length > 0;
  };
  const anyFilter = (["tracker", "subject", ...CAT_COLS, "kwd"] as Col[]).some(filterActive);

  const distinct = useMemo(() => {
    const out: Record<string, string[]> = {};
    CAT_COLS.forEach((col) => {
      out[col] = [...new Set(rows.map((r) => String(r[col as keyof Row] ?? "")).filter((v) => v !== ""))]
        .sort((a, b) => a.localeCompare(b));
    });
    return out;
  }, [rows]);

  let list = rows;
  if (filter === "pending") list = list.filter((r) => PENDING_STATUSES.includes(r.status));
  else if (filter === "approved") list = list.filter((r) => r.status === "Approved" || r.status === "Complete");
  else if (filter === "sab") list = list.filter((r) => r.status === "Referred to SAB");
  else if (filter === "rejected") list = list.filter((r) => r.status === "Rejected");

  CAT_COLS.forEach((col) => {
    const sel = colFilters[col];
    if (Array.isArray(sel) && sel.length) list = list.filter((r) => sel.includes(String(r[col as keyof Row])));
  });
  (["tracker", "subject"] as Col[]).forEach((col) => {
    const q = ((colFilters[col] as string) || "").trim().toLowerCase();
    if (q) list = list.filter((r) => String(r[col as keyof Row] || "").toLowerCase().includes(q));
  });
  if (colFilters.kwd) {
    const { min, max } = colFilters.kwd as any;
    if (min !== "" && min != null) list = list.filter((r) => r.kwd >= Number(min));
    if (max !== "" && max != null) list = list.filter((r) => r.kwd <= Number(max));
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    list = list.filter((r) => [r.tracker, r.subject, r.owner, r.dept, r.supplier, r.status].some((v) => (v || "").toLowerCase().includes(q)));
  }
  if (sortCol) {
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const va = a[sortCol as keyof Row]; const vb = b[sortCol as keyof Row];
      if (sortCol === "kwd") return ((va as number) - (vb as number)) * dir;
      return String(va || "").localeCompare(String(vb || "")) * dir;
    });
  }

  const toggleSort = (col: Col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortArrow = ({ col }: { col: Col }) =>
    sortCol === col ? (
      sortDir === "asc"
        ? <ArrowUp className="w-2.5 h-2.5 text-primary-600" />
        : <ArrowDown className="w-2.5 h-2.5 text-primary-600" />
    ) : <ArrowDown className="w-2.5 h-2.5 opacity-20" />;

  const openColFilter = (col: Col, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (openFilter && openFilter.col === col) { setOpenFilter(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setOpenFilter({ col, anchor: { left: r.left, bottom: r.bottom } });
  };

  const Th = ({ col, children, right, nosort }: { col: Col; children: React.ReactNode; right?: boolean; nosort?: boolean }) => {
    const active = filterActive(col);
    return (
      <th className={`py-2.5 font-semibold text-[11px] uppercase tracking-[0.07em] whitespace-nowrap align-middle ${right ? "text-right px-3" : "text-left px-3"} ${col === "tracker" ? "pl-4" : ""}`}>
        <span className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""}`}>
          <button
            onClick={nosort ? undefined : () => toggleSort(col)}
            className={`inline-flex items-center gap-1 ${nosort ? "cursor-default text-muted-foreground" : `cursor-pointer select-none ${sortCol === col ? "text-primary-600" : "text-muted-foreground hover:text-foreground"}`}`}
          >
            {children}{!nosort && <SortArrow col={col} />}
          </button>
          <button
            onClick={(e) => openColFilter(col, e)}
            title={`Filter ${typeof children === "string" ? children : col}`}
            className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded transition-colors ${
              active ? "text-primary-foreground bg-primary" : "text-muted-2 hover:text-foreground hover:bg-muted"
            }`}
          >
            <Filter className="w-2.5 h-2.5" />
          </button>
        </span>
      </th>
    );
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="h-[38px] w-[320px] max-w-full text-sm pl-8 pr-8 rounded-md border border-input bg-background"
            placeholder="Search requests…" value={search} onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-2 hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono-tnum tabular-nums">
            {list.length} {list.length === 1 ? "request" : "requests"}
          </span>
          {anyFilter && (
            <button onClick={() => setColFilters({})} className="text-xs text-primary-600 font-semibold inline-flex items-center gap-1 hover:underline">
              <X className="w-2.5 h-2.5" /> Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[760px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <Th col="tracker">Tracker</Th>
                <Th col="subject">Subject</Th>
                <Th col="owner">Owner</Th>
                <Th col="dept">Department</Th>
                <Th col="supplier">Supplier</Th>
                <Th col="kwd" right>KWD</Th>
                <Th col="approver" nosort>Approver</Th>
                <Th col="status">Status</Th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No requests match your filters.
                  </td>
                </tr>
              ) : list.map((r, i) => (
                <tr
                  key={r.id} onClick={() => onOpen(r.id)}
                  className={`cursor-pointer hover:bg-muted/40 ${i < list.length - 1 ? "border-b border-border" : ""} ${r.urgent ? "bg-warning-50/40" : ""}`}
                >
                  <td className="px-4 py-3 font-mono-tnum text-xs font-semibold text-primary-600">
                    <div className="flex items-center gap-1.5">
                      {r.urgent && <span className="w-1 h-1 rounded-full" style={{ background: "hsl(var(--warning))" }} title="Needs action" />}
                      {r.tracker}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-foreground max-w-[280px] truncate">{r.subject}</p>
                  </td>
                  <td className="px-3 py-3 text-foreground">{r.owner}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.dept}</td>
                  <td className="px-3 py-3 text-muted-foreground truncate max-w-[160px]">{r.supplier}</td>
                  <td className="px-3 py-3 text-right num font-semibold text-foreground">
                    {r.kwd > 0 ? r.kwd.toLocaleString("en", { minimumFractionDigits: 0 }) : "—"}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {r.approver === "—" ? <span className="text-muted-2">—</span> : <span>{r.approver}</span>}
                  </td>
                  <td className="px-3 py-3"><span className={`chip ${STATUS_CHIP[r.status]}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openFilter && (
        <ColumnFilterPopover
          col={openFilter.col}
          anchor={openFilter.anchor}
          value={colFilters[openFilter.col]}
          options={distinct[openFilter.col] || []}
          onChange={(v) => setColFilter(openFilter.col, v)}
          onClose={() => setOpenFilter(null)}
        />
      )}
    </section>
  );
};

/* ---------- Page ---------- */
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<KpiFilter>(null);

  const rows = useMemo(() => deriveRows(MOCK_REQUESTS, user?.name || ""), [user?.name]);

  const handleOpen = (id: string) => {
    const req = MOCK_REQUESTS.find((r) => r.id === id);
    if (req?.status === "Draft") navigate("/new");
    else navigate(`/request/${id}`);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const isSuper = user?.role === "ORG_SUPER" || user?.role === "DEPT_SUPER";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onRefresh={() => {}} />
      <main className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6 space-y-7">
        <header>
          <h1 className="font-display text-[24px] sm:text-[30px] font-bold tracking-tight text-foreground leading-tight">
            {greeting}, {user?.name.split(" ")[0]}.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuper ? "An overview of procurement requests across KIO." : "Here's an overview of your procurement requests."}
          </p>
        </header>

        <ActionQueue rows={rows} onOpen={handleOpen} />
        <KpiStrip rows={rows} filter={filter} setFilter={setFilter} />
        <RequestsTable rows={rows} filter={filter} onOpen={handleOpen} />
      </main>
    </div>
  );
};

export default Dashboard;
