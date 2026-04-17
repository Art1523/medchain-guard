import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Moon, Sun, ShieldCheck, LogOut } from "lucide-react";

export default function Header() {
  const { user, roles, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <header className="sticky top-0 z-40 glass">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-trust grid place-items-center shadow-elegant">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">MedChain<span className="text-primary">AI</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/scan" className={linkCls}>Scan</NavLink>
          <NavLink to="/verify-image" className={linkCls}>Image Verify</NavLink>
          <NavLink to="/dashboard" className={linkCls}>Dashboard</NavLink>
          {roles.includes("manufacturer") && <NavLink to="/manufacturer" className={linkCls}>Manufacturer</NavLink>}
          {(roles.includes("distributor") || roles.includes("pharmacy")) && (
            <NavLink to="/chain" className={linkCls}>Update Chain</NavLink>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user ? (
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav("/"); }}>
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          ) : (
            <Button size="sm" onClick={() => nav("/auth")}>Sign in</Button>
          )}
        </div>
      </div>
    </header>
  );
}
