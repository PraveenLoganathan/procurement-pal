import { useParams, useNavigate } from "react-router-dom";
import { MOCK_REQUESTS } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Share2, FileDown, Trash2, Star, Download,
  CheckCircle2, XCircle, Clock, AlertCircle, FileText, User
} from "lucide-react";
import type { ApprovalStatus } from "@/types/procurement";

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
  const request = MOCK_REQUESTS.find((r) => r.id === id);

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

  const handleExportPdf = () => toast.info("PDF export coming soon");
  const handleDelete = () => toast.info("Delete functionality coming soon");
  const handleApprove = () => toast.success("Request approved (mock)");
  const handleReject = () => toast.error("Request rejected (mock)");

  const pendingApproval = request.approvals.find(
    (a) => a.status === "Awaiting Approval" && a.approverName === user?.name
  );

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
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-1" /> Share
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileDown className="w-4 h-4 mr-1" /> Export PDF
            </Button>
            {user?.role === "ORG_SUPER" && request.status !== "Draft" && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
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

          {/* Suppliers tab */}
          <TabsContent value="suppliers">
            <div className="space-y-4">
              {request.suppliers.map((s) => (
                <div key={s.id} className={`section-card p-5 ${s.recommended ? "ring-2 ring-warning" : ""}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-base font-semibold text-foreground">{s.companyName}</h3>
                    {s.recommended && (
                      <Badge className="bg-warning/10 text-warning-foreground border-0 gap-1">
                        <Star className="w-3 h-3" /> Recommended
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Currency</span><p className="font-medium">{s.currency}</p></div>
                    <div><span className="text-muted-foreground">Total excl. VAT</span><p className="font-medium">{s.totalExclVat.toLocaleString("en", { minimumFractionDigits: 3 })}</p></div>
                    <div><span className="text-muted-foreground">Total incl. VAT</span><p className="font-medium">{s.totalInclVat.toLocaleString("en", { minimumFractionDigits: 3 })}</p></div>
                    <div><span className="text-muted-foreground">Total in KWD</span><p className="font-medium font-mono">{s.totalKwd.toLocaleString("en", { minimumFractionDigits: 3 })}</p></div>
                  </div>
                  {s.recommended && s.justification && (
                    <div className="mt-4 p-3 rounded-lg bg-warning/5 border border-warning/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Recommendation Justification</p>
                      <p className="text-sm text-foreground">{s.justification}</p>
                    </div>
                  )}
                  {s.priceExpiryDate && (
                    <p className="mt-2 text-xs text-muted-foreground">Price expires: {s.priceExpiryDate}</p>
                  )}
                  {s.notes && <p className="mt-2 text-sm text-muted-foreground">{s.notes}</p>}
                  {s.files.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {s.files.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted text-sm">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {request.suppliers.length === 0 && (
                <div className="section-card p-12 text-center text-muted-foreground text-sm">No supplier offers added.</div>
              )}

              {/* General evidence */}
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
            <div className="space-y-4">
              {/* Action card */}
              {pendingApproval && (
                <div className="section-card p-5 ring-2 ring-primary">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-primary" />
                    <h3 className="text-base font-semibold text-foreground">Action Required</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    This request is awaiting your approval.
                  </p>
                  <Textarea placeholder="Add optional comments..." rows={3} className="mb-4" />
                  <div className="flex gap-3">
                    <Button onClick={handleApprove} className="bg-success hover:bg-success/90 text-success-foreground">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button variant="destructive" onClick={handleReject}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              )}

              {/* Approval chain */}
              {[1, 2].map((stage) => {
                const stageApprovals = request.approvals.filter((a) => a.stage === stage);
                if (stageApprovals.length === 0) return null;
                return (
                  <div key={stage} className="section-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="secondary" className="text-xs font-semibold">Stage {stage}</Badge>
                      <span className="text-sm font-semibold text-foreground">
                        {stage === 1 ? "KIO Internal Review" : "KIA External Approval"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {stageApprovals.map((a) => (
                        <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                            {a.approverAvatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{a.approverName}</p>
                              <Badge variant="secondary" className="text-[10px]">{a.approverType}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{a.approverTitle}</p>
                            {a.comments && (
                              <p className="text-sm text-foreground mt-2 p-2 rounded bg-muted">{a.comments}</p>
                            )}
                            {a.decidedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(a.decidedAt).toLocaleString("en-GB")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {APPROVAL_ICONS[a.status]}
                            <span className={`text-xs font-medium ${
                              a.status === "Approved" ? "text-success" :
                              a.status === "Rejected" ? "text-destructive" :
                              a.status === "Awaiting Approval" ? "text-warning-foreground" :
                              "text-muted-foreground"
                            }`}>
                              {a.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
    <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
  </div>
);

export default RequestDetail;
