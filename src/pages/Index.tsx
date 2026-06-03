import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Send, ArrowLeft, Upload, X, FileText, Plus, Star, Trash2, Info,
  Check, CheckCircle2, AlertTriangle, Lock, Workflow, DollarSign, Sparkles, File as FileIcon,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import AIAssistant, { type AIExtractedDraft } from "@/components/procurement/AIAssistant";
import { v4 } from "@/lib/uid";

/* ----------------------------- Reference data ----------------------------- */
const DEPARTMENTS = [
  "Information Technology", "Facilities Management", "Finance", "Legal",
  "Operations", "Communications", "Human Resources", "Procurement",
];
const CURRENCIES = ["KWD", "GBP", "USD", "EUR"] as const;
type Ccy = typeof CURRENCIES[number];
const FX_TO_KWD: Record<Ccy, number> = { GBP: 1.0625, USD: 0.307, EUR: 0.334, KWD: 1 };
const CCY_SYM: Record<Ccy, string> = { GBP: "£", USD: "$", EUR: "€", KWD: "KWD " };
const FREQS = [
  { key: "month", label: "per month", noun: "months" },
  { key: "quarter", label: "per quarter", noun: "quarters" },
  { key: "year", label: "per annum", noun: "years" },
] as const;
type FreqKey = typeof FREQS[number]["key"];
const BUDGET_CODES = [
  "IT-2026-001","IT-2026-003","IT-2026-007","FIN-2026-001","LEG-2026-001",
  "OPS-2026-001","FAC-2026-001","COM-2026-001","HR-2026-001","PROC-2026-001",
];
const DIRECTORY = [
  { name: "Praveen Loganathan", title: "IT Manager", init: "PL" },
  { name: "Aisha Noor", title: "Facilities Lead", init: "AN" },
  { name: "Hassan El-Sayed", title: "Finance Manager", init: "HE" },
  { name: "Mohammed Al-Fahad", title: "Operations Director", init: "MA" },
  { name: "Layla Mansour", title: "Legal Counsel", init: "LM" },
];
const ME = { name: "Ahmad Al-Rashidi", title: "Procurement Lead", init: "AR" };

const RFP_TEMPLATE = `Vendors invited:
[How many, and how they were identified]

Vendors that responded:
[How many submitted a compliant bid]

Evaluation method:
[Criteria, scoring/weighting, and the panel]

Why the winning supplier:
[Decisive factors — value, capability, risk]`;

const OTHER_DETAILS_TEMPLATE = `Supplier shortlist and selection rationale:
[How suppliers were identified and why these were shortlisted]

Rationale for not selecting the cheapest quote (if applicable):
[Cost vs. value trade-offs, quality, risk]

Evaluation panel and scoring:
[Evaluators, criteria, and weighting]

Payment details:
[Frequency, prepayment requirements, milestones and conditions]`;

const fmtBytes = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;
const fmtKwd = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 0 });
const fmtMoney = (n: number, ccy: Ccy) => `${CCY_SYM[ccy] || ""}${(Number(n) || 0).toLocaleString("en", { maximumFractionDigits: 0 })}`;

/* ----------------------------- Types ----------------------------- */
interface SupplierOffer {
  id: string; company: string; currency: Ccy;
  excVat: string; incVat: string; expires: string;
  fileName: string; recommended: boolean; justification: string;
}
interface FormState {
  subject: string; department: string; description: string; technicalSpecs: string;
  contractDuration: string; budgetCode: string; requisitionNumber: string;
  startDate: string; startDateEstimated: boolean;
  costType: "oneoff" | "recurring"; costCurrency: Ccy;
  costOneOff: string; costAmount: string; costFreq: FreqKey; costPeriods: string;
  rfpConducted: "" | "yes" | "no"; rfpSummary: string; rfpNoReason: string;
}

const kwdOf = (s: SupplierOffer) => (Number(s.incVat) || 0) * (FX_TO_KWD[s.currency] || 1);
const contractTotal = (f: FormState) => f.costType === "oneoff"
  ? Number(f.costOneOff) || 0
  : (Number(f.costAmount) || 0) * (Number(f.costPeriods) || 0);
const freqNoun = (k: FreqKey) => (FREQS.find(x => x.key === k) || FREQS[2]).noun;

