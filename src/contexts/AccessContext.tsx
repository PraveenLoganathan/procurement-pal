import { createContext, useContext, useState, type ReactNode } from "react";
import { INITIAL_GRANTS, type AccessGrant } from "@/data/accessData";
import { v4 as uid } from "@/lib/uid";

interface AccessContextType {
  grants: AccessGrant[];
  addGrant: (grant: Omit<AccessGrant, "id" | "grantedAt">) => void;
  revokeGrant: (id: string) => void;
}

const AccessContext = createContext<AccessContextType>({
  grants: [],
  addGrant: () => {},
  revokeGrant: () => {},
});

export const AccessProvider = ({ children }: { children: ReactNode }) => {
  const [grants, setGrants] = useState<AccessGrant[]>(INITIAL_GRANTS);

  const addGrant: AccessContextType["addGrant"] = (grant) => {
    setGrants((prev) => [
      { ...grant, id: uid(), grantedAt: new Date().toISOString() },
      ...prev,
    ]);
  };

  const revokeGrant = (id: string) => setGrants((prev) => prev.filter((g) => g.id !== id));

  return (
    <AccessContext.Provider value={{ grants, addGrant, revokeGrant }}>{children}</AccessContext.Provider>
  );
};

export const useAccess = () => useContext(AccessContext);
