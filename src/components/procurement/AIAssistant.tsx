import { useEffect, useState } from "react";
import { Sparkles, Upload, Check, RefreshCw, File as FileIcon, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

const AI_STEPS = [
  "Reading documents",
  "Extracting supplier details & pricing",
  "Drafting subject, description & details",
  "Matching each file to its offer",
];

export interface AIExtractedSupplier {
  company: string;
  currency: "GBP" | "USD" | "EUR" | "KWD";
  excVat: number;
  incVat: number;
  expires: string;
  fileName: string;
  recommended: boolean;
  justification: string;
}
export interface AIExtractedDraft {
  subject: string;
  department: string;
  contractDuration: string;
  description: string;
  otherDetails: string;
  suppliers: AIExtractedSupplier[];
}

const AI_DRAFT: AIExtractedDraft = {
  subject: "Cybersecurity Penetration Testing — Annual Engagement",
  department: "Information Technology",
  contractDuration: "12 months",
  description:
    "CREST-certified external penetration test covering web applications, internal network, and Azure cloud infrastructure. Includes executive summary, technical report, remediation roadmap, and one round of retesting.",
  otherDetails:
    "Must be CREST or CHECK certified. Deliverables: exec summary, technical report, remediation roadmap, retest. Engagement window: Jul–Aug 2026.",
  suppliers: [
    { company: "Sentinel Cyber Labs", currency: "GBP", excVat: 14000, incVat: 16800, expires: "2026-07-30", fileName: "", recommended: false, justification: "CREST + CHECK certified, regional engagement experience, best value at parity SLA." },
    { company: "NorthBeacon Security", currency: "GBP", excVat: 16500, incVat: 19800, expires: "2026-07-15", fileName: "", recommended: false, justification: "" },
  ],
};

const FX = { GBP: 1.0625, USD: 0.307, EUR: 0.334, KWD: 1 } as const;
const aiKwd = (s: AIExtractedSupplier) => (Number(s.incVat) || 0) * (FX[s.currency] || 1);

type Phase = "idle" | "analyzing" | "review" | "applied";

interface Props {
  onApply: (draft: AIExtractedDraft) => void;
}

const AIAssistant = ({ onApply }: Props) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [extracted, setExtracted] = useState<AIExtractedDraft | null>(null);
  const [drag, setDrag] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const build = (names: string[]): AIExtractedDraft => {
    const n = Math.max(1, Math.min(AI_DRAFT.suppliers.length, names.length || 2));
    const suppliers = AI_DRAFT.suppliers.slice(0, n).map((s, i) => ({
      ...s, fileName: names[i] || `${s.company.replace(/\s+/g, "-")}-Quote.pdf`,
    }));
    return { ...AI_DRAFT, suppliers };
  };

  const start = (fileList: FileList | null, sample: boolean) => {
    const names = sample
      ? ["Sentinel-Cyber-Labs-Quote.pdf", "NorthBeacon-Security-Quote.pdf"]
      : Array.from(fileList || []).map((f) => f.name);
    if (!sample && names.length === 0) return;
    setExtracted(build(names));
    setPhase("analyzing");
  };

  useEffect(() => {
    if (phase !== "analyzing") return;
    setStepIdx(0);
    const timers = AI_STEPS.map((_, i) => setTimeout(() => setStepIdx(i + 1), 640 * (i + 1)));
    timers.push(setTimeout(() => setPhase("review"), 640 * AI_STEPS.length + 520));
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  const apply = () => {
    if (!extracted) return;
    onApply(extracted);
    setPhase("applied");
  };

  if (phase === "applied" && extracted) {
    return (
      <div className="rounded-lg border border-[hsl(var(--sab-100))] bg-sab-50 px-4 py-3 flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-card text-sab flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground">
            Draft created from {extracted.suppliers.length} {extracted.suppliers.length === 1 ? "quote" : "quotes"}
          </p>
          <p className="text-xs text-muted-foreground leading-snug">
            Review the fields below — the assistant fills, you decide. Each quote is attached to its offer.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-sab" onClick={() => { setPhase("idle"); setExtracted(null); }}>
          <RefreshCw className="w-3 h-3" /> Re-run
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--sab-100))] overflow-hidden bg-gradient-to-br from-sab-50 to-card">
      <header className="px-5 py-3.5 flex items-center justify-between gap-3 border-b border-[hsl(var(--sab-100))]">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-sab text-white flex items-center justify-center shrink-0"
            style={{ backgroundColor: "hsl(var(--sab))", color: "white" }}>
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div>
            <h2 className="font-display text-[15px] font-bold text-foreground tracking-tight leading-tight">Start with AI</h2>
            <p className="text-[11.5px] text-muted-foreground leading-tight">Draft the request straight from your supplier quotes</p>
          </div>
        </div>
        {phase === "idle" && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? "Show" : "Hide"}
          </Button>
        )}
      </header>

      {!(phase === "idle" && collapsed) && (
        <div className="px-5 py-4">
          {phase === "idle" && (
            <>
              <label
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); start(e.dataTransfer.files, false); }}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-6 cursor-pointer transition-colors ${
                  drag ? "border-sab bg-sab-50" : "border-[hsl(var(--sab-100))] bg-card/60 hover:border-sab hover:bg-sab-50"
                }`}
                style={{ borderColor: drag ? "hsl(var(--sab))" : undefined }}
              >
                <span className="w-9 h-9 rounded-full bg-card text-sab flex items-center justify-center border border-[hsl(var(--sab-100))]">
                  <Upload className="w-4 h-4" />
                </span>
                <p className="text-[13px] font-semibold text-foreground mt-1">
                  Drop supplier quotes here or <span className="text-sab">browse</span>
                </p>
                <p className="text-[11.5px] text-muted-foreground font-mono-tnum">I'll read each PDF and draft the request</p>
                <input type="file" multiple accept=".pdf,.docx,.xlsx" className="hidden" onChange={(e) => start(e.target.files, false)} />
              </label>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-[11.5px] text-muted-foreground">No quotes handy?</span>
                <Button variant="outline" size="sm" onClick={() => start(null, true)}>
                  <Sparkles className="w-3 h-3" /> Try with sample quotes
                </Button>
              </div>
            </>
          )}

          {phase === "analyzing" && extracted && (
            <div className="py-1">
              <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-sab border-t-transparent animate-spin"
                  style={{ borderColor: "hsl(var(--sab))", borderTopColor: "transparent" }}></span>
                Analysing {extracted.suppliers.length} {extracted.suppliers.length === 1 ? "document" : "documents"}…
              </p>
              <ul className="space-y-2">
                {AI_STEPS.map((s, i) => {
                  const done = i < stepIdx;
                  const active = i === stepIdx;
                  return (
                    <li key={s} className={`flex items-center gap-2.5 text-xs transition-colors ${
                      done ? "text-foreground" : active ? "text-foreground font-medium" : "text-muted-2"
                    }`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        done ? "text-white" : active ? "border-2 border-t-transparent animate-spin" : "border border-border-strong"
                      }`}
                      style={done ? { backgroundColor: "hsl(var(--sab))" }
                        : active ? { borderColor: "hsl(var(--sab))", borderTopColor: "transparent" } : undefined}>
                        {done && <Check className="w-2.5 h-2.5" strokeWidth={3.5} />}
                      </span>
                      {s}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {phase === "review" && extracted && (
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="chip chip-sab"><Sparkles className="w-2.5 h-2.5" /> Proposed draft</span>
                <span className="text-[11.5px] text-muted-foreground">Review, then apply — nothing fills the form until you do.</span>
              </div>

              <div className="rounded-lg border border-border bg-card divide-y divide-border">
                <div className="px-4 py-2.5">
                  <p className="text-[10.5px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">Subject</p>
                  <p className="text-[13px] font-semibold text-foreground leading-snug mt-0.5">{extracted.subject}</p>
                </div>
                <div className="px-4 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10.5px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">Department</p>
                    <p className="text-xs text-foreground mt-0.5">{extracted.department}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">Contract duration</p>
                    <p className="text-xs text-foreground mt-0.5">{extracted.contractDuration}</p>
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <p className="text-[10.5px] uppercase tracking-[0.07em] font-semibold text-muted-foreground mb-1.5">
                    {extracted.suppliers.length} supplier {extracted.suppliers.length === 1 ? "offer" : "offers"}
                  </p>
                  <div className="space-y-1.5">
                    {extracted.suppliers.map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-xs">
                        <span className="font-semibold text-foreground flex-1 min-w-0 truncate">{s.company}</span>
                        <span className="text-muted-foreground font-mono-tnum inline-flex items-center gap-1 shrink-0">
                          <FileIcon className="w-2.5 h-2.5" /> {s.fileName}
                        </span>
                        <span className="num font-semibold text-foreground tabular-nums w-[120px] text-right shrink-0">
                          ≈ KWD {aiKwd(s).toLocaleString("en", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11.5px] flex items-center gap-1.5 mt-2 pt-2 border-t border-border text-warning">
                    <Info className="w-3 h-3 shrink-0" />
                    <span className="text-muted-foreground">No recommended offer pre-selected — you'll mark one yourself after applying.</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button onClick={apply} style={{ backgroundColor: "hsl(var(--sab))", color: "white" }}>
                  <Check className="w-3.5 h-3.5" /> Apply to form
                </Button>
                <Button variant="outline" onClick={() => { setPhase("idle"); setExtracted(null); }}>Discard</Button>
                <span className="ml-auto text-[11px] text-muted-foreground font-mono-tnum">You can edit every field after applying</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
