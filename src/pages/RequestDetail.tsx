import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MOCK_REQUESTS } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  ArrowLeft, Share2, FileDown, Star, Download, CheckCircle2, XCircle, Clock,
  AlertCircle, AlertTriangle, FileText, Pencil, RotateCcw, ChevronDown, Workflow,
  Users, Check, X, ArrowDown, Upload, Lock, Send, Archive, Plus, Trash2,
} from "lucide-react";
import type { ApprovalRecord, ApprovalStatus, ContractCost, ProcurementRequest } from "@/types/procurement";

/* ───────────────────────── helpers ───────────────────────── */

type CockpitState =
  | "stage1-my-turn"
  | "stage1-pending-other"
  | "stage1-rejected"
  | "awaiting-kia"
  | "kia-approved"
  | "complete"
  | "rejected";

function deriveCockpitState(req: ProcurementRequest, currentUser?: string): CockpitState {
  if (req.status === "Rejected") {
    const rej = req.approvals.find((a) => a.status === "Rejected");
    if (rej && rej.stage === 1) return "stage1-rejected";
    return "rejected";
  }
  if (req.status === "Complete" || req.status === "Approved") {
    const stage2Done = req.approvals.filter((a) => a.stage === 2).every((a) => a.status === "Approved");
    if (stage2Done) return req.status === "Complete" ? "complete" : "kia-approved";
  }
  const stage1 = req.approvals.filter((a) => a.stage === 1);
  const stage1Done = stage1.length > 0 && stage1.every((a) => a.status === "Approved");
  if (stage1Done) return "awaiting-kia";
  const myTurn = stage1.find((a) => a.status === "Awaiting Approval" && a.approverName === currentUser);
  if (myTurn) return "stage1-my-turn";
  return "stage1-pending-other";
}

const APPROVAL_ICONS: Record<ApprovalStatus, React.ReactNode> = {
  "In Queue": <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
  "Awaiting Approval": <AlertCircle className="w-3.5 h-3.5 text-warning" />,
  Approved: <CheckCircle2 className="w-3.5 h-3.5 text-success" />,
  Rejected: <XCircle className="w-3.5 h-3.5 text-destructive" />,
};

const formatKwd = (n: number) => `KWD ${n.toLocaleString("en", { minimumFractionDigits: 3 })}`;