/* ----------------------------- Building blocks ----------------------------- */
const Field = ({ label, hint, required, wide, children }: {
  label: string; hint?: string; required?: boolean; wide?: boolean; children: React.ReactNode;
}) => (
  <div className={wide ? "sm:col-span-2" : ""}>
    <div className="flex items-baseline gap-1.5 mb-1.5">
      <span className="field-label !mb-0">{label}</span>
      {required && <span className="text-destructive text-xs leading-none">*</span>}
      {hint && <span className="text-[11px] text-muted-2 normal-case font-normal tracking-normal ml-auto">{hint}</span>}
    </div>
    {children}
  </div>
);

const FormCard = ({ step, title, badge, action, children }: {
  step: string | number; title: string; badge?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) => (
  <section className="bg-card rounded-lg border border-border overflow-hidden">
    <header className="px-5 py-3.5 hairline flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="section-number shrink-0">{step}</span>
        <h2 className="section-title truncate">{title}</h2>
        {badge}
      </div>
      {action}
    </header>
    <div className="px-5 py-4">{children}</div>
  </section>
);

/* ----------------------------- Contract cost ----------------------------- */
const ContractCostBlock = ({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) => {
  const ccy = form.costCurrency;
  const total = contractTotal(form);
  const hasTotal = form.costType === "oneoff" ? Number(form.costOneOff) > 0 : (Number(form.costAmount) > 0 && Number(form.costPeriods) > 0);
  return (
    <div className="sm:col-span-2">
      <div className="flex items-baseline gap-1.5 mb-1.5">
        <span className="field-label !mb-0">Contract cost</span>
        <span className="text-destructive text-xs leading-none">*</span>
        <span className="text-[11px] text-muted-2 normal-case font-normal tracking-normal ml-auto">How will this be paid?</span>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-3.5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-md border border-border-strong overflow-hidden bg-card">
            {[{ k: "oneoff", l: "One-off payment" }, { k: "recurring", l: "Recurring" }].map((t, i) => (
              <button key={t.k} type="button" onClick={() => set("costType", t.k as FormState["costType"])}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${i > 0 ? "border-l border-border-strong" : ""} ${
                  form.costType === t.k ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-primary-50"
                }`}>{t.l}</button>
            ))}
          </div>
          <Select value={ccy} onValueChange={(v) => set("costCurrency", v as Ccy)}>
            <SelectTrigger className="w-auto h-9 font-mono-tnum text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {form.costType === "oneoff" ? (
          <div className="mt-3 max-w-[260px]">
            <label className="text-[11px] text-muted-foreground block mb-1">Total amount</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-2">{CCY_SYM[ccy]}</span>
              <Input className="num h-9" inputMode="decimal" placeholder="0" value={form.costOneOff}
                onChange={e => set("costOneOff", e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-[520px]">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Amount</label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-mono text-muted-2">{CCY_SYM[ccy]}</span>
                <Input className="num h-9" inputMode="decimal" placeholder="0" value={form.costAmount}
                  onChange={e => set("costAmount", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Frequency</label>
              <Select value={form.costFreq} onValueChange={(v) => set("costFreq", v as FreqKey)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{FREQS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">No. of {freqNoun(form.costFreq)}</label>
              <Input className="num h-9" inputMode="numeric" placeholder="0" value={form.costPeriods}
                onChange={e => set("costPeriods", e.target.value)} />
            </div>
          </div>
        )}

        <div className={`mt-3 flex items-center gap-2 text-xs ${hasTotal ? "text-foreground" : "text-muted-2"}`}>
          <DollarSign className="w-3.5 h-3.5 shrink-0" />
          {hasTotal ? (
            <span>
              <span className="text-muted-foreground">Contract total</span>{" "}
              <strong className="font-mono-tnum text-foreground">{fmtMoney(total, ccy)}</strong>
              {form.costType === "recurring" && (
                <span className="text-muted-foreground">
                  {" · "}{fmtMoney(Number(form.costAmount), ccy)} {FREQS.find(f => f.key === form.costFreq)?.label} × {form.costPeriods} {freqNoun(form.costFreq)}
                </span>
              )}
            </span>
          ) : <span>Enter the figures above to compute the contract total.</span>}
        </div>
      </div>
    </div>
  );
};

/* ----------------------------- Supplier row ----------------------------- */
const SupplierRow = ({ s, idx, onChange, onRecommend, onRemove, canRemove }: {
  s: SupplierOffer; idx: number;
  onChange: (id: string, k: keyof SupplierOffer, v: any) => void;
  onRecommend: (id: string) => void; onRemove: (id: string) => void; canRemove: boolean;
}) => {
  const kwd = kwdOf(s);
  return (
    <div className={`rounded-lg border p-4 transition-colors ${s.recommended ? "border-success bg-success-50/40" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="font-mono-tnum text-[11px] font-semibold text-muted-2">Offer {idx + 1}</span>
          <button onClick={() => onRecommend(s.id)} type="button"
            className={`chip transition-colors ${s.recommended ? "chip-green" : "chip-gray hover:border-success hover:text-success"}`}>
            <Star className={`w-3 h-3 ${s.recommended ? "fill-current" : ""}`} />
            {s.recommended ? "Recommended" : "Mark recommended"}
          </button>
        </div>
        {canRemove && (
          <button onClick={() => onRemove(s.id)} className="text-muted-2 hover:text-destructive p-1 rounded hover:bg-destructive-50" title="Remove offer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12">
          <Field label="Supplier" required>
            <Input className="h-9" value={s.company} placeholder="Company name"
              onChange={e => onChange(s.id, "company", e.target.value)} />
          </Field>
        </div>
        <div className="col-span-6 sm:col-span-2">
          <Field label="Currency">
            <Select value={s.currency} onValueChange={(v) => onChange(s.id, "currency", v)}>
              <SelectTrigger className="h-9 font-mono-tnum text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <div className="col-span-6 sm:col-span-3">
          <Field label="Exc. VAT">
            <Input className="num text-right h-9" inputMode="decimal" value={s.excVat} placeholder="0"
              onChange={e => onChange(s.id, "excVat", e.target.value)} />
          </Field>
        </div>
        <div className="col-span-6 sm:col-span-3">
          <Field label="Inc. VAT" required>
            <Input className="num text-right h-9" inputMode="decimal" value={s.incVat} placeholder="0"
              onChange={e => onChange(s.id, "incVat", e.target.value)} />
          </Field>
        </div>
        <div className="col-span-12 sm:col-span-4">
          <Field label="≈ KWD equiv.">
            <div className="h-9 px-3 rounded-md border border-input bg-muted/40 flex items-center justify-between">
              <span className="text-[10.5px] text-muted-2 font-mono-tnum">auto · inc. VAT</span>
              <span className="num font-semibold text-[15px] text-foreground tabular-nums">{fmtKwd(kwd)}</span>
            </div>
          </Field>
        </div>
        <div className="col-span-12 sm:col-span-6">
          <Field label="Quote expires">
            <Input type="date" className="font-mono-tnum h-9" value={s.expires}
              onChange={e => onChange(s.id, "expires", e.target.value)} />
          </Field>
        </div>
        <div className="col-span-12 sm:col-span-6">
          <Field label="Quote file">
            <label className="h-9 inline-flex items-center justify-center gap-2 w-full rounded-md border border-border-strong bg-card hover:bg-muted text-foreground text-xs font-semibold cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" /> {s.fileName ? "Replace" : "Attach"}
              <input type="file" className="hidden" onChange={e => onChange(s.id, "fileName", e.target.files?.[0]?.name || "")} />
            </label>
          </Field>
        </div>
      </div>

      {s.fileName && (
        <p className="mt-2 text-[11.5px] text-muted-foreground flex items-center gap-1.5 font-mono-tnum">
          <FileIcon className="w-3 h-3" /> {s.fileName}
        </p>
      )}

      {s.recommended && (
        <div className="mt-3 pt-3 border-t border-success/30">
          <Field label="Why this supplier?" required hint="Required for the recommended offer">
            <Textarea className="h-[60px] resize-none bg-card" value={s.justification}
              placeholder="e.g. CREST + CHECK certified, best value at parity SLA, regional engagement experience."
              onChange={e => onChange(s.id, "justification", e.target.value)} />
          </Field>
        </div>
      )}
    </div>
  );
};

/* ----------------------------- Checklist ----------------------------- */
const ChecklistItem = ({ done, label }: { done: boolean; label: string }) => (
  <li className="flex items-center gap-2.5 text-xs">
    <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-success text-success-foreground" : "border border-border-strong text-transparent"}`}>
      {done && <Check className="w-2.5 h-2.5" strokeWidth={3.5} />}
    </span>
    <span className={done ? "text-foreground font-medium" : "text-muted-foreground"}>{label}</span>
  </li>
);

/* ----------------------------- Page ----------------------------- */
const Index = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    subject: "", department: "", description: "", technicalSpecs: "",
    contractDuration: "", budgetCode: "", requisitionNumber: "",
    startDate: "", startDateEstimated: false,
    costType: "oneoff", costCurrency: "KWD", costOneOff: "",
    costAmount: "", costFreq: "year", costPeriods: "",
    rfpConducted: "", rfpSummary: "", rfpNoReason: "",
  });
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(prev => ({ ...prev, [k]: v }));

  const [suppliers, setSuppliers] = useState<SupplierOffer[]>([
    { id: v4(), company: "", currency: "KWD", excVat: "", incVat: "", expires: "", fileName: "", recommended: true, justification: "" },
    { id: v4(), company: "", currency: "KWD", excVat: "", incVat: "", expires: "", fileName: "", recommended: false, justification: "" },
  ]);
  const [files, setFiles] = useState<{ id: string; name: string; size: number }[]>([]);
  const [rfpFile, setRfpFile] = useState<{ name: string; size: number } | null>(null);
  const [drag, setDrag] = useState(false);

  const [extraApprovers, setExtraApprovers] = useState<{ id: string; name: string; title: string; init: string }[]>([]);
  const [lineManager, setLineManager] = useState(DIRECTORY[0]);

  const [showJustModal, setShowJustModal] = useState(false);
  const [justification, setJustification] = useState("");

  const changeSupplier = (id: string, k: keyof SupplierOffer, v: any) =>
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, [k]: v } : s));
  const recommendSupplier = (id: string) =>
    setSuppliers(prev => prev.map(s => ({ ...s, recommended: s.id === id })));
  const removeSupplier = (id: string) => setSuppliers(prev => prev.filter(s => s.id !== id));
  const addSupplier = () => setSuppliers(prev => [...prev, {
    id: v4(), company: "", currency: "KWD", excVat: "", incVat: "", expires: "",
    fileName: "", recommended: false, justification: "",
  }]);

  const addFiles = (list: FileList | File[]) => {
    const arr = Array.from(list).map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, size: f.size }));
    setFiles(prev => [...prev, ...arr]);
  };

  const validSuppliers = suppliers.filter(s => s.company.trim() && Number(s.incVat) > 0);
  const recommended = suppliers.find(s => s.recommended);
  const valueKwd = useMemo(() => recommended ? kwdOf(recommended) : 0, [suppliers]);

  const checks = {
    details: !!(form.subject.trim() && form.department && form.description.trim() && form.budgetCode),
    contract: !!form.startDate && (form.costType === "oneoff" ? Number(form.costOneOff) > 0 : (Number(form.costAmount) > 0 && Number(form.costPeriods) > 0)),
    suppliers: validSuppliers.length > 0,
    recommended: !!(recommended && recommended.company.trim() && recommended.justification.trim()),
    rfp: form.rfpConducted === "no" ? !!form.rfpNoReason.trim()
      : form.rfpConducted === "yes" ? (!!rfpFile || !!form.rfpSummary.trim()) : false,
  };
  const CHECK_LABELS: Record<keyof typeof checks, string> = {
    details: "request details", contract: "contract start date & cost",
    suppliers: "a supplier offer", recommended: "recommended-offer justification",
    rfp: form.rfpConducted === "no" ? "reason for no RFP" : "RFP summary",
  };
  const canSubmit = Object.values(checks).every(Boolean);
  const missing = (Object.keys(checks) as (keyof typeof checks)[]).filter(k => !checks[k]).map(k => CHECK_LABELS[k]);
  const doneCount = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  const firstApprover = extraApprovers[0] || lineManager;
  const approverChain = [
    ...extraApprovers.map(a => ({ key: a.id, role: "Additional approver", person: a, kind: "extra" as const })),
    { key: "lm", role: "Line Manager", person: lineManager, kind: "lm" as const },
    { key: "hd", role: "Head of Department", person: { name: ME.name, title: ME.title, init: ME.init }, kind: "locked" as const },
    { key: "fc", role: "Finance Approver", person: { name: "Finance Committee", title: "Finance Approver", init: "FC" }, kind: "locked" as const },
  ];

  const submit = () => {
    if (!canSubmit) { toast.error(`Still needed: ${missing.join(" · ")}`); return; }
    if (validSuppliers.length < 3) { setShowJustModal(true); return; }
    toast.success("Procurement request submitted for approval");
    navigate("/");
  };

  const applyAIDraft = (draft: AIExtractedDraft) => {
    setForm(prev => ({
      ...prev,
      subject: draft.subject,
      department: draft.department,
      description: draft.description,
      technicalSpecs: draft.otherDetails,
      contractDuration: draft.contractDuration,
    }));
    setSuppliers(draft.suppliers.map(s => ({
      id: v4(),
      company: s.company,
      currency: s.currency,
      excVat: String(s.excVat),
      incVat: String(s.incVat),
      expires: s.expires,
      fileName: s.fileName,
      recommended: !!s.recommended,
      justification: s.justification || "",
    })));
    toast.success("AI draft applied — review and submit");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      {/* Sub-header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <p className="eyebrow">Stage 1 · KIO Internal</p>
              <h2 className="font-display font-bold text-[15px] text-foreground -mt-0.5">New procurement request</h2>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>Cancel</Button>
        </div>
      </div>

      {/* Content — single-scroll experience */}
      <main className="flex-1 w-full px-4 sm:px-6 py-6">
        <div className="max-w-[840px] mx-auto space-y-5">
          <header className="flex items-center gap-2.5">
            <h1 className="font-display text-[26px] font-bold text-foreground tracking-tight leading-tight">New procurement request</h1>
            <span className="chip chip-sab"><Sparkles className="w-2.5 h-2.5" /> AI-assist ready</span>
          </header>

          <AIAssistant onApply={applyAIDraft} />

            {/* 01 Request details */}
            <FormCard step="1" title="Request details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <Field label="Subject" required wide>
                  <Input className="h-9" value={form.subject}
                    placeholder="e.g. Cybersecurity Penetration Testing — Annual Engagement"
                    onChange={e => set("subject", e.target.value)} />
                </Field>
                <Field label="Department" required>
                  <Select value={form.department} onValueChange={v => set("department", v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select a department…" /></SelectTrigger>
                    <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Contract duration">
                  <Input className="h-9" value={form.contractDuration} placeholder="e.g. 12 months"
                    onChange={e => set("contractDuration", e.target.value)} />
                </Field>
                <Field label="Contract start date" required hint={form.startDateEstimated ? "Estimated" : undefined}>
                  <Input type="date" className="h-9" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none w-fit">
                    <input type="checkbox" className="accent-primary w-3.5 h-3.5" checked={form.startDateEstimated}
                      onChange={e => set("startDateEstimated", e.target.checked)} />
                    <span className="text-[11.5px] text-muted-foreground">Start date is uncertain — mark as estimated</span>
                  </label>
                </Field>
                <Field label="Description" required wide>
                  <Textarea className="h-[88px] resize-none" value={form.description}
                    placeholder="Describe the goods or services, scope, and the business need this fulfils…"
                    onChange={e => set("description", e.target.value)} />
                </Field>
                <ContractCostBlock form={form} set={set} />
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="field-label !mb-0">Other details</span>
                    <button type="button" onClick={() => { if (!form.technicalSpecs.trim()) set("technicalSpecs", OTHER_DETAILS_TEMPLATE); }}
                      className="text-[11.5px] text-primary-600 hover:underline flex items-center gap-1 font-medium">
                      <FileText className="w-3 h-3" /> Insert template
                    </button>
                  </div>
                  <Textarea className="h-[120px] resize-y" value={form.technicalSpecs}
                    placeholder="Mandatory requirements, deliverables, engagement window…"
                    onChange={e => set("technicalSpecs", e.target.value)} />
                  <p className="text-[11px] text-muted-foreground mt-1.5 flex items-start gap-1">
                    <Info className="w-2.5 h-2.5 shrink-0 mt-0.5" /> Cover: supplier rationale, evaluation panel &amp; scoring, payment terms
                  </p>
                </div>
                <Field label="Budget code" required>
                  <Select value={form.budgetCode} onValueChange={v => set("budgetCode", v)}>
                    <SelectTrigger className="h-9 font-mono-tnum"><SelectValue placeholder="Select budget code…" /></SelectTrigger>
                    <SelectContent>{BUDGET_CODES.map(c => <SelectItem key={c} value={c} className="font-mono-tnum">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Requisition number">
                  <Input className="h-9 font-mono-tnum" value={form.requisitionNumber} placeholder="REQ-2026-…"
                    onChange={e => set("requisitionNumber", e.target.value)} />
                </Field>
              </div>
            </FormCard>

            {/* 02 Supplier offers */}
            <FormCard step="2" title="Supplier offers"
              action={<span className="text-[11.5px] text-muted-foreground font-mono-tnum">{suppliers.length} {suppliers.length === 1 ? "offer" : "offers"}</span>}>
              <div className="space-y-3">
                {suppliers.map((s, i) => (
                  <SupplierRow key={s.id} s={s} idx={i} onChange={changeSupplier}
                    onRecommend={recommendSupplier} onRemove={removeSupplier} canRemove={suppliers.length > 1} />
                ))}
              </div>
              <button onClick={addSupplier} type="button"
                className="mt-3 w-full h-9 inline-flex items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-card hover:bg-muted text-foreground text-xs font-semibold transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add another supplier offer
              </button>
              <p className="text-[11.5px] text-muted-foreground mt-2 flex items-center gap-1.5">
                <Info className="w-3 h-3 shrink-0" /> KIO policy requires at least 3 competing offers. Submitting with fewer will prompt you for a written justification.
              </p>
            </FormCard>

            {/* 03 Supporting docs & RFP */}
            <FormCard step="3" title="Supporting documents & RFP" badge={<span className="chip chip-gray">Docs optional</span>}>
              <label
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed py-7 cursor-pointer transition-colors ${
                  drag ? "border-primary bg-primary-50" : "border-border-strong hover:border-primary hover:bg-primary-50/40"
                }`}>
                <span className="w-9 h-9 rounded-full bg-primary-50 text-primary flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </span>
                <p className="text-[13px] font-semibold text-foreground mt-1">
                  Drag files here or <span className="text-primary-600">browse</span>
                </p>
                <p className="text-[11.5px] text-muted-foreground font-mono-tnum">PDF, DOCX, XLSX · up to 25 MB each</p>
                <input type="file" multiple className="hidden" onChange={e => e.target.files && addFiles(e.target.files)} />
              </label>

              {files.length > 0 && (
                <ul className="mt-3 divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {files.map(f => (
                    <li key={f.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="w-8 h-8 rounded-md bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                        <FileIcon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-foreground truncate">{f.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono-tnum">{fmtBytes(f.size)}</p>
                      </div>
                      <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))}
                        className="text-muted-2 hover:text-destructive p-1 rounded hover:bg-destructive-50">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* RFP section */}
              <div className="mt-5 pt-5 border-t border-border">
                <div className="flex items-baseline gap-1.5 mb-2">
                  <span className="field-label !mb-0">Was an RFP / tender conducted?</span>
                  <span className="text-destructive text-xs leading-none">*</span>
                </div>
                <div className="inline-flex rounded-md border border-border-strong overflow-hidden bg-card">
                  {[{ k: "yes", l: "Yes" }, { k: "no", l: "No" }].map((t, i) => (
                    <button key={t.k} type="button" onClick={() => set("rfpConducted", t.k as "yes" | "no")}
                      className={`px-4 py-1.5 text-xs font-semibold transition-colors ${i > 0 ? "border-l border-border-strong" : ""} ${
                        form.rfpConducted === t.k ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-primary-50"
                      }`}>{t.l}</button>
                  ))}
                </div>

                {form.rfpConducted === "yes" && (
                  <div className="mt-3 rounded-lg border border-primary-100 bg-primary-50/40 p-3.5">
                    <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <FileIcon className="w-3.5 h-3.5 text-primary-600" /> RFP summary (1-pager)
                    </p>
                    {rfpFile ? (
                      <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3.5 py-2.5">
                        <span className="w-8 h-8 rounded-md bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                          <FileIcon className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-foreground truncate">{rfpFile.name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono-tnum">{fmtBytes(rfpFile.size)}</p>
                        </div>
                        <button onClick={() => setRfpFile(null)} className="text-muted-2 hover:text-destructive p-1 rounded hover:bg-destructive-50">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-card hover:bg-muted text-foreground text-[12px] font-semibold cursor-pointer transition-colors">
                          <Upload className="w-3 h-3" /> Upload 1-pager
                          <input type="file" accept=".pdf,.docx" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) setRfpFile({ name: f.name, size: f.size }); }} />
                        </label>
                        <span className="text-[11.5px] text-muted-2">or</span>
                        <button type="button" onClick={() => { if (!form.rfpSummary.trim()) set("rfpSummary", RFP_TEMPLATE); }}
                          className="text-xs text-primary-600 hover:underline flex items-center gap-1 font-medium">
                          <FileText className="w-3 h-3" /> Fill summary template
                        </button>
                      </div>
                    )}
                    {form.rfpSummary.trim() !== "" && (
                      <Textarea className="h-[120px] resize-y mt-2.5 text-[12.5px] font-mono-tnum bg-card"
                        value={form.rfpSummary} onChange={e => set("rfpSummary", e.target.value)} />
                    )}
                    <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1">
                      <Info className="w-2.5 h-2.5 shrink-0 mt-0.5" /> Attach a document or fill the template — either satisfies the requirement.
                    </p>
                  </div>
                )}

                {form.rfpConducted === "no" && (
                  <div className="mt-3">
                    <div className="flex items-baseline gap-1.5 mb-1.5">
                      <span className="field-label !mb-0">Why was no RFP conducted?</span>
                      <span className="text-destructive text-xs leading-none">*</span>
                    </div>
                    <Textarea className="h-[64px] resize-none" value={form.rfpNoReason}
                      placeholder="e.g. Sole-source — only certified regional vendor; or below the £15k tender threshold."
                      onChange={e => set("rfpNoReason", e.target.value)} />
                  </div>
                )}
              </div>
            </FormCard>

            {/* 04 Approval route */}
            <FormCard step="4" title="Approval route"
              action={
                <button type="button"
                  onClick={() => {
                    const used = [lineManager.name, ...extraApprovers.map(a => a.name)];
                    const pick = DIRECTORY.find(d => !used.includes(d.name)) || DIRECTORY[0];
                    setExtraApprovers(prev => [{ id: v4(), ...pick }, ...prev]);
                  }}
                  className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-card hover:bg-muted text-foreground text-[12px] font-semibold transition-colors">
                  <Plus className="w-3 h-3" /> Add first approver
                </button>
              }>
              <ol className="relative">
                {approverChain.map((c, i) => (
                  <li key={c.key} className="flex items-start gap-3.5 relative pb-4 last:pb-0">
                    {i < approverChain.length - 1 && <span className="absolute left-[19px] top-10 bottom-1 w-px bg-border"></span>}
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 relative z-10 ${
                      c.kind === "extra" ? "bg-sab-50 text-sab ring-2 ring-[hsl(var(--sab-100))]" : "bg-primary-50 text-primary-600"
                    }`}>{c.person.init}</span>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`chip ${c.kind === "extra" ? "chip-sab" : "chip-gray"}`}>Step {i + 1} · {c.role}</span>
                        {c.kind === "extra" && (
                          <button onClick={() => setExtraApprovers(prev => prev.filter(a => a.id !== c.person.init + i))}
                            className="text-muted-2 hover:text-destructive p-0.5 rounded hover:bg-destructive-50 ml-auto" title="Remove approver">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {c.kind === "extra" ? (
                        <Select value={c.person.name} onValueChange={(v) => {
                          const picked = DIRECTORY.find(d => d.name === v)!;
                          setExtraApprovers(prev => prev.map(a => a.name === c.person.name ? { ...a, ...picked } : a));
                        }}>
                          <SelectTrigger className="h-9 max-w-[320px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{DIRECTORY.map(d => <SelectItem key={d.name} value={d.name}>{d.name} — {d.title}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : c.kind === "lm" ? (
                        <div className="flex items-center gap-2">
                          <Select value={c.person.name} onValueChange={(v) => setLineManager(DIRECTORY.find(d => d.name === v)!)}>
                            <SelectTrigger className="h-9 max-w-[320px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{DIRECTORY.map(d => <SelectItem key={d.name} value={d.name}>{d.name} — {d.title}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <p className="text-[13.5px]">
                          <span className="font-semibold text-foreground">{c.person.name}</span>
                          <span className="text-muted-foreground"> · {c.person.title}</span>
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-[11.5px] text-muted-foreground mt-1 flex items-center gap-1.5 border-t border-border pt-3">
                <Workflow className="w-3 h-3 shrink-0" /> After all {approverChain.length} approve, the request advances to{" "}
                <strong className="text-foreground font-semibold">Stage 2 · KIA External Approval</strong>.
              </p>
            </FormCard>
          </div>

          {/* Right: sticky summary rail */}
          <aside className="hidden lg:block">
            <div className="sticky top-[80px] space-y-4">
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <header className="px-5 py-3.5 hairline bg-gradient-to-b from-card to-muted/30">
                  <p className="eyebrow">Submission summary</p>
                </header>
                <div className="px-5 py-4 space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.07em] font-semibold text-muted-foreground">
                      Estimated value <span className="text-muted-2 normal-case font-medium tracking-normal">· inc. VAT</span>
                    </p>
                    <p className="font-display text-[28px] font-bold text-foreground tracking-tight leading-none mt-1 num">
                      KWD {fmtKwd(valueKwd)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {recommended?.company
                        ? <>from <span className="font-medium text-foreground">{recommended.company}</span> (recommended)</>
                        : "mark a recommended offer to set value"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-muted px-3 py-2">
                      <p className="text-muted-foreground text-[11px]">Offers</p>
                      <p className="font-semibold text-foreground num">{validSuppliers.length}</p>
                    </div>
                    <div className="rounded-md bg-muted px-3 py-2">
                      <p className="text-muted-foreground text-[11px]">Documents</p>
                      <p className="font-semibold text-foreground num">{files.length}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.07em] font-semibold text-muted-foreground mb-2">
                      Before you submit <span className="text-muted-2 font-mono-tnum normal-case">· {doneCount}/{totalChecks}</span>
                    </p>
                    <ul className="space-y-2">
                      <ChecklistItem done={checks.details} label="Request details complete" />
                      <ChecklistItem done={checks.contract} label="Contract start date & cost" />
                      <ChecklistItem done={checks.suppliers} label="At least one supplier offer" />
                      <ChecklistItem done={checks.recommended} label="Recommended offer justified" />
                      <ChecklistItem done={checks.rfp} label="RFP summary attached" />
                    </ul>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-border bg-muted/30 space-y-2">
                  <Button onClick={submit} disabled={!canSubmit} className="w-full h-10">
                    <Send className="w-3.5 h-3.5" /> Submit for approval
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/")} className="w-full">Save as draft</Button>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 justify-center font-mono-tnum pt-1">
                    <Lock className="w-2.5 h-2.5" /> Submission is logged in the audit trail
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-lg border border-border p-4">
                <p className="eyebrow mb-2">First approver</p>
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold">
                    {firstApprover.init}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{firstApprover.name}</p>
                    <p className="text-[11.5px] text-muted-foreground truncate">{firstApprover.title}</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Sticky bottom action bar */}
      <div className="sticky bottom-0 border-t border-border bg-card px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {canSubmit
            ? <span className="flex items-center gap-1.5 text-success font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Ready to submit</span>
            : <span>Still needed: <span className="text-foreground font-medium">{missing.join(" · ")}</span></span>}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/")}>Save draft</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            <Send className="w-3.5 h-3.5" /> Submit for approval
          </Button>
        </div>
      </div>

      {/* Justification modal */}
      <Dialog open={showJustModal} onOpenChange={setShowJustModal}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-warning-50 text-warning flex items-center justify-center mb-2">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <DialogTitle className="font-display tracking-tight">Fewer than 3 supplier offers</DialogTitle>
            <DialogDescription>
              KIO policy requires at least 3 competing offers. You've added <strong className="text-foreground">{validSuppliers.length}</strong>.
              Provide a written justification to proceed, or go back and add more suppliers.
            </DialogDescription>
          </DialogHeader>
          <div>
            <div className="flex items-baseline gap-1.5 mb-1.5">
              <span className="field-label !mb-0">Justification</span>
              <span className="text-destructive text-xs leading-none">*</span>
            </div>
            <Textarea className="h-[88px] resize-none" value={justification} onChange={e => setJustification(e.target.value)}
              placeholder="e.g. Only two vendors in the region are CREST-certified — a third quote was solicited but not received within the required timeframe."
              autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowJustModal(false); setJustification(""); }}>Add more suppliers</Button>
            <Button disabled={!justification.trim()} onClick={() => {
              setShowJustModal(false);
              toast.success("Procurement request submitted with justification");
              navigate("/");
            }}>
              <Send className="w-3.5 h-3.5" /> Submit with justification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
