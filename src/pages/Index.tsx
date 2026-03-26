import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, FileText } from "lucide-react";
import RequestDetailsSection, { type RequestDetails } from "@/components/procurement/RequestDetailsSection";
import SuppliersSection from "@/components/procurement/SuppliersSection";
import type { SupplierData } from "@/components/procurement/SupplierCard";
import SupportingEvidenceSection from "@/components/procurement/SupportingEvidenceSection";
import ApprovalPanel from "@/components/procurement/ApprovalPanel";
import { v4 } from "@/lib/uid";

const Index = () => {
  const [requestDetails, setRequestDetails] = useState<RequestDetails>({
    subject: "",
    department: "",
    description: "",
    contractDuration: "",
    budgetCode: "",
    requisitionNumber: "",
    technicalSpecs: "",
  });

  const [suppliers, setSuppliers] = useState<SupplierData[]>([
    {
      id: v4(),
      companyName: "",
      currency: "KWD",
      totalExclVat: "",
      totalInclVat: "",
      totalKwd: "",
      recommended: false,
      justification: "",
      files: [],
    },
  ]);

  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [firstApproverOverride, setFirstApproverOverride] = useState("default");

  const totalFileCount = suppliers.reduce((sum, s) => sum + s.files.length, 0) + evidenceFiles.length;

  const handleSubmit = () => {
    if (!requestDetails.subject || !requestDetails.department || !requestDetails.description || !requestDetails.budgetCode) {
      toast.error("Please fill in all required fields in Request Details.");
      return;
    }
    if (!suppliers.some((s) => s.companyName)) {
      toast.error("At least one supplier with a company name is required.");
      return;
    }
    const recommended = suppliers.filter((s) => s.recommended);
    if (recommended.some((s) => !s.justification.trim())) {
      toast.error("Please provide justification for all recommended suppliers.");
      return;
    }
    toast.success("Procurement request submitted successfully!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Procurement Request</h1>
              <p className="text-xs text-muted-foreground">New Submission</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">Save Draft</Button>
            <Button onClick={handleSubmit}>
              <Send className="w-4 h-4 mr-2" />
              Submit Request
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Form sections */}
          <div className="lg:col-span-2 space-y-6">
            <RequestDetailsSection data={requestDetails} onChange={setRequestDetails} />
            <SuppliersSection suppliers={suppliers} onChange={setSuppliers} />
            <SupportingEvidenceSection
              files={evidenceFiles}
              onChange={setEvidenceFiles}
              totalFileCount={totalFileCount}
            />

            {/* Bottom submit */}
            <div className="flex justify-end gap-3 pt-4 pb-8">
              <Button variant="outline">Save Draft</Button>
              <Button onClick={handleSubmit} size="lg">
                <Send className="w-4 h-4 mr-2" />
                Submit Procurement Request
              </Button>
            </div>
          </div>

          {/* Right: Approval panel */}
          <div className="hidden lg:block">
            <ApprovalPanel
              firstApproverOverride={firstApproverOverride}
              onFirstApproverChange={setFirstApproverOverride}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
