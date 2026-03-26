import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, ChevronRight, Shield } from "lucide-react";

interface Approver {
  id: string;
  name: string;
  title: string;
  avatar: string;
  stage: "KIO" | "KIA";
}

const APPROVERS: Approver[] = [
  { id: "1", name: "Ahmad Al-Rashidi", title: "IT Security Manager", avatar: "AR", stage: "KIO" },
  { id: "2", name: "Fatima Al-Sabah", title: "Head of IT", avatar: "FS", stage: "KIO" },
  { id: "3", name: "Mohammed Al-Kandari", title: "Chief Operating Officer", avatar: "MK", stage: "KIA" },
  { id: "4", name: "Sara Al-Mutairi", title: "Chief Financial Officer", avatar: "SM", stage: "KIA" },
  { id: "5", name: "Khalid Al-Ghanim", title: "President & CEO", avatar: "KG", stage: "KIA" },
];

interface Props {
  firstApproverOverride: string;
  onFirstApproverChange: (id: string) => void;
}

const ApprovalPanel = ({ firstApproverOverride, onFirstApproverChange }: Props) => {
  return (
    <div className="section-card sticky top-6">
      <div className="section-header">
        <Shield className="w-5 h-5 text-section-number" />
        <h2 className="section-title">Approval Process</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* First approver override */}
        <div>
          <label className="field-label">First Approver Override</label>
          <Select value={firstApproverOverride} onValueChange={onFirstApproverChange}>
            <SelectTrigger>
              <SelectValue placeholder="Use default chain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Use default chain</SelectItem>
              {APPROVERS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} — {a.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="field-hint">
            Optionally select a specific first approver. The remaining chain stays fixed.
          </p>
        </div>

        {/* Stage 1 - KIO */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className="text-xs font-semibold">Stage 1</Badge>
            <span className="text-sm font-semibold text-foreground">KIO Review</span>
          </div>
          <div className="space-y-2">
            {APPROVERS.filter((a) => a.stage === "KIO").map((approver, i) => (
              <ApproverRow key={approver.id} approver={approver} isFirst={i === 0} />
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <ChevronRight className="w-5 h-5 text-muted-foreground rotate-90" />
        </div>

        {/* Stage 2 - KIA */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary" className="text-xs font-semibold">Stage 2</Badge>
            <span className="text-sm font-semibold text-foreground">KIA Approval</span>
          </div>
          <div className="space-y-2">
            {APPROVERS.filter((a) => a.stage === "KIA").map((approver) => (
              <ApproverRow key={approver.id} approver={approver} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ApproverRow = ({ approver, isFirst }: { approver: Approver; isFirst?: boolean }) => (
  <div className="approval-card approval-card-pending">
    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
      {approver.avatar}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{approver.name}</p>
      <p className="text-xs text-muted-foreground truncate">{approver.title}</p>
    </div>
    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
  </div>
);

export default ApprovalPanel;
