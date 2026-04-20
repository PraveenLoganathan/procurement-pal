import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
import {
  DEPARTMENTS,
  MOCK_DIRECTORY,
  PERMISSION_LABELS,
  type Department,
  type PermissionType,
} from "@/data/accessData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, ShieldPlus, Trash2, Users, KeyRound, Building2 } from "lucide-react";
import { toast } from "sonner";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const AccessManagement = () => {
  const { user } = useAuth();
  const { grants, addGrant, revokeGrant } = useAccess();
  const [search, setSearch] = useState("");
  const [permFilter, setPermFilter] = useState<PermissionType | "ALL">("ALL");

  // Grant dialog state
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [permission, setPermission] = useState<PermissionType | "">("");
  const [department, setDepartment] = useState<Department | "">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ORG_SUPER") return <Navigate to="/" replace />;

  const usersById = useMemo(
    () => Object.fromEntries(MOCK_DIRECTORY.map((u) => [u.id, u])),
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grants.filter((g) => {
      if (permFilter !== "ALL" && g.permission !== permFilter) return false;
      if (!q) return true;
      const u = usersById[g.userId];
      return (
        u?.name.toLowerCase().includes(q) ||
        u?.email.toLowerCase().includes(q) ||
        g.department?.toLowerCase().includes(q)
      );
    });
  }, [grants, search, permFilter, usersById]);

  const stats = useMemo(() => {
    const uniqueUsers = new Set(grants.map((g) => g.userId)).size;
    const orgWide = grants.filter((g) => g.permission === "ORG_READ_ALL").length;
    return { total: grants.length, uniqueUsers, orgWide };
  }, [grants]);

  const reset = () => {
    setUserId("");
    setPermission("");
    setDepartment("");
    setExpiresAt("");
    setNote("");
  };

  const requiresDept = permission && PERMISSION_LABELS[permission].scoped;
  const canSubmit = userId && permission && (!requiresDept || department);

  const handleSubmit = () => {
    if (!canSubmit || !permission) return;
    addGrant({
      userId,
      permission,
      department: requiresDept ? (department as Department) : undefined,
      grantedBy: user.name,
      expiresAt: expiresAt || undefined,
      note: note.trim() || undefined,
    });
    toast.success("Access granted", {
      description: `${usersById[userId]?.name} • ${PERMISSION_LABELS[permission].label}`,
    });
    reset();
    setOpen(false);
  };

  const handleRevoke = (id: string, name: string) => {
    revokeGrant(id);
    toast.success("Access revoked", { description: name });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Access & Permissions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Grant department-scoped or org-wide permissions to users.
            </p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button>
                <ShieldPlus className="w-4 h-4 mr-1" /> Grant Access
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Access</DialogTitle>
                <DialogDescription>Assign a permission to a directory user.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                    <SelectContent>
                      {MOCK_DIRECTORY.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} — {u.jobTitle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Permission</Label>
                  <Select value={permission} onValueChange={(v) => setPermission(v as PermissionType)}>
                    <SelectTrigger><SelectValue placeholder="Select permission" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PERMISSION_LABELS).map(([key, val]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex flex-col">
                            <span>{val.label}</span>
                            <span className="text-xs text-muted-foreground">{val.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {requiresDept && (
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
                      <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Expires (optional)</Label>
                  <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Note (optional)</Label>
                  <Textarea
                    placeholder="Reason or context for this grant"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!canSubmit}>Grant Access</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<KeyRound className="w-4 h-4" />} label="Active grants" value={stats.total} />
          <StatCard icon={<Users className="w-4 h-4" />} label="Users with access" value={stats.uniqueUsers} />
          <StatCard icon={<Building2 className="w-4 h-4" />} label="Org-wide grants" value={stats.orgWide} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or department"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={permFilter} onValueChange={(v) => setPermFilter(v as PermissionType | "ALL")}>
                <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All permissions</SelectItem>
                  {Object.entries(PERMISSION_LABELS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No grants match your filters.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Permission</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Granted</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((g) => {
                      const u = usersById[g.userId];
                      return (
                        <TableRow key={g.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                                {u?.avatar}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground leading-tight">{u?.name}</p>
                                <p className="text-xs text-muted-foreground">{u?.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                              {PERMISSION_LABELS[g.permission].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-foreground">
                            {g.department ?? <span className="text-muted-foreground">Organization</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <div>{formatDate(g.grantedAt)}</div>
                            <div className="text-xs">by {g.grantedBy}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {g.expiresAt ? formatDate(g.expiresAt) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(g.id, u?.name ?? "user")}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Revoke
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <Card>
    <CardContent className="p-5 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
    </CardContent>
  </Card>
);

export default AccessManagement;
