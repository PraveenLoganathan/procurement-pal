import SectionWrapper from "./SectionWrapper";
import CharCountInput from "./CharCountInput";
import CharCountTextarea from "./CharCountTextarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RequestDetails {
  subject: string;
  department: string;
  description: string;
  contractDuration: string;
  budgetCode: string;
  requisitionNumber: string;
  technicalSpecs: string;
}

interface Props {
  data: RequestDetails;
  onChange: (data: RequestDetails) => void;
}

const DEPARTMENTS = [
  "Information Technology",
  "Finance & Accounting",
  "Human Resources",
  "Operations",
  "Legal & Compliance",
  "Marketing & Communications",
  "Facilities Management",
  "Procurement",
];

const BUDGET_CODES = [
  "CAPEX-2024-IT-001",
  "CAPEX-2024-OPS-002",
  "OPEX-2024-IT-003",
  "OPEX-2024-HR-004",
  "OPEX-2024-MKT-005",
  "CAPEX-2024-FAC-006",
];

const RequestDetailsSection = ({ data, onChange }: Props) => {
  const update = (field: keyof RequestDetails, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <SectionWrapper number={1} title="Request Details">
      <CharCountInput
        label="Subject"
        value={data.subject}
        onChange={(v) => update("subject", v)}
        maxLength={255}
        placeholder="Enter a brief subject for this procurement request"
        required
      />

      <div>
        <label className="field-label">
          Department<span className="text-destructive ml-0.5">*</span>
        </label>
        <Select value={data.department} onValueChange={(v) => update("department", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CharCountTextarea
        label="Description of Deliverable"
        value={data.description}
        onChange={(v) => update("description", v)}
        maxLength={2000}
        placeholder="Describe what is being procured, including scope of work, expected outcomes, and any specific requirements"
        required
        rows={5}
      />

      <div>
        <label className="field-label">
          Contract Duration<span className="text-destructive ml-0.5">*</span>
        </label>
        <Input
          value={data.contractDuration}
          onChange={(e) => update("contractDuration", e.target.value)}
          placeholder="e.g. 01/03/2024 – 31/12/2024 (Actual) or ~6 months (Estimated)"
        />
        <p className="field-hint">Specify whether dates are Actual or Estimated</p>
      </div>

      <div>
        <label className="field-label">
          Budget Allocation Code<span className="text-destructive ml-0.5">*</span>
        </label>
        <Select value={data.budgetCode} onValueChange={(v) => update("budgetCode", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select budget code" />
          </SelectTrigger>
          <SelectContent>
            {BUDGET_CODES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="field-label">Requisition Number</label>
        <Input
          value={data.requisitionNumber}
          onChange={(e) => update("requisitionNumber", e.target.value)}
          placeholder="Optional — enter if available"
        />
        <p className="field-hint">Leave blank if not yet assigned</p>
      </div>

      <CharCountTextarea
        label="Technical Specifications"
        value={data.technicalSpecs}
        onChange={(v) => update("technicalSpecs", v)}
        maxLength={5000}
        placeholder={`Include the following where applicable:\n• Supplier shortlist and selection criteria\n• Three-quote rationale (or justification for sole-source)\n• Evaluation panel members\n• Payment terms and milestones\n• Tender/RFP requirements and deadlines`}
        rows={8}
      />
    </SectionWrapper>
  );
};

export type { RequestDetails };
export default RequestDetailsSection;
