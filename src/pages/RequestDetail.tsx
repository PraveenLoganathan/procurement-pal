import { Fragment as FragmentWithKey, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MOCK_REQUESTS } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import StageGate from "@/components/procurement/StageGate";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  ArrowLeft, Share2, FileDown, Trash2, Star, Download,
  CheckCircle2, XCircle, Clock, AlertCircle, FileText, User, ArrowRight,
  Pencil, History, RotateCcw, ChevronDown, Archive,
} from "lucide-react";
import type { ApprovalRecord, ApprovalStatus, ProcurementRequest } from "@/types/procurement";

const APPROVAL_ICONS: Record<ApprovalStatus, React.ReactNode> = {
  "In Queue": <Clock className="w-4 h-4 text-muted-foreground" />,
  "Awaiting Approval": <AlertCircle className="w-4 h-4 text-warning-foreground" />,
  Approved: <CheckCircle2 className="w-4 h-4 text-success" />,
  Rejected: <XCircle className="w-4 h-4 text-destructive" />,
};

const RequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const initial = useMemo(() => MOCK_REQUESTS.find((r) => r.id === id), [id]);
  const [request, setRequest] = useState<ProcurementRequest | undefined>(initial);
  const [comment, setComment] = useState("");

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editSubject, setEditSubject] = useState(initial?.subject ?? "");
  const [editDescription, setEditDescription] = useState(initial?.description ?? "");
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

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/request/${request.id}`);
    toast.success("Link copied to clipboard");
  };

  const pendingApproval = request.approvals.find(
    (a) => a.status === "Awaiting Approval" && a.approverName === user?.name,
  );

  const advanceAfterDecision = (approvals: ApprovalRecord[], decidedId: string, decision: "Approved" | "Rejected") => {
    const updated = approvals.map((a) =>
      a.id === decidedId
        ? { ...a, status: decision, decidedAt: new Date().toISOString(), comments: comment || a.comments }
        : a,
    );
    if (decision === "Rejected") return updated;

    // promote next In Queue in same stage; if stage done, promote first In Queue in next stage
    const decided = updated.find((a) => a.id === decidedId)!;
    const sameStageQueue = updated
      .filter((a) => a.stage === decided.stage && a.status === "In Queue")
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)[0];
    if (sameStageQueue) {
      return updated.map((a) => (a.id === sameStageQueue.id ? { ...a, status: "Awaiting Approval" as ApprovalStatus } : a));
    }
    const nextStageQueue = updated
      .filter((a) => a.stage > decided.stage && a.status === "In Queue")
      .sort((a, b) => a.stage - b.stage || a.sequenceOrder - b.sequenceOrder)[0];
    if (nextStageQueue) {
      return updated.map((a) => (a.id === nextStageQueue.id ? { ...a, status: "Awaiting Approval" as ApprovalStatus } : a));
    }
    return updated;
  };

  const handleApprove = () => {
    if (!pendingApproval) return;
    const newApprovals = advanceAfterDecision(request.approvals, pendingApproval.id, "Approved");
    const stillOpen = newApprovals.some((a) => a.status === "Awaiting Approval" || a.status === "In Queue");
    setRequest({
      ...request,
      approvals: newApprovals,
      status: stillOpen ? "Under Review" : "Approved",
      modifiedAt: new Date().toISOString(),
      activity: [
        ...request.activity,
        {
          id: `act-${Date.now()}`,
          action: `Approved by ${pendingApproval.approverName}`,
          performedBy: pendingApproval.approverName,
          timestamp: new Date().toISOString(),
          details: comment || undefined,
        },
      ],
    });
    setComment("");
    toast.success("Approval recorded");
  };

  const handleReject = () => {
    if (!pendingApproval) return;
    const newApprovals = advanceAfterDecision(request.approvals, pendingApproval.id, "Rejected");
    setRequest({
      ...request,
      approvals: newApprovals,
      status: "Rejected",
      modifiedAt: new Date().toISOString(),
      activity: [
        ...request.activity,
        {
          id: `act-${Date.now()}`,
          action: `Rejected by ${pendingApproval.approverName}`,
          performedBy: pendingApproval.approverName,
          timestamp: new Date().toISOString(),
          details: comment || undefined,
        },
      ],
    });
    setComment("");
    toast.error("Rejection recorded");
  };

  const resetApprovalsFresh = (existing: ApprovalRecord[]): ApprovalRecord[] => {
    const sorted = [...existing].sort((a, b) => a.stage - b.stage || a.sequenceOrder - b.sequenceOrder);
    return sorted.map((a, i) => ({
      ...a,
      id: `${a.id}-r${Date.now().toString(36)}`,
      status: i === 0 ? "Awaiting Approval" : "In Queue",
      comments: undefined,
      decidedAt: undefined,
    }));
  };

  const handleSaveEdit = () => {
    const previousApprovals = request.approvals;
    const freshApprovals = resetApprovalsFresh(previousApprovals);
    const now = new Date().toISOString();
    setRequest({
      ...request,
      subject: editSubject,
      description: editDescription,
      modifiedAt: now,
      status: "Under Review",
      approvals: freshApprovals,
      archivedApprovalBatches: [
        ...(request.archivedApprovalBatches ?? []),
        {
          id: `batch-${Date.now()}`,
          archivedAt: now,
          archivedBy: user?.name ?? "Unknown",
          reason: editReason || undefined,
          approvals: previousApprovals,
        },
      ],
      activity: [
        ...request.activity,
        {
          id: `act-edit-${Date.now()}`,
          action: "Request edited — approval workflow archived and restarted",
          performedBy: user?.name ?? "Unknown",
          timestamp: now,
          details: editReason || undefined,
        },
      ],
    });
    setEditOpen(false);
    setEditReason("");
    toast.success("Request updated · approvals archived and restarted");
  };

  const canEdit =
    user?.role === "ORG_SUPER" || user?.name === request.owner;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-mono text-primary font-medium">{request.trackerNumber}</span>
                <StatusBadge status={request.status} />
              </div>
              <h1 className="text-xl font-semibold text-foreground">{request.subject}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && request.status !== "Draft" && (
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Pencil className="w-4 h-4 mr-1" /> Edit request
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit request</DialogTitle>
                    <DialogDescription>
                      Saving changes will archive the current approval batch and start a fresh approval
                      cycle from the first approver. Existing decisions remain visible under{" "}
                      <span className="font-medium">Approval history</span>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
                      <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Description of deliverable
                      </label>
                      <Textarea
                        rows={4}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Reason for restart (recommended)
                      </label>
                      <Textarea
                        rows={2}
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="e.g. Scope updated after Finance feedback"
                      />
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-sm">
                      <AlertCircle className="w-4 h-4 mt-0.5 text-warning-foreground shrink-0" />
                      <div className="text-xs text-foreground">
                        <p className="font-semibold mb-0.5">
                          {request.approvals.filter((a) => a.status === "Approved").length} prior approval(s) will be
                          archived
                        </p>
                        <p className="text-muted-foreground">
                          A new batch of {request.approvals.length} approver(s) will receive the request, starting
                          with the first in the chain.
                        </p>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveEdit}>
                      <RotateCcw className="w-4 h-4 mr-1" /> Save & restart approvals
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-1" /> Share
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info("PDF export coming soon")}>
              <FileDown className="w-4 h-4 mr-1" /> Export PDF
            </Button>
            {user?.role === "ORG_SUPER" && request.status !== "Draft" && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details">
          <TabsList className="mb-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="suppliers">Supplier Offers</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            {request.status !== "Draft" && <TabsTrigger value="activity">Activity</TabsTrigger>}
          </TabsList>

          {/* Details tab */}
          <TabsContent value="details">
            <div className="section-card">
              <div className="p-6 space-y-5">
                <DetailRow label="Department" value={request.department} />
                <DetailRow label="Description" value={request.description} />
                <DetailRow label="Contract Duration" value={request.contractDuration} />
                {request.contractFrom && (
                  <DetailRow label="Contract Period" value={`${request.contractFrom} — ${request.contractTo}`} />
                )}
                <DetailRow label="Budget Code" value={request.budgetCode} />
                {request.requisitionNumber && <DetailRow label="Requisition No." value={request.requisitionNumber} />}
                {request.technicalSpecs && <DetailRow label="Technical Specifications" value={request.technicalSpecs} />}
                <DetailRow label="Owner" value={request.owner} />
                <DetailRow label="Created" value={new Date(request.createdAt).toLocaleString("en-GB")} />
                <DetailRow label="Last Modified" value={new Date(request.modifiedAt).toLocaleString("en-GB")} />
              </div>
            </div>
          </TabsContent>

          {/* Suppliers tab — tabular layout */}
          <TabsContent value="suppliers">
            <div className="space-y-5">
              <div className="section-card overflow-hidden">
                <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Supplier offers</h3>
                  <span className="text-xs text-muted-foreground">{request.suppliers.length} offer(s)</span>
                </div>
                {request.suppliers.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-sm">No supplier offers added.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[36px]"></TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="w-[80px]">Currency</TableHead>
                        <TableHead className="text-right">Excl. VAT</TableHead>
                        <TableHead className="text-right">Incl. VAT</TableHead>
                        <TableHead className="text-right">Total (KWD)</TableHead>
                        <TableHead className="w-[110px]">Price expiry</TableHead>
                        <TableHead className="w-[110px] text-center">Documents</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {request.suppliers.map((s) => (
                        <FragmentWithKey key={s.id}>
                          <TableRow
                            className={s.recommended ? "bg-warning/5 hover:bg-warning/10" : undefined}
                          >
                            <TableCell>
                              {s.recommended ? (
                                <span title="Recommended" className="inline-flex">
                                  <Star className="w-4 h-4 text-warning-foreground fill-warning" />
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{s.companyName}</span>
                                {s.recommended && (
                                  <Badge className="mt-1 w-fit bg-warning/15 text-warning-foreground border-0 text-[10px] h-4 px-1.5">
                                    Recommended
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{s.currency}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {s.totalExclVat.toLocaleString("en", { minimumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {s.totalInclVat.toLocaleString("en", { minimumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {s.totalKwd.toLocaleString("en", { minimumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {s.priceExpiryDate ?? "—"}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {s.files.length}
                            </TableCell>
                          </TableRow>
                          {(s.justification || s.notes || s.files.length > 0) && (
                            <TableRow
                              key={`${s.id}-meta`}
                              className={s.recommended ? "bg-warning/5" : "bg-muted/20"}
                            >
                              <TableCell></TableCell>
                              <TableCell colSpan={7} className="py-3">
                                {s.recommended && s.justification && (
                                  <div className="mb-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                                      Recommendation justification
                                    </p>
                                    <p className="text-sm text-foreground">{s.justification}</p>
                                  </div>
                                )}
                                {s.notes && (
                                  <p className="text-sm text-muted-foreground mb-2">{s.notes}</p>
                                )}
                                {s.files.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {s.files.map((f, i) => (
                                      <div
                                        key={i}
                                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-card border text-xs"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="truncate max-w-[200px]">{f.name}</span>
                                        <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                                        <Button variant="ghost" size="icon" className="h-5 w-5">
                                          <Download className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </FragmentWithKey>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {request.evidenceFiles.length > 0 && (
                <div className="section-card p-5">
                  <h3 className="text-base font-semibold text-foreground mb-3">General Evidence</h3>
                  <div className="space-y-1.5">
                    {request.evidenceFiles.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted text-sm">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Approvals tab */}
          <TabsContent value="approvals">
            <div className="space-y-5">
              {/* Owner / Super edit-and-restart shortcut */}
              {canEdit && request.status !== "Draft" && request.approvals.length > 0 && (
                <div className="section-card p-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-primary">
                  <div className="flex items-start gap-3">
                    <RotateCcw className="w-4 h-4 mt-0.5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Need to make changes?</p>
                      <p className="text-xs text-muted-foreground">
                        Editing the request archives the current batch of approvals and triggers a fresh
                        approval cycle from the first approver.
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Archive className="w-4 h-4 mr-1" /> Archive & restart
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restart the approval workflow?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The current batch ({request.approvals.length} approver(s)) will be moved into{" "}
                          <span className="font-medium">Approval history</span>. A fresh batch with the same
                          chain will be created and the first approver will be notified.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSaveEdit}>Archive & restart</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {/* Stage gates */}
              {[1, 2].map((stage, idx) => {
                const stageApprovals = request.approvals.filter((a) => a.stage === stage);
                if (stageApprovals.length === 0) return null;
                return (
                  <div key={stage}>
                    <StageGate
                      stage={stage as 1 | 2}
                      title={stage === 1 ? "KIO Internal Approval" : "KIA External Approval"}
                      approvals={stageApprovals}
                      currentUserName={user?.name}
                    />
                    {idx === 0 && request.approvals.some((a) => a.stage === 2) && (
                      <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                        <div className="h-px w-12 bg-border" />
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="font-medium">Advances to Stage 2 once Stage 1 is complete</span>
                        <div className="h-px w-12 bg-border" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Action card */}
              {pendingApproval && (
                <div className="section-card overflow-hidden ring-2 ring-warning shadow-md">
                  <div className="px-5 py-3 bg-warning/10 border-b border-warning/30 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-warning-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-warning-foreground">
                      Awaiting your decision
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      Your approval is needed for this request
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      You're approver {pendingApproval.sequenceOrder} of{" "}
                      {request.approvals.filter((a) => a.stage === pendingApproval.stage).length} on the
                      Stage {pendingApproval.stage} chain. If you approve, the request moves to the next
                      approver. Once all Stage 1 approvers sign off, the request advances to KIA for Stage 2.
                    </p>
                    <Textarea
                      placeholder="Add optional comments for the record..."
                      rows={3}
                      className="mb-4"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={handleApprove} className="bg-success hover:bg-success/90 text-success-foreground">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button variant="destructive" onClick={handleReject}>
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Decision history */}
              {request.approvals.some((a) => a.comments || a.decidedAt) && (
                <div className="section-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" /> Decision history (current batch)
                  </h3>
                  <div className="space-y-3">
                    {request.approvals
                      .filter((a) => a.comments || a.decidedAt)
                      .map((a) => (
                        <DecisionRow key={a.id} approval={a} />
                      ))}
                  </div>
                </div>
              )}

              {/* Archived batches */}
              {request.archivedApprovalBatches && request.archivedApprovalBatches.length > 0 && (
                <div className="section-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" /> Approval history (archived batches)
                  </h3>
                  <div className="space-y-2">
                    {request.archivedApprovalBatches.map((batch, idx) => (
                      <Collapsible key={batch.id} className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 text-left">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Batch #{idx + 1} · archived {new Date(batch.archivedAt).toLocaleString("en-GB")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              By {batch.archivedBy}
                              {batch.reason && <> · {batch.reason}</>}
                            </p>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-4 pb-4 pt-1 space-y-2 bg-muted/20">
                          {batch.approvals.map((a) => (
                            <DecisionRow key={a.id} approval={a} compact />
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Activity tab */}
          <TabsContent value="activity">
            <div className="section-card p-5">
              {request.activity.length > 0 ? (
                <div className="space-y-4">
                  {request.activity.map((entry, i) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                        {i < request.activity.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium text-foreground">{entry.action}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{entry.performedBy}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString("en-GB")}
                          </span>
                        </div>
                        {entry.details && (
                          <p className="text-sm text-muted-foreground mt-1">{entry.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground text-sm py-8">No activity recorded.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const DecisionRow = ({ approval, compact = false }: { approval: ApprovalRecord; compact?: boolean }) => (
  <div className={`flex items-start gap-3 p-3 rounded-lg border bg-card ${compact ? "" : "bg-muted/30"}`}>
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
      {approval.approverAvatar}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{approval.approverName}</p>
        <Badge variant="secondary" className="text-[10px]">{approval.approverType}</Badge>
        <span className="inline-flex items-center gap-1 text-xs">
          {APPROVAL_ICONS[approval.status]}
          <span
            className={
              approval.status === "Approved"
                ? "text-success"
                : approval.status === "Rejected"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }
          >
            {approval.status}
          </span>
        </span>
      </div>
      {approval.comments && <p className="text-sm text-foreground mt-1.5">{approval.comments}</p>}
      {approval.decidedAt && (
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(approval.decidedAt).toLocaleString("en-GB")}
        </p>
      )}
    </div>
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
    <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
  </div>
);

export default RequestDetail;
