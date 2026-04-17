import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Upload, Loader2, ShieldCheck, ShieldAlert, ShieldX, Sparkles, Hash } from "lucide-react";
import { motion } from "framer-motion";

interface CheckResult {
  verdict: "genuine" | "suspicious" | "fake";
  confidence: number;
  phash: { similarity: number; distance: number; user_hash: string; reference_hash: string };
  vision: { similarity: number; reasoning: string };
  product: { product_id: string; name: string; batch_number: string };
}

export default function VerifyImage() {
  const [params] = useSearchParams();
  const [productId, setProductId] = useState(params.get("pid") || "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const onPick = (f: File | null) => {
    setFile(f); setResult(null);
    if (f) {
      const r = new FileReader(); r.onload = () => setPreview(r.result as string); r.readAsDataURL(f);
    } else setPreview(null);
  };

  const submit = async () => {
    if (!productId || !file) return toast.error("Product ID and image required");
    setBusy(true); setResult(null);
    try {
      const b64: string = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("image-check", {
        body: { product_id: productId, image_base64: b64 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as CheckResult);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };

  const Icon = result?.verdict === "genuine" ? ShieldCheck : result?.verdict === "suspicious" ? ShieldAlert : ShieldX;
  const bg = result?.verdict === "genuine" ? "bg-gradient-trust" : result?.verdict === "suspicious" ? "bg-gradient-warning" : "bg-gradient-danger";

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-12 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl mb-2">Verify packaging photo</h1>
          <p className="text-muted-foreground mb-6">Combines a perceptual hash (deterministic visual fingerprint) and Gemini vision (semantic comparison) against the manufacturer's reference.</p>

          <Card className="p-6 shadow-card space-y-4">
            <div><Label>Product ID</Label><Input value={productId} onChange={(e) => setProductId(e.target.value.toUpperCase())} placeholder="MC-XXXXXXXXXXXX" /></div>
            <div>
              <Label>Photo of the medicine packaging</Label>
              <label className="mt-1 flex flex-col items-center justify-center gap-2 px-4 py-8 border border-dashed rounded-lg cursor-pointer hover:border-primary transition">
                {preview ? (
                  <img src={preview} alt="preview" className="max-h-56 rounded-md" />
                ) : (
                  <><Upload className="h-6 w-6 text-muted-foreground" /><span className="text-sm">Tap to upload (clear, well-lit photo of the box)</span></>
                )}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <Button className="w-full bg-gradient-trust text-primary-foreground" onClick={submit} disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</> : <><Sparkles className="h-4 w-4 mr-2" /> Run AI verification</>}
            </Button>
          </Card>

          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <Card className="overflow-hidden shadow-card">
                <div className={`${bg} text-primary-foreground px-6 py-5 flex items-center gap-3`}>
                  <Icon className="h-8 w-8" />
                  <div className="flex-1">
                    <div className="text-xs opacity-80 uppercase tracking-wider">Verdict</div>
                    <div className="text-2xl font-semibold capitalize">{result.verdict} · {result.confidence}%</div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="text-sm">
                    <div className="font-medium">{result.product.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{result.product.product_id} · batch {result.product.batch_number}</div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-lg p-4 bg-muted/40">
                      <div className="text-xs uppercase text-muted-foreground flex items-center gap-1.5"><Hash className="h-3 w-3" /> Perceptual hash</div>
                      <div className="text-2xl font-semibold mt-1">{result.phash.similarity}%</div>
                      <div className="text-xs text-muted-foreground mt-1">Hamming distance {result.phash.distance}/64</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-2 break-all">user: {result.phash.user_hash}<br/>ref&nbsp;: {result.phash.reference_hash}</div>
                    </div>
                    <div className="rounded-lg p-4 bg-muted/40">
                      <div className="text-xs uppercase text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> Vision model</div>
                      <div className="text-2xl font-semibold mt-1">{result.vision.similarity}%</div>
                      <div className="text-xs text-muted-foreground mt-2">{result.vision.reasoning}</div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Combined score = vision × 0.65 + pHash × 0.35. ≥80 genuine · 55–79 suspicious · &lt;55 fake.
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
