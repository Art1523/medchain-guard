import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Boxes, ScanLine, ShieldAlert, ShieldCheck, Activity } from "lucide-react";
import { motion } from "framer-motion";

interface Stat { label: string; value: number; icon: any; color: string; }

export default function Dashboard() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [topFlagged, setTopFlagged] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ count: medCount }, { count: scanCount }, { data: fakes }, { data: scans }] = await Promise.all([
        supabase.from("medicines").select("*", { count: "exact", head: true }),
        supabase.from("scan_logs").select("*", { count: "exact", head: true }),
        supabase.from("scan_logs").select("*").lt("trust_score", 50),
        supabase.from("scan_logs").select("*, medicines(name, product_id)").order("created_at", { ascending: false }).limit(15),
      ]);
      const totalChain = (await supabase.from("supply_chain_events").select("*", { count: "exact", head: true })).count ?? 0;
      setStats([
        { label: "Registered medicines", value: medCount ?? 0, icon: Boxes, color: "text-primary" },
        { label: "Total scans", value: scanCount ?? 0, icon: ScanLine, color: "text-accent" },
        { label: "Chain events", value: totalChain, icon: Activity, color: "text-success" },
        { label: "Fraud flags", value: fakes?.length ?? 0, icon: ShieldAlert, color: "text-destructive" },
      ]);
      setRecentScans(scans ?? []);
      // group fakes per product
      const map = new Map<string, number>();
      (fakes ?? []).forEach((f: any) => map.set(f.product_id, (map.get(f.product_id) ?? 0) + 1));
      setTopFlagged([...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5));
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-12">
        <h1 className="text-3xl mb-6">Network analytics</h1>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card className="p-5 shadow-card">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <div className="text-3xl font-semibold mt-2 tabular-nums">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-6 shadow-card">
            <h3 className="text-lg mb-3">Recent scans</h3>
            <div className="space-y-1 text-sm max-h-96 overflow-auto">
              {recentScans.length === 0 && <div className="text-muted-foreground text-sm">No scans yet.</div>}
              {recentScans.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0 text-xs">
                  <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                  <span className="truncate flex-1">{s.medicines?.name || s.product_id}</span>
                  <span className={s.status === "genuine" ? "text-success" : s.status === "suspicious" ? "text-warning" : "text-destructive"}>
                    {s.status} · {s.trust_score}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 shadow-card">
            <h3 className="text-lg mb-3 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" /> Top flagged products</h3>
            {topFlagged.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-success" /> No fraud detected.</div>
            ) : (
              <div className="space-y-2">
                {topFlagged.map(([pid, n]) => (
                  <div key={pid} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs">{pid}</span>
                    <span className="text-destructive">{n} flags</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