/** Open a stub preview of a mock file in a new tab. */
const openFile = (name: string) => {
  const safe = name.replace(/[<>&]/g, "");
  const html = `<!doctype html><html><head><title>${safe}</title><style>body{font-family:system-ui;padding:48px;background:#0b0f17;color:#e8edf3}h1{font-size:18px;margin:0 0 8px}p{color:#94a3b8;font-size:13px;margin:0}</style></head><body><h1>${safe}</h1><p>Document preview (mock). In production this would render the actual file.</p></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "noopener,noreferrer");
};

const CCY_SYM: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", KWD: "KWD " };
const FREQ_LONG: Record<string, string> = { month: "per month", quarter: "per quarter", year: "per annum" };
const FREQ_UNIT: Record<string, string> = { month: "months", quarter: "quarters", year: "years" };

function fmtContractStart(r: ProcurementRequest) {
  if (!r.contractStart && !r.contractFrom) return "—";
  const iso = r.contractStart ?? r.contractFrom!;
  const d = new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return r.contractStartEstimated ? `${d} · estimated` : d;
}
function fmtContractCost(c?: ContractCost) {
  if (!c) return "—";
  const s = CCY_SYM[c.currency] ?? "";
  if (c.type === "oneoff") return `${s}${(c.oneOff || 0).toLocaleString("en")} · one-off payment`;
  const total = (c.amount || 0) * (c.periods || 0);
  return `${s}${(c.amount || 0).toLocaleString("en")} ${FREQ_LONG[c.freq || "year"]} × ${c.periods} ${FREQ_UNIT[c.freq || "year"]} = ${s}${total.toLocaleString("en")}`;
}

const RD_DEPTS = [
  "Information Technology", "Facilities Management", "Finance", "Legal & Compliance",
  "Operations", "Marketing & Communications", "Human Resources", "Procurement",
];
const RD_BUDGET_CODES = [
  "CAPEX-2024-IT-001", "CAPEX-2024-FAC-006", "OPEX-2024-IT-003", "OPEX-2024-HR-004",
  "OPEX-2024-MKT-005", "OPEX-2024-LEG-002",
];

type RequestDraft = Pick<
  ProcurementRequest,
  "subject" | "description" | "technicalSpecs" | "department" | "budgetCode" |
  "contractDuration" | "requisitionNumber" | "rfpConducted" | "rfpSummary" | "rfpNoReason" |
  "contractStart" | "contractStartEstimated" | "contractCost" | "suppliers" | "evidenceFiles"
>;
function makeDraft(r: ProcurementRequest): RequestDraft {
  return {
    subject: r.subject, description: r.description, technicalSpecs: r.technicalSpecs,
    department: r.department, budgetCode: r.budgetCode, contractDuration: r.contractDuration,
    requisitionNumber: r.requisitionNumber, rfpConducted: r.rfpConducted,
    rfpSummary: r.rfpSummary, rfpNoReason: r.rfpNoReason,
    contractStart: r.contractStart, contractStartEstimated: r.contractStartEstimated,
    contractCost: r.contractCost ? { ...r.contractCost } : undefined,
    suppliers: r.suppliers.map((s) => ({ ...s, files: s.files.map((f) => ({ ...f })) })),
    evidenceFiles: r.evidenceFiles.map((f) => ({ ...f })),
  };
}

/* ───────────────────────── Page ───────────────────────── */

const RequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const initial = useMemo(() => MOCK_REQUESTS.find((r) => r.id === id), [id]);
  const [request, setRequest] = useState<ProcurementRequest | undefined>(initial);
  const [comment, setComment] = useState("");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RequestDraft>(() => makeDraft(initial!));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editReason, setEditReason] = useState("");

  if (!request) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex items-center justify-center py-24">
          <p className="text-muted-foreground">Request not found.</p>
        </div>
      </div>
    );
  }

  const cockpitState = deriveCockpitState(request, user?.name);
  const pendingApproval = request.approvals.find(
    (a) => a.status === "Awaiting Approval" && a.approverName === user?.name,
  );

  const advance = (approvals: ApprovalRecord[], decidedId: string, decision: "Approved" | "Rejected") => {
    const updated = approvals.map((a) =>
      a.id === decidedId
        ? { ...a, status: decision, decidedAt: new Date().toISOString(), comments: comment || a.comments }
        : a,
    );
    if (decision === "Rejected") return updated;
    const decided = updated.find((a) => a.id === decidedId)!;
    const same = updated.filter((a) => a.stage === decided.stage && a.status === "In Queue")
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)[0];
    if (same) return updated.map((a) => a.id === same.id ? { ...a, status: "Awaiting Approval" as ApprovalStatus } : a);
    const next = updated.filter((a) => a.stage > decided.stage && a.status === "In Queue")
      .sort((a, b) => a.stage - b.stage || a.sequenceOrder - b.sequenceOrder)[0];
    if (next) return updated.map((a) => a.id === next.id ? { ...a, status: "Awaiting Approval" as ApprovalStatus } : a);
    return updated;
  };

  const handleApprove = () => {
    if (!pendingApproval) return;
    const newApprovals = advance(request.approvals, pendingApproval.id, "Approved");
    const stillOpen = newApprovals.some((a) => a.status === "Awaiting Approval" || a.status === "In Queue");
    setRequest({
      ...request, approvals: newApprovals,
      status: stillOpen ? "Under Review" : "Approved",
      modifiedAt: new Date().toISOString(),
      activity: [...request.activity, {
        id: `act-${Date.now()}`, action: `Approved by ${pendingApproval.approverName}`,
        performedBy: pendingApproval.approverName, timestamp: new Date().toISOString(),
        details: comment || undefined,
      }],
    });
    setComment(""); toast.success("Approval recorded");
  };

  const handleReject = () => {
    if (!pendingApproval || !comment.trim()) return;
    const newApprovals = advance(request.approvals, pendingApproval.id, "Rejected");
    setRequest({
      ...request, approvals: newApprovals, status: "Rejected",
      modifiedAt: new Date().toISOString(),
      activity: [...request.activity, {
        id: `act-${Date.now()}`, action: `Rejected by ${pendingApproval.approverName}`,
        performedBy: pendingApproval.approverName, timestamp: new Date().toISOString(),
        details: comment,
      }],
    });
    setComment(""); toast.error("Rejection recorded");
  };

  const resetApprovalsFresh = (existing: ApprovalRecord[]): ApprovalRecord[] => {
    const sorted = [...existing].sort((a, b) => a.stage - b.stage || a.sequenceOrder - b.sequenceOrder);
    return sorted.map((a, i) => ({
      ...a, id: `${a.id}-r${Date.now().toString(36)}`,
      status: i === 0 ? "Awaiting Approval" : "In Queue",
      comments: undefined, decidedAt: undefined,
    }));
  };

  const beginEdit = () => { setDraft(makeDraft(request)); setEditing(true); };
  const cancelEdit = () => { setDraft(makeDraft(request)); setEditing(false); setEditReason(""); };
  const requestSave = () => setConfirmOpen(true);

  const handleSaveEdit = () => {
    const previousApprovals = request.approvals;
    const fresh = resetApprovalsFresh(previousApprovals);
    const now = new Date().toISOString();
    const batchNo = (request.archivedApprovalBatches?.length ?? 0) + 1;
    const recommended = draft.suppliers.find((s) => s.recommended);
    const totalValueKwd = recommended
      ? recommended.totalKwd
      : draft.suppliers.reduce((m, s) => Math.max(m, s.totalKwd || 0), 0);
    setRequest({
      ...request,
      subject: draft.subject,
      description: draft.description,
      technicalSpecs: draft.technicalSpecs,
      department: draft.department,
      budgetCode: draft.budgetCode,
      contractDuration: draft.contractDuration,
      requisitionNumber: draft.requisitionNumber,
      rfpConducted: draft.rfpConducted,
      rfpSummary: draft.rfpSummary,
      rfpNoReason: draft.rfpNoReason,
      contractStart: draft.contractStart,
      contractStartEstimated: draft.contractStartEstimated,
      contractCost: draft.contractCost,
      suppliers: draft.suppliers,
      evidenceFiles: draft.evidenceFiles,
      recommendedSupplier: recommended?.companyName ?? request.recommendedSupplier,
      totalValueKwd,
      modifiedAt: now,
      status: "Under Review",
      approvals: fresh,
      archivedApprovalBatches: [
        ...(request.archivedApprovalBatches ?? []),
        {
          id: `batch-${Date.now()}`, archivedAt: now, archivedBy: user?.name ?? "Unknown",
          reason: editReason || undefined, approvals: previousApprovals,
        },
      ],
      activity: [...request.activity, {
        id: `act-edit-${Date.now()}`,
        action: `Request edited — Batch #${batchNo} archived and approvals restarted`,
        performedBy: user?.name ?? "Unknown", timestamp: now, details: editReason || undefined,
      }],
    });
    setConfirmOpen(false); setEditing(false); setEditReason("");
    toast.success("Request updated · approvals archived and restarted");
  };

  const canEdit = user?.role === "ORG_SUPER" || user?.name === request.owner;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Breadcrumb */}
      <div className="border-b border-border bg-card">
        <div className="max-w-[900px] mx-auto px-5 py-2.5 flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <button onClick={() => navigate("/")} className="hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> All requests
          </button>
          <span className="text-muted-2">/</span>
          <span className="font-mono text-foreground">{request.trackerNumber}</span>
        </div>
      </div>

      {/* Flush header */}
      <div className="border-b border-border bg-card px-5 pt-5 pb-4">
        <div className="max-w-[900px] mx-auto flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="font-mono text-[13px] font-bold text-primary-600">{request.trackerNumber}</span>
              <CockpitChip state={cockpitState} />
            </div>
            {editing ? (
              <Input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                className="text-[20px] font-display font-bold h-auto py-1.5 max-w-[640px]"
              />
            ) : (
              <h1 className="font-display text-[24px] font-bold text-foreground tracking-tight leading-[1.15]">
                {request.subject}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!editing && canEdit && request.status !== "Draft" && (
              <button onClick={() => setConfirmOpen(true)} className="btn btn-secondary">
                <Pencil className="w-3 h-3" /> Edit request
              </button>
            )}
            {!editing && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/request/${request.id}`);
                    toast.success("Link copied");
                  }}
                >
                  <Share2 className="w-3 h-3" /> Share
                </button>
                <button className="btn btn-secondary" onClick={() => toast.info("PDF export coming soon")}>
                  <FileDown className="w-3 h-3" /> Export PDF
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pre-edit confirmation modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-warning/10 text-warning flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle>Editing restarts approvals</DialogTitle>
            <DialogDescription className="leading-[1.55] pt-1">
              Editing this request will <strong className="text-foreground">stop and archive the current approval batch</strong>
              {" "}(Batch #{(request.archivedApprovalBatches?.length ?? 0) + 1},
              {" "}{request.approvals.filter((a) => a.status === "Approved").length} of {request.approvals.length} approved).
              When you resubmit, a fresh batch is triggered <strong className="text-foreground">starting from KIO Internal Approval</strong> —
              approvals already given do not carry over.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={() => { setConfirmOpen(false); beginEdit(); }}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Continue to edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single-scroll content */}
      <main className="flex-1 max-w-[900px] w-full mx-auto px-5 py-6 space-y-7">
        {/* Resubmit success banner */}
        {!editing && request.archivedApprovalBatches && request.archivedApprovalBatches.length > 0 && (
          <div className="rounded-lg border border-success/30 bg-success-50 px-4 py-3 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-foreground leading-[1.5]">
              <strong>Request edited and resubmitted.</strong> Batch #{request.archivedApprovalBatches.length} was archived
              and a fresh approval batch (#{request.archivedApprovalBatches.length + 1}) has been triggered from KIO Internal Approval.
            </p>
          </div>
        )}

        {/* Cockpit — hidden while editing */}
        {!editing && (
          <Cockpit
            request={request}
            state={cockpitState}
            pendingApproval={pendingApproval}
            comment={comment}
            setComment={setComment}
            onApprove={handleApprove}
            onReject={handleReject}
            currentUser={user?.name}
          />
        )}

        {/* Approval chain (with inline archived batches & edit warning) */}
        <div>
          <SectionTitle
            title="Approval chain"
            action={!editing && request.archivedApprovalBatches && request.archivedApprovalBatches.length > 0
              ? <span className="chip chip-blue">Batch #{request.archivedApprovalBatches.length + 1} · Active</span>
              : null}
          />
          {editing && (
            <div className="mb-3 rounded-lg border border-warning/40 bg-warning-50 px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-foreground leading-[1.5]">
                <strong>Editing in progress.</strong> On resubmit, the current batch
                (Batch #{(request.archivedApprovalBatches?.length ?? 0) + 1},
                {" "}{request.approvals.filter((a) => a.status === "Approved").length} of {request.approvals.length} approved)
                will be stopped and archived, and a fresh batch will be triggered from KIO Internal Approval.
              </p>
            </div>
          )}
          {!editing && request.archivedApprovalBatches?.map((batch, idx) => (
            <ArchivedBatchCard key={batch.id} batch={batch} no={idx + 1} />
          ))}
          <ApprovalLedger request={request} currentUser={user?.name} />
        </div>

        {/* Request facts */}
        <div>
          <SectionTitle
            title="Request facts"
            action={editing ? <span className="chip chip-amber"><Pencil className="w-2.5 h-2.5" /> Editing</span> : null}
          />
          <RequestFacts request={request} editing={editing} draft={draft} setDraft={setDraft} />
        </div>

        {/* Supplier offers */}
        <div>
          <SectionTitle
            title="Supplier offers"
            count={(editing ? draft.suppliers : request.suppliers).length}
            action={editing
              ? <span className="chip chip-amber"><Pencil className="w-2.5 h-2.5" /> Editing</span>
              : <p className="text-[12px] text-muted-foreground font-mono">Sorted by KWD total</p>}
          />
          <Suppliers request={request} editing={editing} draft={draft} setDraft={setDraft} />
        </div>

        {/* Supporting documents */}
        <div>
          <SectionTitle
            title="Supporting documents"
            count={(editing ? draft.evidenceFiles : request.evidenceFiles).length}
            action={editing ? <span className="chip chip-amber"><Pencil className="w-2.5 h-2.5" /> Editing</span> : null}
          />
          <SupportingDocs request={request} editing={editing} draft={draft} setDraft={setDraft} />
        </div>

        {/* Activity */}
        <div>
          <SectionTitle title="Activity" />
          <Activity request={request} />
        </div>

        {editing && <div className="h-16" />}
      </main>

      {/* Sticky edit action bar */}
      {editing && (
        <div className="shrink-0 border-t border-border bg-card sticky bottom-0 z-20">
          <div className="max-w-[900px] mx-auto px-5 py-3 flex items-center justify-between gap-4">
            <p className="text-[12.5px] text-warning font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Resubmitting archives the current batch and restarts approvals from KIO
            </p>
            <div className="flex items-center gap-2">
              <button onClick={cancelEdit} className="btn btn-secondary">Discard changes</button>
              <button onClick={handleSaveEdit} className="btn btn-primary btn-lg">
                <Send className="w-3.5 h-3.5" /> Resubmit request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── Section title ───────────────────────── */

const SectionTitle = ({ kicker, title, count, action }: { kicker?: string; title: string; count?: number; action?: React.ReactNode }) => (
  <div className="flex items-end justify-between mb-3">
    <div>
      {kicker && <p className="eyebrow">{kicker}</p>}
      <h2 className="font-display text-[18px] font-bold text-foreground tracking-tight leading-tight">
        {title}
        {count != null && <span className="text-muted-2 font-medium font-mono ml-1.5 text-[14px]">{count}</span>}
      </h2>
    </div>
    {action}
  </div>
);

const ArchivedBatchCard = ({ batch, no }: { batch: { id: string; archivedAt: string; archivedBy: string; reason?: string; approvals: ApprovalRecord[] }; no: number }) => (
  <div className="card overflow-hidden border-dashed border-[hsl(var(--border-strong))] bg-muted/30 mb-3">
    <header className="px-5 py-3 hairline flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Archive className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="eyebrow">Approval batch #{no} · Archived</p>
      </div>
      <span className="chip chip-gray"><X className="w-2.5 h-2.5" /> Superseded by edit</span>
    </header>
    <div className="px-5 py-3">
      <p className="text-[12.5px] text-muted-foreground leading-[1.5] mb-2.5">
        Stopped on {new Date(batch.archivedAt).toLocaleDateString("en-GB")} by {batch.archivedBy} when the request was edited.
        {batch.reason ? <> · {batch.reason}</> : null} This batch is closed — no further action is possible on it.
      </p>
      <ol className="space-y-1.5">
        {batch.approvals.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-[12px]">
            <span className="text-muted-2 line-through">{a.approverName}</span>
            <span className="text-muted-2">· {a.approverTitle}</span>
            <span className="ml-auto text-[11px] font-mono text-muted-2">
              {a.status === "Approved" ? "had approved" : a.status === "Rejected" ? "had rejected" : "no action taken"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  </div>
);

/* ───────────────────────── Cockpit chip ───────────────────────── */

const CockpitChip = ({ state }: { state: CockpitState }) => {
  const meta: Record<CockpitState, { label: string; cls: string }> = {
    "stage1-my-turn":       { label: "Awaiting your decision",       cls: "chip-amber" },
    "stage1-pending-other": { label: "Stage 1 in progress",           cls: "chip-blue" },
    "stage1-rejected":      { label: "Rejected at Stage 1",           cls: "chip-red" },
    "awaiting-kia":         { label: "Awaiting KIA decision",         cls: "chip-blue" },
    "kia-approved":         { label: "KIA approved",                  cls: "chip-green" },
    "complete":             { label: "Complete",                       cls: "chip-green" },
    "rejected":             { label: "Rejected",                       cls: "chip-red" },
  };
  const m = meta[state];
  return <span className={`chip ${m.cls}`}>{m.label}</span>;
};

/* ───────────────────────── Cockpit ───────────────────────── */

const JOURNEY_NODES = [
  { key: "stage1",   label: "Stage 1",     sub: "KIO Internal" },
  { key: "kia",      label: "KIA Review",  sub: "Stage 2" },
  { key: "decision", label: "Decision",    sub: "Outcome" },
  { key: "contract", label: "Contract",    sub: "Reference" },
  { key: "done",     label: "Complete",    sub: "Finalised" },
];

function journeyIndex(state: CockpitState): number {
  switch (state) {
    case "stage1-my-turn":
    case "stage1-pending-other":
    case "stage1-rejected":
      return 0;
    case "awaiting-kia": return 1;
    case "kia-approved": return 3;
    case "complete":     return 4;
    case "rejected":     return 4;
  }
}

const Cockpit = ({
  request, state, pendingApproval, comment, setComment, onApprove, onReject, currentUser,
}: {
  request: ProcurementRequest;
  state: CockpitState;
  pendingApproval?: ApprovalRecord;
  comment: string;
  setComment: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  currentUser?: string;
}) => {
  const isStage1 = state.startsWith("stage1-");
  const at = journeyIndex(state);
  const reject = state === "rejected" || state === "stage1-rejected";
  const progress = (at / (JOURNEY_NODES.length - 1)) * 100;
  const stage1 = request.approvals.filter((a) => a.stage === 1).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const stage2 = request.approvals.filter((a) => a.stage === 2).sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  // Auto-cycle the approver chip strip between Stage 1 and Stage 2.
  const [shownStage, setShownStage] = useState<1 | 2>(isStage1 ? 1 : 2);
  useEffect(() => {
    if (stage2.length === 0) return;
    const id = setInterval(() => setShownStage((s) => (s === 1 ? 2 : 1)), 4500);
    return () => clearInterval(id);
  }, [stage2.length]);
  const shownList = shownStage === 1 ? stage1 : stage2;

  return (
    <div className="card overflow-hidden">
      <header className="px-5 py-3 hairline flex items-center justify-between bg-gradient-to-b from-card to-muted/30">
        <div className="flex items-center gap-2">
          {isStage1
            ? <Users className="w-4 h-4 text-primary" />
            : <Workflow className="w-4 h-4 text-primary" />}
          <h2 className="font-display text-[16px] font-bold tracking-tight text-foreground">
            {isStage1 ? "Stage 1 · KIO Internal Approval" : "Stage 2 · KIA External Approval"}
          </h2>
          <span className="text-[11.5px] text-muted-foreground font-mono ml-1">
            · {stage1.filter((a) => a.status === "Approved").length} of {stage1.length} stage 1 approved
          </span>
        </div>
      </header>

      {/* Journey track */}
      <div className="px-5 pt-5 pb-4">
        <div className="relative min-w-[440px]">
          <div className="absolute left-[16px] right-[16px] top-3.5 h-[3px] rounded-full bg-border" />
          <div
            className={`absolute left-[16px] top-3.5 h-[3px] rounded-full transition-[width] duration-500 ${reject ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `calc((100% - 32px) * ${progress / 100})` }}
          />
          <div className="grid grid-cols-5 relative">
            {JOURNEY_NODES.map((node, i) => {
              const done = i < at;
              const current = i === at;
              return (
                <div key={node.key} className="flex flex-col items-center gap-1.5 relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors
                    ${done    ? "bg-primary border-primary text-primary-foreground" :
                      current ? `bg-card ${reject ? "border-destructive text-destructive" : "border-primary text-primary"}` :
                                "bg-card border-[hsl(var(--border-strong))] text-muted-2"}`}>
                    {done    ? <Check className="w-4 h-4" strokeWidth={2.5} /> :
                     current ? (reject ? <X className="w-4 h-4" strokeWidth={2.5} /> : <span className="w-2 h-2 rounded-full bg-current" />) :
                               <span className="text-[11.5px] font-semibold tabular-nums">{i + 1}</span>}
                  </div>
                  <div className="text-center max-w-[100px]">
                    <p className={`text-[12px] font-semibold leading-tight ${done || current ? "text-foreground" : "text-muted-2"}`}>{node.label}</p>
                    <p className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">{node.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Approver chip strip — auto-cycles between Stage 1 & Stage 2 */}
      {shownList.length > 0 && (
        <div className="px-5 pb-4">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
            <div className="flex items-center justify-between mb-2">
              <p className="eyebrow text-[10.5px]">
                {shownStage === 1 ? "Stage 1 · KIO approvers" : "Stage 2 · KIA approvers"}
              </p>
              {stage2.length > 0 && (
                <div className="flex items-center gap-1">
                  {[1, 2].map((n) => (
                    <button key={n} type="button" onClick={() => setShownStage(n as 1 | 2)}
                      className={`h-1.5 rounded-full transition-all ${shownStage === n ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-muted-2"}`}
                      aria-label={`Show stage ${n}`} />
                  ))}
                </div>
              )}
            </div>
            <div key={shownStage} className="flex items-center gap-1.5 flex-wrap animate-in fade-in slide-in-from-right-1 duration-300">
              {shownList.map((a, i) => {
                const isMe = a.approverName === currentUser;
                const cls =
                  a.status === "Approved" ? "bg-success-50 border-success/30 text-success" :
                  a.status === "Rejected" ? "bg-danger-50 border-destructive/30 text-destructive" :
                  a.status === "Awaiting Approval" ? "bg-warning-50 border-warning/40 text-warning" :
                  "bg-card border-border text-muted-foreground";
                return (
                  <Fragment key={a.id}>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11.5px] font-medium ${cls}`}>
                      <span className="w-4 h-4 rounded-full bg-card/70 text-[9px] font-bold flex items-center justify-center">{a.approverAvatar}</span>
                      <span className="max-w-[140px] truncate">{a.approverName.split(" ").slice(-1)[0]}{isMe && " (you)"}</span>
                      {APPROVAL_ICONS[a.status]}
                    </span>
                    {i < shownList.length - 1 && <ArrowDown className="w-3 h-3 text-muted-2 -rotate-90" />}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}


      <div className="px-5 pb-5">
        <RightNow
          state={state}
          pendingApproval={pendingApproval}
          stage1={stage1}
          currentUser={currentUser}
          comment={comment}
          setComment={setComment}
          onApprove={onApprove}
          onReject={onReject}
        />
      </div>
    </div>
  );
};

/* ───────────────────────── Right-Now card ───────────────────────── */

type Tone = "primary" | "success" | "warning" | "danger" | "neutral";
const TONE_CLS: Record<Tone, { bg: string; border: string; kicker: string }> = {
  neutral: { bg: "bg-card",       border: "border-border",            kicker: "text-muted-foreground" },
  primary: { bg: "bg-primary-50", border: "border-primary-100",       kicker: "text-primary-600" },
  warning: { bg: "bg-warning-50", border: "border-warning/30",        kicker: "text-warning" },
  success: { bg: "bg-success-50", border: "border-success/30",        kicker: "text-success" },
  danger:  { bg: "bg-danger-50",  border: "border-destructive/30",    kicker: "text-destructive" },
};

const RightNow = ({
  state, pendingApproval, stage1, currentUser, comment, setComment, onApprove, onReject,
}: {
  state: CockpitState;
  pendingApproval?: ApprovalRecord;
  stage1: ApprovalRecord[];
  currentUser?: string;
  comment: string;
  setComment: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) => {
  if (state === "stage1-my-turn" && pendingApproval) {
    const myIdx = stage1.findIndex((a) => a.id === pendingApproval.id);
    const next = stage1.slice(myIdx + 1).find((a) => a.status === "In Queue") || stage1[myIdx + 1];
    const tone = TONE_CLS.warning;
    return (
      <div className={`rounded-lg border ${tone.border} ${tone.bg} p-5`}>
        <p className={`eyebrow ${tone.kicker} mb-2`}>Awaiting your decision</p>
        <h3 className="font-display text-[22px] font-bold text-foreground tracking-tight leading-[1.15]">
          Your approval is needed for this request
        </h3>
        <p className="text-[13.5px] text-foreground/80 mt-2 max-w-[640px] leading-[1.55]">
          You're <strong className="text-foreground">approver {pendingApproval.sequenceOrder} of {stage1.length}</strong> on the Stage 1 chain.
          {next && <> If you approve, the request moves to <strong className="text-foreground">{next.approverName}</strong> ({next.approverTitle}).</>}
          {" "}Once all {stage1.length} stage 1 approvers sign off, the request advances to KIA for Stage 2.
        </p>

        <div className="mt-4 flex items-center gap-2.5 text-muted-foreground max-w-[640px]">
          <ArrowDown className="w-3.5 h-3.5 shrink-0 animate-bounce" />
          <p className="text-[12.5px] font-medium leading-tight">Scroll down to verify request details before deciding.</p>
        </div>

        <div className="mt-5 bg-card border border-border rounded-md overflow-hidden">
          <div className="px-4 py-3 hairline flex items-center justify-between">
            <p className="eyebrow">Your decision</p>
            <span className="text-[11px] font-mono text-muted-foreground">
              Position {pendingApproval.sequenceOrder} of {stage1.length} · Stage 1
            </span>
          </div>
          <div className="px-4 py-3">
            <label className="field-label">
              Comment <span className="text-muted-2 normal-case font-normal tracking-normal">— required to reject, recommended to approve</span>
            </label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Approved — ensure the SLA is included in the contract."
              className="textarea h-[72px] resize-none" />
            <p className="text-[11px] text-muted-2 mt-1 font-mono">{comment.length}/1000</p>
          </div>
          <div className="px-4 py-3 bg-muted/30 flex items-center gap-2 border-t border-border">
            <button onClick={onApprove} className="btn btn-lg btn-primary">
              <CheckCircle2 className="w-4 h-4" /> Approve{next && ` and send to ${next.approverName.split(" ")[0]}`}
            </button>
            <button onClick={onReject} disabled={!comment.trim()}
              className={`btn btn-lg btn-danger ${!comment.trim() ? "opacity-60" : ""}`}>
              <X className="w-4 h-4" /> Reject{!comment.trim() ? " · add a comment" : ""}
            </button>
            <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
              <Lock className="w-3 h-3" /> Logged in audit trail
            </span>
          </div>
        </div>
      </div>
    );
  }

  const cfg: Record<CockpitState, { tone: Tone; kicker: string; headline: string; body: string }> = {
    "stage1-my-turn":       { tone: "warning", kicker: "Awaiting", headline: "", body: "" },
    "stage1-pending-other": {
      tone: "primary", kicker: "In review",
      headline: "Stage 1 approval in progress",
      body: `${stage1.filter(a => a.status === "Approved").length} of ${stage1.length} stage 1 approvers have signed off. Waiting on ${stage1.find(a => a.status === "Awaiting Approval")?.approverName ?? "the next approver"}.`,
    },
    "stage1-rejected": {
      tone: "danger", kicker: "Terminal",
      headline: "Rejected at Stage 1",
      body: "An internal approver rejected this request. To proceed with the same requirement, edit the request and resubmit — a fresh approval batch will be triggered.",
    },
    "awaiting-kia": {
      tone: "primary", kicker: "Next step",
      headline: "Awaiting KIA decision",
      body: "Stage 1 is complete. KIA has received the request. Upload the signed KIA response to record the decision — then mark this request Approved, Rejected, or Referred to SAB.",
    },
    "kia-approved": {
      tone: "warning", kicker: "Almost done",
      headline: "Add the contract reference to close this request",
      body: "KIA approval is complete. Enter the issued contract reference to move the request to Complete.",
    },
    "complete": {
      tone: "success", kicker: "Finalised",
      headline: "This request is complete",
      body: "KIA approval received, contract reference issued. No further actions required. Export the audit pack or share a link with stakeholders.",
    },
    "rejected": {
      tone: "danger", kicker: "Terminal",
      headline: "This request was rejected",
      body: "No further actions can be taken. To restart procurement for the same requirement, duplicate this request as a draft.",
    },
  };
  const c = cfg[state];
  const tone = TONE_CLS[c.tone];

  return (
    <div className={`rounded-lg border ${tone.border} ${tone.bg} p-5`}>
      <p className={`eyebrow ${tone.kicker} mb-2`}>{c.kicker}</p>
      <h3 className="font-display text-[22px] font-bold text-foreground tracking-tight leading-[1.15]">
        {c.headline}
      </h3>
      <p className="text-[13.5px] text-foreground/80 mt-2 max-w-[640px] leading-[1.55]">{c.body}</p>
      {state === "awaiting-kia" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-lg btn-primary"><Upload className="w-4 h-4" /> Upload KIA document</button>
        </div>
      )}
      {state === "kia-approved" && (
        <div className="mt-4 flex items-center gap-2">
          <input className="input max-w-[280px] font-mono" placeholder="e.g. KIO-2026-IT-014" />
          <button className="btn btn-lg btn-primary"><Check className="w-4 h-4" /> Save reference</button>
        </div>
      )}
      {state === "complete" && (
        <div className="mt-4">
          <button className="btn btn-secondary"><Download className="w-3.5 h-3.5" /> Export audit pack (PDF)</button>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── Request facts grid ───────────────────────── */

type FactKind = "text" | "area" | "dept" | "budget" | "rfp" | "start" | "cost";
type FactRow = {
  label: string;
  value: React.ReactNode;
  display?: string;
  wide?: boolean;
  mono?: boolean;
  derived?: string;
  editKey?: keyof RequestDraft;
  kind?: FactKind;
};

const RequestFacts = ({
  request, editing, draft, setDraft,
}: {
  request: ProcurementRequest;
  editing: boolean;
  draft: RequestDraft;
  setDraft: React.Dispatch<React.SetStateAction<RequestDraft>>;
}) => {
  const set = <K extends keyof RequestDraft>(k: K, v: RequestDraft[K]) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  const rfpDisplay = request.rfpConducted
    ? (request.rfpSummary || "RFP conducted.")
    : (request.rfpNoReason || "No RFP conducted.");

  const rows: FactRow[] = [
    { label: "Description", value: request.description, wide: true, editKey: "description", kind: "area" },
    { label: "Other details", value: request.technicalSpecs || "—", wide: true, editKey: "technicalSpecs", kind: "area" },
    {
      label: "RFP / tender",
      value: rfpDisplay,
      wide: true,
      kind: "rfp",
      derived: request.rfpConducted ? "Conducted" : "Not conducted",
    },
    { label: "Department", value: request.department, editKey: "department", kind: "dept" },
    { label: "Value (inc. VAT)", value: formatKwd(request.totalValueKwd), mono: true, derived: "From supplier offers" },
    { label: "Budget code", value: request.budgetCode, mono: true, editKey: "budgetCode", kind: "budget" },
    { label: "Contract duration", value: request.contractDuration, editKey: "contractDuration", kind: "text" },
    { label: "Contract start", value: fmtContractStart(request), kind: "start", editKey: "contractStart" },
    { label: "Contract cost", value: fmtContractCost(request.contractCost), mono: true, kind: "cost", editKey: "contractCost", wide: true },
    { label: "Requisition no.", value: request.requisitionNumber || "—", mono: true, editKey: "requisitionNumber", kind: "text" },
    { label: "Created", value: new Date(request.createdAt).toLocaleString("en-GB"), mono: true, derived: "System timestamp" },
    { label: "Last modified", value: new Date(request.modifiedAt).toLocaleString("en-GB"), mono: true, derived: "System timestamp" },
  ];


  return (
    <div className={`card overflow-hidden ${editing ? "ring-2 ring-warning/40" : ""}`}>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
        {rows.map((r, i) => {
          const isStructured = r.kind === "rfp" || r.kind === "start" || r.kind === "cost";
          const canEdit = editing && r.editKey && !isStructured;
          const isStructuredEdit = editing && isStructured;
          return (
            <div key={i} className={`px-5 py-3 ${r.wide ? "sm:col-span-2" : ""} ${i < rows.length - 1 ? "border-b border-border" : ""}`}>
              <dt className="eyebrow flex items-center gap-1.5">
                {r.label}
                {editing && r.derived && !canEdit && !isStructuredEdit && (
                  <span className="text-[10px] font-mono text-muted-2 normal-case tracking-normal">· {r.derived}</span>
                )}
              </dt>
              {canEdit ? (
                r.kind === "area" ? (
                  <Textarea
                    rows={3}
                    className="mt-1.5 text-[13px]"
                    value={(draft[r.editKey!] as string) ?? ""}
                    onChange={(e) => set(r.editKey!, e.target.value as never)}
                  />
                ) : r.kind === "dept" ? (
                  <select
                    className="input mt-1.5 text-[13px] w-full"
                    value={draft.department}
                    onChange={(e) => set("department", e.target.value)}
                  >
                    {RD_DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : r.kind === "budget" ? (
                  <select
                    className="input mt-1.5 text-[13px] w-full font-mono"
                    value={draft.budgetCode}
                    onChange={(e) => set("budgetCode", e.target.value)}
                  >
                    {RD_BUDGET_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <Input
                    className={`mt-1.5 text-[13px] ${r.mono ? "font-mono" : ""}`}
                    value={(draft[r.editKey!] as string) ?? ""}
                    onChange={(e) => set(r.editKey!, e.target.value as never)}
                  />
                )
              ) : isStructuredEdit && r.kind === "rfp" ? (
                <div className="mt-1.5 space-y-2">
                  <div className="flex items-center gap-3 text-[12.5px]">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" checked={!!draft.rfpConducted}
                        onChange={() => setDraft({ ...draft, rfpConducted: true })} />
                      RFP conducted
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" checked={!draft.rfpConducted}
                        onChange={() => setDraft({ ...draft, rfpConducted: false })} />
                      No RFP
                    </label>
                  </div>
                  <Textarea
                    rows={2}
                    className="text-[13px]"
                    placeholder={draft.rfpConducted ? "Summary of the RFP process" : "Reason no RFP was conducted"}
                    value={(draft.rfpConducted ? draft.rfpSummary : draft.rfpNoReason) ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        ...(draft.rfpConducted
                          ? { rfpSummary: e.target.value }
                          : { rfpNoReason: e.target.value }),
                      })
                    }
                  />
                </div>
              ) : isStructuredEdit && r.kind === "start" ? (
                <div className="mt-1.5 space-y-2">
                  <Input
                    type="date"
                    className="text-[13px] font-mono max-w-[200px]"
                    value={draft.contractStart ? draft.contractStart.slice(0, 10) : ""}
                    onChange={(e) => set("contractStart", e.target.value ? new Date(e.target.value).toISOString() : undefined as never)}
                  />
                  <label className="inline-flex items-center gap-1.5 text-[12.5px] cursor-pointer">
                    <input type="checkbox" checked={!!draft.contractStartEstimated}
                      onChange={(e) => set("contractStartEstimated", e.target.checked as never)} />
                    Estimated start date
                  </label>
                </div>
              ) : isStructuredEdit && r.kind === "cost" ? (
                <ContractCostEditor
                  cost={draft.contractCost}
                  onChange={(c) => set("contractCost", c)}
                />
              ) : (
                <dd className={`mt-1 text-[13.5px] text-foreground leading-[1.5] ${r.mono ? "font-mono" : ""}`}>
                  {r.value}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    </div>
  );
};

/* ───────────────────────── Contract cost editor ───────────────────────── */

const COST_CURRENCIES = ["KWD", "USD", "EUR", "GBP", "SAR", "AED", "BHD"];

const ContractCostEditor = ({
  cost, onChange,
}: { cost?: ContractCost; onChange: (c: ContractCost) => void }) => {
  const c: ContractCost = cost ?? { currency: "KWD", type: "recurring", amount: 0, freq: "year", periods: 1 };
  const upd = (patch: Partial<ContractCost>) => onChange({ ...c, ...patch });
  return (
    <div className="mt-1.5 space-y-2">
      <div className="flex items-center gap-3 text-[12.5px]">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="radio" checked={c.type === "recurring"} onChange={() => upd({ type: "recurring" })} />
          Recurring
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="radio" checked={c.type === "oneoff"} onChange={() => upd({ type: "oneoff" })} />
          One-off
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="field-label">Currency</label>
          <select className="input text-[13px] w-full font-mono" value={c.currency}
            onChange={(e) => upd({ currency: e.target.value })}>
            {COST_CURRENCIES.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
          </select>
        </div>
        {c.type === "recurring" ? (
          <>
            <div>
              <label className="field-label">Amount</label>
              <Input type="number" className="text-[13px] font-mono"
                value={c.amount ?? ""} onChange={(e) => upd({ amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="field-label">Frequency</label>
              <select className="input text-[13px] w-full" value={c.freq ?? "year"}
                onChange={(e) => upd({ freq: e.target.value as ContractCost["freq"] })}>
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div>
              <label className="field-label">Periods</label>
              <Input type="number" className="text-[13px] font-mono"
                value={c.periods ?? ""} onChange={(e) => upd({ periods: parseInt(e.target.value) || 0 })} />
            </div>
          </>
        ) : (
          <div className="col-span-3">
            <label className="field-label">One-off amount</label>
            <Input type="number" className="text-[13px] font-mono"
              value={c.oneOff ?? ""} onChange={(e) => upd({ oneOff: parseFloat(e.target.value) || 0 })} />
          </div>
        )}
      </div>
      <p className="text-[11px] font-mono text-muted-2">Preview: {fmtContractCost(c)}</p>
    </div>
  );
};

/* ───────────────────────── Suppliers table ───────────────────────── */

const SUPP_CCY_RATES: Record<string, number> = {
  KWD: 1, USD: 0.31, EUR: 0.28, GBP: 0.24, SAR: 1.15, AED: 1.13, BHD: 0.12,
};

const Suppliers = ({
  request, editing, draft, setDraft,
}: {
  request: ProcurementRequest;
  editing: boolean;
  draft: RequestDraft;
  setDraft: React.Dispatch<React.SetStateAction<RequestDraft>>;
}) => {
  const list = editing ? draft.suppliers : request.suppliers;

  const updateSupplier = (idx: number, patch: Partial<typeof list[number]>) => {
    setDraft((prev) => {
      const next = prev.suppliers.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      // auto-recalc KWD
      const s = next[idx];
      if (("totalInclVat" in patch || "currency" in patch) && s.totalInclVat) {
        const rate = SUPP_CCY_RATES[s.currency] ?? 1;
        next[idx] = { ...s, totalKwd: +(s.totalInclVat * rate).toFixed(3) };
      }
      // ensure single recommendation
      if (patch.recommended === true) {
        next.forEach((x, i) => { if (i !== idx) x.recommended = false; });
      }
      return { ...prev, suppliers: next };
    });
  };

  const addSupplier = () => {
    if (draft.suppliers.length >= 5) return;
    setDraft((prev) => ({
      ...prev,
      suppliers: [
        ...prev.suppliers,
        {
          id: `sup-${Date.now()}`, companyName: "", currency: "KWD",
          totalExclVat: 0, totalInclVat: 0, totalKwd: 0,
          recommended: false, justification: "", files: [],
        },
      ],
    }));
  };

  const removeSupplier = (idx: number) => {
    setDraft((prev) => ({ ...prev, suppliers: prev.suppliers.filter((_, i) => i !== idx) }));
  };

  const addFiles = (idx: number, files: FileList | null) => {
    if (!files) return;
    const additions = Array.from(files).map((f) => ({ name: f.name, size: f.size }));
    setDraft((prev) => {
      const next = prev.suppliers.map((s, i) =>
        i === idx ? { ...s, files: [...s.files, ...additions] } : s,
      );
      return { ...prev, suppliers: next };
    });
  };

  const removeFile = (idx: number, fileIdx: number) => {
    setDraft((prev) => {
      const next = prev.suppliers.map((s, i) =>
        i === idx ? { ...s, files: s.files.filter((_, k) => k !== fileIdx) } : s,
      );
      return { ...prev, suppliers: next };
    });
  };

  if (list.length === 0 && !editing) {
    return <div className="card p-8 text-center text-[13px] text-muted-foreground">No supplier offers added.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[860px]">
            <thead className="text-[11px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2.5">Supplier</th>
                <th className="text-left px-2 py-2.5 w-[80px]">Currency</th>
                <th className="text-right px-2 py-2.5">Excl. VAT</th>
                <th className="text-right px-2 py-2.5">Incl. VAT</th>
                <th className="text-right px-3 py-2.5 whitespace-nowrap">KWD Incl VAT</th>
                <th className="text-left px-3 py-2.5">Expiry</th>
                <th className="text-center px-3 py-2.5">Files</th>
                {editing && <th className="text-center px-2 py-2.5 w-[80px]">Pick</th>}
                {editing && <th className="px-2 py-2.5 w-[40px]"></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <Fragment key={s.id}>
                  <tr className={`${i < list.length - 1 ? "border-b border-border" : ""} ${s.recommended ? "bg-warning/5" : ""} align-top`}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        {!editing && s.recommended && (
                          <Star className="w-3.5 h-3.5 text-warning fill-warning mt-1 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          {editing ? (
                            <Input value={s.companyName} placeholder="Company name"
                              className="h-8 text-[13px]"
                              onChange={(e) => updateSupplier(i, { companyName: e.target.value })} />
                          ) : (
                            <p className="font-semibold text-foreground">{s.companyName}</p>
                          )}
                          {!editing && s.recommended && s.justification && (
                            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug max-w-[320px]">{s.justification}</p>
                          )}
                          {!editing && s.notes && !s.recommended && (
                            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug max-w-[320px]">{s.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[12px] text-muted-foreground">
                      {editing ? (
                        <select className="input h-8 text-[12.5px] w-full font-mono" value={s.currency}
                          onChange={(e) => updateSupplier(i, { currency: e.target.value })}>
                          {COST_CURRENCIES.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
                        </select>
                      ) : s.currency}
                    </td>
                    <td className="px-2 py-2.5 text-right num text-foreground/80">
                      {editing ? (
                        <Input type="number" value={s.totalExclVat || ""}
                          className="h-8 text-[13px] font-mono text-right"
                          onChange={(e) => updateSupplier(i, { totalExclVat: parseFloat(e.target.value) || 0 })} />
                      ) : s.totalExclVat.toLocaleString("en", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-2 py-2.5 text-right num text-foreground/80">
                      {editing ? (
                        <Input type="number" value={s.totalInclVat || ""}
                          className="h-8 text-[13px] font-mono text-right"
                          onChange={(e) => updateSupplier(i, { totalInclVat: parseFloat(e.target.value) || 0 })} />
                      ) : s.totalInclVat.toLocaleString("en", { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`px-3 py-2.5 text-right num font-semibold ${s.recommended ? "text-foreground" : "text-foreground/80"}`}>
                      {s.totalKwd.toLocaleString("en", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-muted-foreground font-mono">
                      {editing ? (
                        <Input type="date" value={s.priceExpiryDate ?? ""}
                          className="h-8 text-[12.5px] font-mono"
                          onChange={(e) => updateSupplier(i, { priceExpiryDate: e.target.value })} />
                      ) : (s.priceExpiryDate ?? "—")}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.files.length === 0 && !editing ? (
                        <div className="text-center text-muted-2 font-mono text-[12px]">—</div>
                      ) : (
                        <div className="flex flex-col items-stretch gap-1">
                          {s.files.map((f, k) => (
                            <div key={k} className="flex items-center gap-1.5 group">
                              <button type="button" onClick={() => openFile(f.name)}
                                className="inline-flex items-center gap-1 text-[11.5px] font-mono text-primary hover:underline truncate max-w-[180px] text-left">
                                <FileText className="w-3 h-3 shrink-0" />
                                <span className="truncate">{f.name}</span>
                              </button>
                              {editing && (
                                <button onClick={() => removeFile(i, k)}
                                  className="opacity-60 hover:opacity-100 hover:text-destructive">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          {editing && (
                            <label className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-primary cursor-pointer mt-0.5">
                              <Upload className="w-3 h-3" /> Add
                              <input type="file" multiple className="hidden"
                                onChange={(e) => { addFiles(i, e.target.files); e.target.value = ""; }} />
                            </label>
                          )}
                        </div>
                      )}
                    </td>
                    {editing && (
                      <td className="px-2 py-2.5 text-center">
                        <button type="button"
                          onClick={() => updateSupplier(i, { recommended: !s.recommended })}
                          title={s.recommended ? "Recommended" : "Mark as recommended"}
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors
                            ${s.recommended
                              ? "bg-warning/15 border-warning/40 text-warning"
                              : "border-border text-muted-2 hover:text-warning hover:border-warning/40"}`}>
                          <Star className={`w-3.5 h-3.5 ${s.recommended ? "fill-warning" : ""}`} />
                        </button>
                      </td>
                    )}
                    {editing && (
                      <td className="px-2 py-2.5 text-center">
                        {list.length > 1 && (
                          <button onClick={() => removeSupplier(i)}
                            className="text-muted-2 hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  {editing && (
                    <tr className={`${i < list.length - 1 ? "border-b border-border" : ""} ${s.recommended ? "bg-warning/5" : ""}`}>
                      <td colSpan={9} className="px-3 pb-3 pt-0">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1">
                            <Input value={s.notes ?? ""} placeholder="Notes (optional)"
                              className="h-8 text-[12.5px]"
                              onChange={(e) => updateSupplier(i, { notes: e.target.value })} />
                          </div>
                          {s.recommended && (
                            <div className="flex-1">
                              <Input value={s.justification ?? ""} placeholder="Justification for recommendation"
                                className="h-8 text-[12.5px] bg-warning/5 border-warning/30"
                                onChange={(e) => updateSupplier(i, { justification: e.target.value })} />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing && draft.suppliers.length < 5 && (
        <button onClick={addSupplier} className="btn btn-secondary w-full">
          <Plus className="w-3.5 h-3.5" /> Add supplier ({draft.suppliers.length}/5)
        </button>
      )}
    </div>
  );
};

/* ───────────────────────── Approval ledger ───────────────────────── */

const ApprovalLedger = ({ request, currentUser }: { request: ProcurementRequest; currentUser?: string }) => {
  const stages = [1, 2] as const;
  return (
    <div className="space-y-4">
      {stages.map((stage) => {
        const list = request.approvals.filter((a) => a.stage === stage).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        if (list.length === 0) return null;
        const approvedCount = list.filter((a) => a.status === "Approved").length;
        const hasReject = list.some((a) => a.status === "Rejected");
        const complete = approvedCount === list.length;
        const chip = hasReject ? "chip-red" : complete ? "chip-green" : "chip-blue";
        const chipLabel = hasReject ? "Rejected" : complete ? "Complete" : `${approvedCount}/${list.length} approved`;
        return (
          <div key={stage} className="card">
            <header className="px-5 py-3 hairline flex items-center justify-between">
              <p className="eyebrow">Stage {stage} · {stage === 1 ? "KIO Internal Approval" : "KIA External Approval"}</p>
              <span className={`chip ${chip}`}>{chipLabel}</span>
            </header>
            <div>
              {list.map((a, i) => {
                const isMe = a.approverName === currentUser;
                return (
                  <div key={a.id} className={`px-5 py-3.5 flex items-start gap-3 ${i < list.length - 1 ? "hairline" : ""}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0
                      ${isMe ? "bg-primary text-primary-foreground ring-2 ring-primary-50" : "bg-primary-50 text-primary-600"}`}>
                      {a.approverAvatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-foreground">
                          {a.approverName}
                          {isMe && <span className="ml-1.5 text-[10.5px] font-bold text-primary uppercase tracking-wider">You</span>}
                        </p>
                        <span className="chip chip-gray">{a.approverType}</span>
                      </div>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">{a.approverTitle}</p>
                      {a.comments && (
                        <p className="text-[12.5px] text-foreground/80 mt-1.5 leading-[1.5] italic">"{a.comments}"</p>
                      )}
                      {a.decidedAt && (
                        <p className="text-[11px] text-muted-2 font-mono mt-1">{new Date(a.decidedAt).toLocaleString("en-GB")}</p>
                      )}
                    </div>
                    <span className={`chip shrink-0
                      ${a.status === "Approved" ? "chip-green" :
                        a.status === "Rejected" ? "chip-red" :
                        a.status === "Awaiting Approval" ? "chip-amber" : "chip-gray"}`}>
                      {APPROVAL_ICONS[a.status]} {a.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ───────────────────────── Supporting documents ───────────────────────── */

const SupportingDocs = ({
  request, editing, draft, setDraft,
}: {
  request: ProcurementRequest;
  editing: boolean;
  draft: RequestDraft;
  setDraft: React.Dispatch<React.SetStateAction<RequestDraft>>;
}) => {
  const list = editing ? draft.evidenceFiles : request.evidenceFiles;
  const kb = (n: number) => n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const additions = Array.from(files).map((f) => ({
      id: `ev-${Date.now()}-${f.name}`,
      name: f.name,
      size: f.size,
      uploadedAt: new Date().toISOString(),
      documentType: "general" as const,
    }));
    setDraft((prev) => ({ ...prev, evidenceFiles: [...prev.evidenceFiles, ...additions] }));
  };

  const removeFile = (id: string) => {
    setDraft((prev) => ({ ...prev, evidenceFiles: prev.evidenceFiles.filter((f) => f.id !== id) }));
  };

  const replaceFile = (id: string, files: FileList | null) => {
    if (!files || !files[0]) return;
    const f = files[0];
    setDraft((prev) => ({
      ...prev,
      evidenceFiles: prev.evidenceFiles.map((d) =>
        d.id === id ? { ...d, name: f.name, size: f.size, uploadedAt: new Date().toISOString() } : d,
      ),
    }));
  };

  if (list.length === 0 && !editing) {
    return <div className="card p-6 text-center text-[13px] text-muted-foreground">No supporting documents attached.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <div className="px-5 py-6 text-center text-[13px] text-muted-foreground">No supporting documents attached.</div>
        ) : list.map((d, i) => (
          <div key={d.id} className={`px-5 py-3 flex items-center gap-3 ${i < list.length - 1 ? "hairline" : ""}`}>
            <div className="w-8 h-8 rounded-md border bg-primary-50 border-primary-100 text-primary-600 flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => openFile(d.name)}
                className="text-[13px] font-semibold text-foreground hover:text-primary hover:underline truncate block text-left max-w-full">
                {d.name}
              </button>
              <p className="text-[11.5px] text-muted-foreground font-mono mt-px">
                {d.documentType} · {kb(d.size)} · {new Date(d.uploadedAt).toLocaleDateString("en-GB")}
              </p>
            </div>
            {editing ? (
              <div className="flex items-center gap-1 shrink-0">
                <label className="btn btn-ghost btn-sm h-7 px-2 cursor-pointer text-[12px]">
                  <RotateCcw className="w-3.5 h-3.5" /> Replace
                  <input type="file" className="hidden"
                    onChange={(e) => { replaceFile(d.id, e.target.files); e.target.value = ""; }} />
                </label>
                <button onClick={() => removeFile(d.id)} className="btn btn-ghost btn-sm h-7 w-7 p-0 text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openFile(d.name)} className="btn btn-ghost btn-sm h-7 w-7 p-0" title="Open in new tab">
                  <FileText className="w-3.5 h-3.5" />
                </button>
                <button className="btn btn-ghost btn-sm h-7 w-7 p-0" title="Download">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <label className="btn btn-secondary w-full cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> Add supporting documents
          <input type="file" multiple className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
};

/* ───────────────────────── Activity ───────────────────────── */

const Activity = ({ request }: { request: ProcurementRequest }) => {
  if (request.activity.length === 0) {
    return <div className="card p-6 text-center text-[13px] text-muted-foreground">No activity recorded.</div>;
  }
  return (
    <div className="card py-1.5">
      {request.activity.map((ev, i) => (
        <div key={ev.id} className="px-5 py-2.5 flex items-start gap-3 relative">
          <div className="relative shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
            {i < request.activity.length - 1 && (
              <div className="absolute left-[3px] top-3 bottom-[-12px] w-px bg-border" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-foreground/80 leading-snug">{ev.action}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">{ev.performedBy}</span>
              <span className="text-[11px] text-muted-2">·</span>
              <span className="text-[11px] text-muted-foreground font-mono">{new Date(ev.timestamp).toLocaleString("en-GB")}</span>
            </div>
            {ev.details && <p className="text-[11.5px] text-muted-foreground mt-0.5 italic">{ev.details}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ───────────────────────── Decision row ───────────────────────── */

const DecisionRow = ({ approval, compact = false }: { approval: ApprovalRecord; compact?: boolean }) => (
  <div className={`flex items-start gap-3 p-3 rounded-lg border bg-card ${compact ? "" : "bg-muted/30"}`}>
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
      {approval.approverAvatar}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{approval.approverName}</p>
        <span className="chip chip-gray">{approval.approverType}</span>
        <span className="inline-flex items-center gap-1 text-xs">
          {APPROVAL_ICONS[approval.status]}
          <span className={
            approval.status === "Approved" ? "text-success" :
            approval.status === "Rejected" ? "text-destructive" : "text-muted-foreground"
          }>{approval.status}</span>
        </span>
      </div>
      {approval.comments && <p className="text-sm text-foreground mt-1.5">{approval.comments}</p>}
      {approval.decidedAt && (
        <p className="text-xs text-muted-foreground mt-1">{new Date(approval.decidedAt).toLocaleString("en-GB")}</p>
      )}
    </div>
  </div>
);

export default RequestDetail;
