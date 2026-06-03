import { Fragment, useMemo, useState } from "react";
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
  AlertCircle, FileText, Pencil, RotateCcw, ChevronDown, Workflow,
  Users, Check, X, ArrowDown, Upload, Lock,
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
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-[900px] mx-auto px-5 py-6">
        {/* Top bar */}
        <button onClick={() => navigate("/")} className="btn btn-ghost btn-sm mb-3 -ml-2">
          <ArrowLeft className="w-3.5 h-3.5" /> All requests
        </button>

        {/* Header */}
        <header className={`card px-5 py-4 mb-5 ${editing ? "ring-2 ring-warning/40" : ""}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="font-mono text-[13px] font-bold text-primary">{request.trackerNumber}</span>
                <CockpitChip state={cockpitState} />
                {editing && <span className="chip chip-amber">Editing — approvals will restart on save</span>}
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
              <p className="text-[12.5px] text-muted-foreground mt-1.5">
                {request.department} · Owner {request.owner} · {formatKwd(request.totalValueKwd)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!editing && canEdit && request.status !== "Draft" && (
                <button onClick={beginEdit} className="btn btn-secondary">
                  <Pencil className="w-3.5 h-3.5" /> Edit request
                </button>
              )}
              {editing && (
                <>
                  <button onClick={cancelEdit} className="btn btn-secondary">
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button onClick={requestSave} className="btn btn-primary">
                    <RotateCcw className="w-3.5 h-3.5" /> Save & restart approvals
                  </button>
                </>
              )}
              {!editing && (
                <>
                  <button className="btn btn-secondary"
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/request/${request.id}`); toast.success("Link copied"); }}>
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </button>
                  <button className="btn btn-secondary" onClick={() => toast.info("PDF export coming soon")}>
                    <FileDown className="w-3.5 h-3.5" /> Export
                  </button>
                </>
              )}
            </div>
          </div>
          {editing && (
            <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[12.5px] text-foreground leading-snug">
                  <strong>Editing in progress.</strong> On save, Batch #{(request.archivedApprovalBatches?.length ?? 0) + 1}
                  {" "}({request.approvals.filter(a => a.status === "Approved").length} of {request.approvals.length} approved)
                  will be archived, and a fresh batch restarts from the first approver.
                </p>
                <Textarea
                  rows={2}
                  className="mt-2 text-[12.5px]"
                  placeholder="Reason for restart (recommended) — e.g. Scope updated after Finance feedback"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                />
              </div>
            </div>
          )}
        </header>

        {/* Confirm modal */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Restart approvals?</DialogTitle>
              <DialogDescription>
                Saving will stop and archive the current approval batch
                (Batch #{(request.archivedApprovalBatches?.length ?? 0) + 1},
                {" "}{request.approvals.filter(a => a.status === "Approved").length} of {request.approvals.length} approved).
                A fresh batch starts from the first approver — prior approvals do not carry over.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit}>
                <RotateCcw className="w-4 h-4 mr-1" /> Confirm & restart
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* ─── 1. Stage Cockpit (priority view) ─── */}
        <section className="mb-6">
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
        </section>

        {/* ─── 2. Request facts ─── */}
        <SectionTitle kicker="Section 01" title="Request details" />
        <RequestFacts request={request} editing={editing} draft={draft} setDraft={setDraft} />

        {/* ─── 3. Suppliers ─── */}
        <SectionTitle kicker="Section 02" title="Supplier offers" count={request.suppliers.length} />
        <Suppliers request={request} />

        {/* ─── 4. Approval ledger ─── */}
        <SectionTitle kicker="Section 03" title="Approval ledger" />
        <ApprovalLedger request={request} currentUser={user?.name} />

        {/* ─── 5. Supporting documents ─── */}
        <SectionTitle kicker="Section 04" title="Supporting documents"
          count={request.evidenceFiles.length} />
        <SupportingDocs request={request} />

        {/* ─── 6. Archived batches ─── */}
        {request.archivedApprovalBatches && request.archivedApprovalBatches.length > 0 && (
          <>
            <SectionTitle kicker="History" title="Archived approval batches"
              count={request.archivedApprovalBatches.length} />
            <div className="space-y-2 mb-7">
              {request.archivedApprovalBatches.map((batch, idx) => (
                <Collapsible key={batch.id} className="card overflow-hidden">
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 text-left">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Batch #{idx + 1} · archived {new Date(batch.archivedAt).toLocaleString("en-GB")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        By {batch.archivedBy}{batch.reason && <> · {batch.reason}</>}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4 pt-1 space-y-2 bg-muted/20">
                    {batch.approvals.map((a) => <DecisionRow key={a.id} approval={a} compact />)}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </>
        )}

        {/* ─── 7. Activity ─── */}
        <SectionTitle kicker="Audit" title="Activity" />
        <Activity request={request} />
      </main>
    </div>
  );
};

/* ───────────────────────── Section title ───────────────────────── */

const SectionTitle = ({ kicker, title, count }: { kicker: string; title: string; count?: number }) => (
  <div className="flex items-end justify-between mb-3 mt-7">
    <div>
      <p className="eyebrow">{kicker}</p>
      <h2 className="font-display text-[18px] font-bold text-foreground tracking-tight leading-tight">
        {title}
        {count != null && <span className="text-muted-2 font-medium font-mono ml-1.5 text-[14px]">{count}</span>}
      </h2>
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

      {/* Right-Now card */}
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

type FactKind = "text" | "area" | "dept" | "budget" | "rfp";
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
    { label: "Contract start", value: fmtContractStart(request), derived: request.contractStartEstimated ? "Estimated" : "From contract" },
    { label: "Contract cost", value: fmtContractCost(request.contractCost), mono: true, derived: "Total contract value" },
    { label: "Requisition no.", value: request.requisitionNumber || "—", mono: true, editKey: "requisitionNumber", kind: "text" },
    { label: "Created", value: new Date(request.createdAt).toLocaleString("en-GB"), mono: true, derived: "System timestamp" },
    { label: "Last modified", value: new Date(request.modifiedAt).toLocaleString("en-GB"), mono: true, derived: "System timestamp" },
  ];

  return (
    <div className={`card overflow-hidden ${editing ? "ring-2 ring-warning/40" : ""}`}>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
        {rows.map((r, i) => {
          const canEdit = editing && r.editKey;
          const isRfpEdit = editing && r.kind === "rfp";
          return (
            <div key={i} className={`px-5 py-3 ${r.wide ? "sm:col-span-2" : ""} ${i < rows.length - 1 ? "border-b border-border" : ""}`}>
              <dt className="eyebrow flex items-center gap-1.5">
                {r.label}
                {editing && r.derived && !canEdit && !isRfpEdit && (
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
              ) : isRfpEdit ? (
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

/* ───────────────────────── Suppliers table ───────────────────────── */

const Suppliers = ({ request }: { request: ProcurementRequest }) => {
  if (request.suppliers.length === 0) {
    return <div className="card p-8 text-center text-[13px] text-muted-foreground">No supplier offers added.</div>;
  }
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[640px]">
          <thead className="text-[11px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-3 py-2.5">Supplier</th>
              <th className="text-left px-2 py-2.5 w-[70px]">Currency</th>
              <th className="text-right px-2 py-2.5">Excl. VAT</th>
              <th className="text-right px-2 py-2.5">Incl. VAT</th>
              <th className="text-right px-3 py-2.5 whitespace-nowrap">KWD Incl VAT</th>
              <th className="text-left px-3 py-2.5">Expiry</th>
              <th className="text-center px-3 py-2.5">Files</th>
            </tr>
          </thead>
          <tbody>
            {request.suppliers.map((s, i) => (
              <Fragment key={s.id}>
                <tr className={`${i < request.suppliers.length - 1 ? "border-b border-border" : ""} ${s.recommended ? "bg-warning/5" : ""}`}>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-start gap-2">
                      {s.recommended && (
                        <Star className="w-3.5 h-3.5 text-warning fill-warning mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">{s.companyName}</p>
                        {s.recommended && s.justification && (
                          <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug max-w-[320px]">{s.justification}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 font-mono text-[12px] text-muted-foreground align-top">{s.currency}</td>
                  <td className="px-2 py-3 text-right num text-foreground/80 align-top">{s.totalExclVat.toLocaleString("en", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-3 text-right num text-foreground/80 align-top">{s.totalInclVat.toLocaleString("en", { minimumFractionDigits: 2 })}</td>
                  <td className={`px-3 py-3 text-right num font-semibold align-top ${s.recommended ? "text-foreground" : "text-foreground/80"}`}>
                    {s.totalKwd.toLocaleString("en", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-muted-foreground font-mono align-top">{s.priceExpiryDate ?? "—"}</td>
                  <td className="px-3 py-3 align-top">
                    {s.files.length === 0
                      ? <div className="text-center text-muted-2 font-mono text-[12px]">—</div>
                      : <div className="flex flex-col items-center gap-1">
                          {s.files.map((f, k) => (
                            <span key={k} className="inline-flex items-center gap-1 text-[11px] font-mono text-primary truncate max-w-[140px]">
                              <FileText className="w-3 h-3 shrink-0" /> <span className="truncate">{f.name}</span>
                            </span>
                          ))}
                        </div>}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
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

const SupportingDocs = ({ request }: { request: ProcurementRequest }) => {
  if (request.evidenceFiles.length === 0) {
    return <div className="card p-6 text-center text-[13px] text-muted-foreground">No supporting documents attached.</div>;
  }
  const kb = (n: number) => n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;
  return (
    <div className="card overflow-hidden">
      {request.evidenceFiles.map((d, i) => (
        <div key={d.id} className={`px-5 py-3 flex items-center gap-3 ${i < request.evidenceFiles.length - 1 ? "hairline" : ""}`}>
          <div className="w-8 h-8 rounded-md border bg-primary-50 border-primary-100 text-primary-600 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground truncate">{d.name}</p>
            <p className="text-[11.5px] text-muted-foreground font-mono mt-px">
              {d.documentType} · {kb(d.size)} · {new Date(d.uploadedAt).toLocaleDateString("en-GB")}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm h-7 w-7 p-0"><Download className="w-3.5 h-3.5" /></button>
        </div>
      ))}
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
