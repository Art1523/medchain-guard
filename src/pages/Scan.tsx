import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanLine, Camera, X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { motion } from "framer-motion";

export default function Scan() {
  const nav = useNavigate();
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const start = async () => {
    setScanning(true);
    setTimeout(async () => {
      const el = "qr-reader";
      const inst = new Html5Qrcode(el);
      scannerRef.current = inst;
      try {
        await inst.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
          (decoded) => { stop(); handleDecoded(decoded); }, () => {});
      } catch (e) {
        setScanning(false);
        alert("Camera unavailable. Use manual entry.");
      }
    }, 100);
  };
  const stop = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };
  useEffect(() => () => { stop(); }, []);

  const handleDecoded = (text: string) => {
    let pid = ""; let sig = "";
    try {
      const obj = JSON.parse(text);
      pid = obj.pid; sig = obj.sig;
    } catch {
      pid = text.trim();
    }
    if (!pid) return;
    nav(`/result/${encodeURIComponent(pid)}${sig ? `?sig=${encodeURIComponent(sig)}` : ""}`);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container py-12 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl mb-2">Scan a medicine</h1>
          <p className="text-muted-foreground mb-6">Point your camera at a MedChain QR or paste a Product ID.</p>

          <Card className="p-6 shadow-card">
            {scanning ? (
              <div className="space-y-3">
                <div id="qr-reader" className="w-full rounded-lg overflow-hidden bg-black aspect-square" />
                <Button variant="outline" className="w-full" onClick={stop}><X className="h-4 w-4 mr-2" /> Stop camera</Button>
              </div>
            ) : (
              <Button className="w-full bg-gradient-trust text-primary-foreground" size="lg" onClick={start}>
                <Camera className="h-5 w-5 mr-2" /> Open camera
              </Button>
            )}
          </Card>

          <div className="my-6 text-center text-xs text-muted-foreground">— or —</div>

          <Card className="p-6 shadow-card">
            <Label>Enter Product ID manually</Label>
            <div className="flex gap-2 mt-2">
              <Input value={manual} onChange={(e) => setManual(e.target.value.toUpperCase())} placeholder="MC-XXXXXXXXXXXX" />
              <Button onClick={() => manual && nav(`/result/${encodeURIComponent(manual)}`)}>
                <ScanLine className="h-4 w-4 mr-2" /> Verify
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
