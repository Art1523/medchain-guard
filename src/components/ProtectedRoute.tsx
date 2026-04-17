import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({
  children, requireRole,
}: { children: ReactNode; requireRole?: ("manufacturer" | "distributor" | "pharmacy")[] }) {
  const { user, roles, loading } = useAuth();
  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (requireRole && !roles.some((r) => requireRole.includes(r as never))) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
