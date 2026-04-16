export type UserRole = "ORG_SUPER" | "DEPT_SUPER" | "BUSINESS";

export interface User {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  avatar: string;
  role: UserRole;
}

export type RequestStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Referred to SAB"
  | "Open"
  | "Complete";

export type ApprovalStatus = "In Queue" | "Awaiting Approval" | "Approved" | "Rejected";
export type ApproverType = "Internal" | "Business Approver" | "Finance Approver" | "External";

export interface ApprovalRecord {
  id: string;
  approverName: string;
  approverTitle: string;
  approverAvatar: string;
  approverType: ApproverType;
  stage: 1 | 2;
  sequenceOrder: number;
  status: ApprovalStatus;
  comments?: string;
  decidedAt?: string;
}

export interface SupplierOffer {
  id: string;
  companyName: string;
  currency: string;
  totalExclVat: number;
  totalInclVat: number;
  totalKwd: number;
  priceExpiryDate?: string;
  notes?: string;
  recommended: boolean;
  justification?: string;
  files: { name: string; size: number }[];
}

export interface EvidenceFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  documentType: "supplier" | "general" | "kia";
}

export interface ActivityEntry {
  id: string;
  action: string;
  performedBy: string;
  timestamp: string;
  details?: string;
}

export interface ProcurementRequest {
  id: string;
  trackerNumber: string;
  subject: string;
  department: string;
  description: string;
  contractDuration: string;
  contractFrom?: string;
  contractTo?: string;
  budgetCode: string;
  requisitionNumber?: string;
  technicalSpecs?: string;
  status: RequestStatus;
  owner: string;
  ownerDepartment: string;
  recommendedSupplier?: string;
  totalValueKwd: number;
  createdAt: string;
  modifiedAt: string;
  currentApprover?: string;
  suppliers: SupplierOffer[];
  approvals: ApprovalRecord[];
  evidenceFiles: EvidenceFile[];
  activity: ActivityEntry[];
}
