import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Building2, User } from "lucide-react";
import type { UserRole } from "@/types/procurement";

const ROLES: { role: UserRole; label: string; desc: string; icon: React.ReactNode; badgeClass: string }[] = [
  { role: "ORG_SUPER", label: "Super User", desc: "Full organisation access", icon: <Shield className="w-5 h-5" />, badgeClass: "bg-destructive/10 text-destructive" },
  { role: "DEPT_SUPER", label: "Department Head", desc: "Department-scoped access", icon: <Building2 className="w-5 h-5" />, badgeClass: "bg-primary/10 text-primary" },
  { role: "BUSINESS", label: "Business User", desc: "Own requests & approvals", icon: <User className="w-5 h-5" />, badgeClass: "bg-muted text-muted-foreground" },
];

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = (role: UserRole) => {
    signIn(role);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-primary-foreground">KIO</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Procurement Portal</h1>
          <p className="text-muted-foreground text-sm">Kuwait Investment Office</p>
        </div>

        <div className="section-card">
          <div className="p-6 space-y-3">
            <p className="text-sm font-medium text-muted-foreground text-center mb-4">
              Select a role to sign in (mock auth)
            </p>
            {ROLES.map(({ role, label, desc, icon, badgeClass }) => (
              <button
                key={role}
                onClick={() => handleSignIn(role)}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-left"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${badgeClass}`}>
                  {icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${badgeClass}`}>
                  {role}
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          In production, this will use Microsoft Entra ID (Azure AD) via MSAL.
        </p>
      </div>
    </div>
  );
};

export default Login;
