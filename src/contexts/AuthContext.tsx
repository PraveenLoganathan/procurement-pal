import React, { createContext, useContext, useState, type ReactNode } from "react";
import type { User, UserRole } from "@/types/procurement";

interface AuthContextType {
  user: User | null;
  signIn: (role: UserRole) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, signIn: () => {}, signOut: () => {} });

const ROLE_USERS: Record<UserRole, User> = {
  ORG_SUPER: {
    id: "u1", name: "Ahmad Al-Rashidi", email: "ahmad.alrashidi@kio.co.uk",
    jobTitle: "IT Security Manager", department: "Information Technology", avatar: "AR", role: "ORG_SUPER",
  },
  DEPT_SUPER: {
    id: "u2", name: "Fatima Al-Sabah", email: "fatima.alsabah@kio.co.uk",
    jobTitle: "Head of IT", department: "Information Technology", avatar: "FS", role: "DEPT_SUPER",
  },
  BUSINESS: {
    id: "u3", name: "Layla Al-Fahad", email: "layla.alfahad@kio.co.uk",
    jobTitle: "HR Specialist", department: "Human Resources", avatar: "LF", role: "BUSINESS",
  },
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const signIn = (role: UserRole) => setUser(ROLE_USERS[role]);
  const signOut = () => setUser(null);

  return <AuthContext.Provider value={{ user, signIn, signOut }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
