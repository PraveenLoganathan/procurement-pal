import type { User } from "@/types/procurement";

export const DEPARTMENTS = [
  "Information Technology",
  "Facilities Management",
  "Human Resources",
  "Legal & Compliance",
  "Marketing & Communications",
  "Finance",
  "Operations",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export type PermissionType =
  | "ORG_READ_ALL"
  | "DEPT_READ"
  | "DEPT_APPROVER"
  | "DEPT_SUBMITTER";

export const PERMISSION_LABELS: Record<PermissionType, { label: string; description: string; scoped: boolean }> = {
  ORG_READ_ALL: {
    label: "Org-wide Read-only",
    description: "View all requests across every department",
    scoped: false,
  },
  DEPT_READ: {
    label: "Read-only (Department)",
    description: "View all requests within a specific department",
    scoped: true,
  },
  DEPT_APPROVER: {
    label: "Approver (Department)",
    description: "Act as an approver for a department's requests",
    scoped: true,
  },
  DEPT_SUBMITTER: {
    label: "Submitter (Department)",
    description: "Create new requests on behalf of a department",
    scoped: true,
  },
};

export interface AccessGrant {
  id: string;
  userId: string;
  permission: PermissionType;
  department?: Department;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  note?: string;
}

export const MOCK_DIRECTORY: User[] = [
  { id: "u1", name: "Ahmad Al-Rashidi", email: "ahmad.alrashidi@kio.co.uk", jobTitle: "IT Security Manager", department: "Information Technology", avatar: "AR", role: "ORG_SUPER" },
  { id: "u2", name: "Fatima Al-Sabah", email: "fatima.alsabah@kio.co.uk", jobTitle: "Head of IT", department: "Information Technology", avatar: "FS", role: "DEPT_SUPER" },
  { id: "u3", name: "Layla Al-Fahad", email: "layla.alfahad@kio.co.uk", jobTitle: "HR Specialist", department: "Human Resources", avatar: "LF", role: "BUSINESS" },
  { id: "u4", name: "Yousef Al-Mutairi", email: "yousef.almutairi@kio.co.uk", jobTitle: "Legal Counsel", department: "Legal & Compliance", avatar: "YM", role: "BUSINESS" },
  { id: "u5", name: "Noura Al-Ajmi", email: "noura.alajmi@kio.co.uk", jobTitle: "Marketing Director", department: "Marketing & Communications", avatar: "NA", role: "DEPT_SUPER" },
  { id: "u6", name: "Khalid Al-Otaibi", email: "khalid.alotaibi@kio.co.uk", jobTitle: "Finance Analyst", department: "Finance", avatar: "KO", role: "BUSINESS" },
  { id: "u7", name: "Sara Al-Kandari", email: "sara.alkandari@kio.co.uk", jobTitle: "Operations Manager", department: "Operations", avatar: "SK", role: "BUSINESS" },
  { id: "u8", name: "Omar Al-Hajri", email: "omar.alhajri@kio.co.uk", jobTitle: "Facilities Coordinator", department: "Facilities Management", avatar: "OH", role: "BUSINESS" },
  { id: "u9", name: "Mariam Al-Saleh", email: "mariam.alsaleh@kio.co.uk", jobTitle: "Procurement Auditor", department: "Finance", avatar: "MS", role: "BUSINESS" },
];

export const INITIAL_GRANTS: AccessGrant[] = [
  { id: "g1", userId: "u9", permission: "ORG_READ_ALL", grantedBy: "Ahmad Al-Rashidi", grantedAt: "2024-02-12T10:00:00Z", note: "Quarterly audit access" },
  { id: "g2", userId: "u4", permission: "DEPT_READ", department: "Information Technology", grantedBy: "Ahmad Al-Rashidi", grantedAt: "2024-03-01T09:15:00Z" },
  { id: "g3", userId: "u6", permission: "DEPT_APPROVER", department: "Information Technology", grantedBy: "Ahmad Al-Rashidi", grantedAt: "2024-01-20T11:30:00Z", expiresAt: "2024-12-31" },
  { id: "g4", userId: "u3", permission: "DEPT_SUBMITTER", department: "Operations", grantedBy: "Ahmad Al-Rashidi", grantedAt: "2024-03-22T08:45:00Z" },
];
