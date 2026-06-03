import { Check, X, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApprovalRecord } from "@/types/procurement";

interface Props {
  stage: 1 | 2;
  title: string;
  approvals: ApprovalRecord[];
  currentUserName?: string;
}

const StageGate = ({ stage, title, approvals, currentUserName }: Props) => {
  const sorted = [...approvals].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const total = sorted.length;
  const approvedCount = sorted.filter((a) => a.status === "Approved").length;
  const rejected = sorted.find((a) => a.status === "Rejected");
  const allDone = approvedCount === total && total > 0;

  return (
    <div className="section-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-section-number" />
          <h3 className="text-sm font-semibold text-foreground">
            Stage {stage} · {title}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              rejected ? "bg-destructive" : allDone ? "bg-success" : "bg-warning",
            )}
          />
          <span className="font-medium text-muted-foreground">
            {rejected ? "Rejected" : `${approvedCount} of ${total} approved`}
          </span>
        </div>
      </div>

      <div className="p-5 overflow-x-auto">
        <div className="flex items-start gap-2 min-w-max">
          {sorted.map((a, i) => {
            const isYou = a.approverName === currentUserName;
            const isPending = a.status === "Awaiting Approval";
            const isApproved = a.status === "Approved";
            const isRejected = a.status === "Rejected";
            const isQueue = a.status === "In Queue";

            return (
              <div key={a.id} className="flex items-start gap-2">
                <div className="flex flex-col items-center w-32 text-center">
                  <div className="relative">
                    <div
                      className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors",
                        isApproved && "bg-success/10 text-success border-success",
                        isRejected && "bg-destructive/10 text-destructive border-destructive",
                        isPending && "bg-warning/10 text-warning-foreground border-warning ring-4 ring-warning/20",
                        isQueue && "bg-muted text-muted-foreground border-border",
                      )}
                    >
                      {a.approverAvatar}
                    </div>
                    {isApproved && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-success text-success-foreground flex items-center justify-center border-2 border-card">
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </span>
                    )}
                    {isRejected && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center border-2 border-card">
                        <X className="w-3 h-3" strokeWidth={3} />
                      </span>
                    )}
                    {isPending && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-warning text-warning-foreground flex items-center justify-center border-2 border-card">
                        <Clock className="w-3 h-3" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground leading-tight">
                    {isYou ? <>You · <span className="font-normal">{a.approverName.split(" ")[0]}</span></> : a.approverName}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                    {a.approverTitle}
                  </p>
                  <StatusChip status={a.status} step={a.sequenceOrder} total={total} isYou={isYou} />
                </div>

                {i < sorted.length - 1 && (
                  <div className="flex items-center pt-7 w-10">
                    <div
                      className={cn(
                        "h-0.5 w-full rounded-full",
                        isApproved ? "bg-success" : "bg-border",
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StatusChip = ({
  status,
  step,
  total,
  isYou,
}: {
  status: ApprovalRecord["status"];
  step: number;
  total: number;
  isYou: boolean;
}) => {
  if (status === "Awaiting Approval") {
    return (
      <span className="mt-1.5 inline-block text-[11px] font-semibold text-warning-foreground">
        {isYou ? "Your turn" : "Awaiting"}
      </span>
    );
  }
  if (status === "Approved") {
    return <span className="mt-1.5 inline-block text-[11px] font-medium text-success">Approved</span>;
  }
  if (status === "Rejected") {
    return <span className="mt-1.5 inline-block text-[11px] font-medium text-destructive">Rejected</span>;
  }
  return (
    <span className="mt-1.5 inline-block text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
      Step {step} of {total}
    </span>
  );
};

export default StageGate;
