import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Truck, Loader2, PackageCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Chain() {
  const { user, roles } = useAuth();
  const [productId, setProductId] = useState("");
  const [eventType, setEventType] = useState("shipped");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  const role = roles.find((r) => ["manufacturer", "distributor", "pharmacy"].includes(r));

  useEffect(() => { (async () => {
    if (!user) return;
    const { data } = await supabase.from("supply_chain_events").select("*, medicines(name, product_id)")
      .eq("actor_id", user.id).order("created_at", { ascending: false }).limit(15);
    setRecent(data ?? []);
  })(); }, [user, busy]);

  const submit = async () => {
    if (!productId || !location) return toast.error("Product ID and location are required");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-supply-chain", {
        body: { product_id: productId, event_type: eventType, location, notes },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Block appended · ${(data as any).block_hash.slice(0, 10)}…`);
      setNotes(""); setLocation("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  if (!role) {
    return <div className="min-h-screen"><Header />
      <div className="container py-20 text-center text-muted-foreground">You need a manufacturer/distributor/pharmacy role to update the chain.</div>
    </div>;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-12 grid lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl mb-2">Update supply chain</h1>
          <p className="text-muted-foreground mb-6">Log a movement event. The block is hash-chained to the previous block — any tampering breaks verification.</p>
          <Card className="p-6 space-y-4 shadow-card">
            <div><Label>Product ID *</Label><Input value={productId} onChange={(e) => setProductId(e.target.value.toUpperCase())} placeholder="MC-XXXXXXXXXXXX" /></div>
            <div>
              <Label>Event type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipped">Shipped from warehouse</SelectItem>
                  <SelectItem value="received">Received at facility</SelectItem>
                  <SelectItem value="dispensed">Dispensed to patient</SelectItem>
                  <SelectItem value="quality_check">Quality check passed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Location *</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Mumbai Distribution Hub" /></div>
            <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
            <Button className="w-full bg-gradient-trust text-primary-foreground" onClick={submit} disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Appending…</> : <><Truck className="h-4 w-4 mr-2" /> Append to chain</>}
            </Button>
          </Card>
        </motion.div>

        <div>
          <h2 className="text-xl mb-4">Your recent events</h2>
          <div className="space-y-2">
            {recent.length === 0 && <Card className="p-6 text-sm text-muted-foreground text-center">No events yet.</Card>}
            {recent.map((r) => (
              <Card key={r.id} className="p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center"><PackageCheck className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{r.event_type} · {r.location}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.medicines?.name} · {r.medicines?.product_id}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
