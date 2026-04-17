import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import TrustGauge from "@/components/TrustGauge";
import {
  ShieldCheck, ShieldAlert, ShieldX, Factory, Truck, Building2, MapPin,
  Clock, Loader2, Lock, Camera, AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";

interface Result {
  status: "genuine" | "suspicious" | "fake";
  trust_score: number;
  reasons: string[];
  ledger_valid: boolean;
  ledger_blocks: number;
  medicine: any;
  chain: any[];
  scans: any[];
}

const eventIcon: Record<string, any> = {
  manufactured: Factory, shipped: Truck, received: Building2, dispensed: ShieldCheck, quality_check: ShieldCheck,
};

export default function ResultPage() {
  const { productId } = useParams<{ productId: string }>();
  const [params] = useSearchParams();
  const sig = params.get("sig") || undefined;
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Best-effort: get coarse "location" from timezone — kept simple, no IP geolocation.
        const location = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const { data: r, error } = await supabase.functions.invoke("verify-qr", {
          body: { product_id: productId, sig, location },
        });
        if (error) throw error;
        if ((r as any)?.error) throw new Error((r as any).error);
        setData(r as Result);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      } finally { setLoading(false); }
    })();
  }, [productId, sig]);

  if (loading) return <div className="min-h-screen"><Header /><div className="container py-20 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Verifying on chain…</div></div>;
  if (err || !data) return <div className="min-h-screen"><Header /><div className="container py-20 text-center text-destructive">{err}</div></div>;

  const StatusIcon = data.status === "genuine" ? ShieldCheck : data.status === "suspicious" ? ShieldAlert : ShieldX;
  const statusBg = data.status === "genuine" ? "bg-gradient-trust" : data.status === "suspicious" ? "bg-gradient-warning" : "bg-gradient-danger";

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-12 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-3 gap-6">
          {/* Trust */}
          <Card className="p-6 shadow-card md:col-span-1">
            <div className={`-mx-6 -mt-6 px-6 py-4 ${statusBg} text-primary-foreground flex items-center gap-2 rounded-t-xl`}>
              <StatusIcon className="h-5 w-5" />
              <span className="font-semibold capitalize">{data.status}</span>
            </div>
            <div className="py-6"><TrustGauge score={data.trust_score} /></div>
            <div className="text-xs text-center text-muted-foreground">
              <Lock className="h-3 w-3 inline mr-1" />
              {data.ledger_valid ? `Ledger verified · ${data.ledger_blocks} blocks` : "⚠ Ledger integrity FAILED"}
            </div>
          </Card>

          {/* Medicine + reasons */}
          <Card className="p-6 shadow-card md:col-span-2">
            {data.medicine ? (
              <>
                <div className="text-xs text-muted-foreground font-mono">{data.medicine.product_id}</div>
                <h2 className="text-2xl mt-1">{data.medicine.name}</h2>
                <div className="text-sm text-muted-foreground mt-1">
                  by <span className="text-foreground">{data.medicine.manufacturer_name}</span>
                  {" · "}Batch {data.medicine.batch_number}
                  {" · "}Exp {data.medicine.expiry_date}
                </div>
                {data.reasons.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {data.reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-6 flex gap-2 flex-wrap">
                  <Link to={`/verify-image?pid=${data.medicine.product_id}`}>
                    <Button variant="outline" size="sm"><Camera className="h-4 w-4 mr-2" /> Verify packaging photo</Button>
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <ShieldX className="h-12 w-12 mx-auto text-destructive mb-2" />
                <div className="font-semibold">Unknown product</div>
                <div className="text-sm text-muted-foreground mt-1">This Product ID is not on the blockchain. Likely counterfeit.</div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Supply chain timeline */}
        {data.chain.length > 0 && (
          <Card className="p-6 mt-6 shadow-card">
            <h3 className="text-lg mb-4 flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Supply chain</h3>
            <ol className="relative border-l-2 border-border ml-2 space-y-5">
              {data.chain.map((e, i) => {
                const Ic = eventIcon[e.event_type] ?? Factory;
                return (
                  <motion.li key={e.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="ml-6">
                    <span className="absolute -left-[13px] mt-1 h-6 w-6 rounded-full bg-gradient-trust grid place-items-center shadow-elegant">
                      <Ic className="h-3 w-3 text-primary-foreground" />
                    </span>
                    <div className="text-sm font-medium capitalize">{e.event_type.replace("_", " ")} · <span className="text-muted-foreground font-normal">{e.actor_name} ({e.actor_role})</span></div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    {e.notes && <div className="text-xs text-muted-foreground mt-1">{e.notes}</div>}
                  </motion.li>
                );
              })}
            </ol>
          </Card>
        )}

        {/* Recent scans */}
        {data.scans.length > 0 && (
          <Card className="p-6 mt-6 shadow-card">
            <h3 className="text-lg mb-3">Recent scans</h3>
            <div className="space-y-1.5 text-sm max-h-72 overflow-auto">
              {data.scans.slice(0, 20).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs gap-3 py-1.5 border-b last:border-0">
                  <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                  <span>{s.location || "—"}</span>
                  <Badge variant={s.status === "genuine" ? "default" : "destructive"}>{s.status} · {s.trust_score}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
