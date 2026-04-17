import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Upload, ShieldCheck, QrCode, ImageIcon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import QrPreview from "@/components/QrPreview";

interface Medicine {
  id: string; product_id: string; name: string; batch_number: string;
  manufacture_date: string; expiry_date: string; reference_image_path: string | null;
  reference_phash: string | null; qr_secret: string;
}

export default function Manufacturer() {
  const { user, roles } = useAuth();
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", batch_number: "", manufacture_date: "",
    expiry_date: "", manufacturer_name: "", notes: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const isManufacturer = roles.includes("manufacturer");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("medicines").select("*")
      .eq("manufacturer_id", user.id).order("created_at", { ascending: false });
    setMeds((data ?? []) as Medicine[]);
  };
  useEffect(() => { load(); }, [user]);

  const submit = async () => {
    if (!user) return toast.error("Sign in first");
    if (!isManufacturer) return toast.error("Manufacturer role required");
    if (!form.name || !form.batch_number || !form.manufacture_date || !form.expiry_date || !form.manufacturer_name) {
      return toast.error("Fill all required fields");
    }
    if (!imageFile) return toast.error("Reference packaging image is required for AI verification");

    setBusy(true);
    try {
      // 1) Upload image first to user folder
      const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("medicine-images").upload(path, imageFile, {
        contentType: imageFile.type, upsert: false,
      });
      if (upErr) throw upErr;

      // 2) Call edge function
      const { data, error } = await supabase.functions.invoke("register-medicine", {
        body: { ...form, reference_image_path: path },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(`Registered. Product ID: ${(data as any).medicine.product_id}`);
      setForm({ name: "", batch_number: "", manufacture_date: "", expiry_date: "", manufacturer_name: form.manufacturer_name, notes: "" });
      setImageFile(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!isManufacturer) {
    return (
      <div className="min-h-screen"><Header />
        <div className="container py-20 text-center">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl">Manufacturer access required</h2>
          <p className="text-muted-foreground mt-2">Create an account with the Manufacturer role to register medicines.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-12 grid lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl mb-2">Register a medicine</h1>
          <p className="text-muted-foreground mb-6">Each registration creates a genesis block on the immutable ledger and computes a perceptual hash of the reference packaging.</p>
          <Card className="p-6 space-y-4 shadow-card">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Manufacturer / company name *</Label>
                <Input value={form.manufacturer_name} onChange={(e) => setForm({ ...form, manufacturer_name: e.target.value })} placeholder="Acme Pharma Ltd." /></div>
              <div className="col-span-2"><Label>Medicine name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Paracetamol 500mg" /></div>
              <div><Label>Batch number *</Label>
                <Input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} placeholder="B-2025-0417" /></div>
              <div><Label>Manufacture date *</Label>
                <Input type="date" value={form.manufacture_date} onChange={(e) => setForm({ ...form, manufacture_date: e.target.value })} /></div>
              <div><Label>Expiry date *</Label>
                <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
              <div className="col-span-2">
                <Label>Reference packaging photo *</Label>
                <label className="mt-1 flex items-center gap-3 px-4 py-3 border border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">{imageFile ? imageFile.name : "Click to upload (JPG/PNG, clear photo of the box)"}</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                </label>
                <p className="text-xs text-muted-foreground mt-1">A perceptual hash is computed and stored on-chain — used later to authenticate user-submitted photos.</p>
              </div>
            </div>
            <Button onClick={submit} disabled={busy} className="w-full bg-gradient-trust text-primary-foreground">
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering on chain…</> :
                      <><ShieldCheck className="h-4 w-4 mr-2" /> Register & sign genesis block</>}
            </Button>
          </Card>
        </motion.div>

        <div>
          <h2 className="text-xl mb-4">Your registered medicines</h2>
          <div className="space-y-3">
            {meds.length === 0 && <Card className="p-6 text-sm text-muted-foreground text-center">No medicines yet.</Card>}
            {meds.map((m) => <MedCard key={m.id} med={m} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function MedCard({ med }: { med: Medicine }) {
  const [showQr, setShowQr] = useState(false);
  const sig = med.qr_secret.slice(0, 12);
  const payload = JSON.stringify({ pid: med.product_id, sig });
  const refUrl = med.reference_image_path
    ? supabase.storage.from("medicine-images").getPublicUrl(med.reference_image_path).data.publicUrl
    : null;

  return (
    <Card className="p-4 shadow-card">
      <div className="flex items-start gap-3">
        {refUrl ? (
          <img src={refUrl} alt={med.name} className="w-16 h-16 rounded-md object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-md bg-muted grid place-items-center"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{med.name}</div>
          <div className="text-xs text-muted-foreground font-mono">{med.product_id}</div>
          <div className="text-xs text-muted-foreground">Batch {med.batch_number} · exp {med.expiry_date}</div>
          {med.reference_phash && <div className="text-[10px] font-mono text-muted-foreground mt-1">pHash {med.reference_phash}</div>}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowQr((v) => !v)}><QrCode className="h-4 w-4" /></Button>
      </div>
      {showQr && (
        <div className="mt-4 flex items-center gap-4">
          <QrPreview value={payload} />
          <div className="text-xs">
            <div className="text-muted-foreground">QR payload (print on packaging):</div>
            <code className="block mt-1 p-2 rounded bg-muted text-[10px] break-all">{payload}</code>
          </div>
        </div>
      )}
    </Card>
  );
}
