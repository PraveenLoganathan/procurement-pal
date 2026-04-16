import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, RefreshCw, Shield, Building2, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const ROLE_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  ORG_SUPER: { label: "Super User", className: "bg-destructive/10 text-destructive border-0", icon: <Shield className="w-3 h-3" /> },
  DEPT_SUPER: { label: "Department Head", className: "bg-primary/10 text-primary border-0", icon: <Building2 className="w-3 h-3" /> },
  BUSINESS: { label: "Business User", className: "bg-muted text-muted-foreground border-0", icon: <User className="w-3 h-3" /> },
};

interface Props {
  onRefresh?: () => void;
}

const AppHeader = ({ onRefresh }: Props) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const badge = ROLE_BADGE[user.role];
  const isDashboard = location.pathname === "/";

  return (
    <header className="border-b bg-card sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-sm font-bold text-primary-foreground">KIO</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">Procurement Portal</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDashboard && (
            <>
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                </Button>
              )}
              <Button size="sm" onClick={() => navigate("/new")}>
                <Plus className="w-4 h-4 mr-1" /> New Request
              </Button>
            </>
          )}
          <div className="flex items-center gap-2 pl-3 border-l">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
              {user.avatar}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-foreground leading-tight">{user.name}</p>
              <Badge variant="secondary" className={`${badge.className} text-[10px] px-1.5 py-0 gap-1`}>
                {badge.icon} {badge.label}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { signOut(); navigate("/login"); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
