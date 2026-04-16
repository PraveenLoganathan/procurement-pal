import type { RequestStatus } from "@/types/procurement";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<RequestStatus, string> = {
  Draft: "bg-muted text-muted-foreground",
  Submitted: "bg-primary/10 text-primary",
  "Under Review": "bg-warning/10 text-warning-foreground",
  Approved: "bg-success/10 text-success",
  Rejected: "bg-destructive/10 text-destructive",
  "Referred to SAB": "bg-accent text-accent-foreground",
  Open: "bg-primary/10 text-primary",
  Complete: "bg-success/10 text-success",
};

const StatusBadge = ({ status }: { status: RequestStatus }) => (
  <Badge variant="secondary" className={`${STATUS_STYLES[status]} text-xs font-medium border-0`}>
    {status}
  </Badge>
);

export default StatusBadge;
