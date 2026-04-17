import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import {
  ShieldCheck, ScanLine, Boxes, Brain, Lock, Activity, Sparkles, ArrowRight,
} from "lucide-react";

const features = [
  { icon: Lock, title: "Tamper-evident ledger", desc: "Every supply-chain step is hash-chained — any tampering breaks the chain instantly." },
  { icon: Brain, title: "AI anomaly detection", desc: "Detects cloned QRs by analyzing scan frequency, location variance, and timing." },
  { icon: ScanLine, title: "Dynamic QR signatures", desc: "Each medicine has a private signature — duplicated codes are flagged on scan." },
  { icon: Sparkles, title: "Vision packaging check", desc: "Compare a photo of the box against the manufacturer's reference using pHash + Gemini vision." },
];

const steps = [
  { n: "01", t: "Manufacturer registers", d: "Medicine + reference photo are signed onto the chain. Genesis block created." },
  { n: "02", t: "Supply chain updates", d: "Distributor → pharmacy each append immutable events to the ledger." },
  { n: "03", t: "Patient scans QR", d: "App fetches blockchain history, scan logs, and runs anomaly checks." },
  { n: "04", t: "AI computes trust", d: "0–100 score with verdict: Genuine, Suspicious, or Fake — with reasons." },
];

export default function Index() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="container py-20 md:py-32">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-muted-foreground mb-6">
            <Activity className="h-3 w-3 text-primary" /> Hackathon prototype · Lovable Cloud + Lovable AI
          </div>
          <h1 className="text-5xl md:text-7xl leading-[1.05] tracking-tight">
            Stop fake medicine.
            <br />
            <span className="text-gradient-trust">Verify in one scan.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            MedChain AI fuses a tamper-evident blockchain ledger with computer-vision packaging checks
            and behavioural anomaly detection — so patients know if a pill is real before they swallow it.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center">
            <Link to="/scan">
              <Button size="lg" className="bg-gradient-trust shadow-elegant text-primary-foreground">
                <ScanLine className="mr-2 h-5 w-5" /> Scan a QR
              </Button>
            </Link>
            <Link to="/manufacturer">
              <Button size="lg" variant="outline">
                <Boxes className="mr-2 h-5 w-5" /> I'm a manufacturer
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="container pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="glass rounded-2xl p-6 shadow-card">
              <f.icon className="h-6 w-6 text-primary mb-4" />
              <h3 className="text-base mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="container pb-32">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl">How a single scan becomes truth</h2>
          <p className="text-muted-foreground mt-2">From manufacturer to patient, every step is provable.</p>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <motion.div key={s.n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="relative rounded-2xl p-6 bg-card border shadow-card">
              <div className="text-xs font-mono text-primary mb-3">{s.n}</div>
              <div className="font-semibold mb-1">{s.t}</div>
              <div className="text-sm text-muted-foreground">{s.d}</div>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          MedChain AI · Built with Lovable Cloud · Hash-chained ledger · Gemini vision
        </div>
      </footer>
    </div>
  );
}
