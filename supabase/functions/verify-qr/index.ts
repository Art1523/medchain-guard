// Verify a scanned QR: returns product, full chain, scan history, anomaly trust score, and verifies ledger integrity.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { computeBlockHash } from "../_shared/chain.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { product_id, sig, location } = await req.json();
    if (!product_id) return json({ error: "Missing product_id" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: med } = await admin.from("medicines").select("*").eq("product_id", product_id).maybeSingle();
    if (!med) {
      // Log unknown scan as fake
      await admin.from("scan_logs").insert({
        product_id, location: location ?? null, trust_score: 0, status: "fake",
      });
      return json({
        status: "fake", trust_score: 0,
        reasons: ["Product ID not found on the blockchain ledger."],
        medicine: null, chain: [], scans: [], ledger_valid: false,
      });
    }

    // Validate dynamic QR signature (first 12 chars of qr_secret)
    const sigOk = !sig || sig === med.qr_secret.slice(0, 12);

    // Fetch chain & scans & ledger
    const [{ data: chain }, { data: scans }, { data: ledger }] = await Promise.all([
      admin.from("supply_chain_events").select("*").eq("medicine_id", med.id).order("created_at"),
      admin.from("scan_logs").select("*").eq("medicine_id", med.id).order("created_at", { ascending: false }).limit(50),
      admin.from("ledger").select("*").eq("medicine_id", med.id).order("id"),
    ]);

    // === Verify ledger integrity ===
    let ledger_valid = true;
    let prev = "0".repeat(64);
    for (const b of ledger ?? []) {
      const expected = await computeBlockHash(prev, b.payload, new Date(b.created_at).toISOString());
      if (expected !== b.block_hash || b.prev_hash !== prev) { ledger_valid = false; break; }
      prev = b.block_hash;
    }

    // === Anomaly detection ===
    const reasons: string[] = [];
    let score = 100;

    if (!sigOk) { score -= 40; reasons.push("Dynamic QR signature mismatch (possible cloned QR)."); }
    if (!ledger_valid) { score -= 60; reasons.push("Blockchain ledger integrity check FAILED."); }

    const now = Date.now();
    const recent = (scans ?? []).filter((s) => now - new Date(s.created_at).getTime() < 1000 * 60 * 60 * 24);
    const distinctLocations = new Set(recent.map((s) => s.location).filter(Boolean));

    if (recent.length >= 5) { score -= 15; reasons.push(`High scan frequency: ${recent.length} scans in 24h.`); }
    if (recent.length >= 15) { score -= 20; reasons.push("Abnormally high scan volume."); }
    if (distinctLocations.size >= 3) { score -= 25; reasons.push(`Scanned in ${distinctLocations.size} distinct locations within 24h (possible duplication).`); }

    // Time-gap anomaly: very rapid repeated scans (<10s apart)
    if (recent.length >= 2) {
      const sorted = [...recent].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      let rapid = 0;
      for (let i = 1; i < sorted.length; i++) {
        if (+new Date(sorted[i].created_at) - +new Date(sorted[i - 1].created_at) < 10_000) rapid++;
      }
      if (rapid >= 2) { score -= 15; reasons.push("Multiple scans within seconds — bot or duplication suspected."); }
    }

    // Expiry check
    if (new Date(med.expiry_date).getTime() < now) { score -= 30; reasons.push("Medicine is past its expiry date."); }

    // Chain completeness
    if ((chain?.length ?? 0) < 1) { score -= 10; reasons.push("No supply chain events recorded."); }

    score = Math.max(0, Math.min(100, score));
    const status = score >= 80 ? "genuine" : score >= 50 ? "suspicious" : "fake";

    // Log this scan
    await admin.from("scan_logs").insert({
      medicine_id: med.id, product_id, location: location ?? null,
      trust_score: score, status,
    });

    return json({
      status, trust_score: score, reasons, ledger_valid,
      medicine: {
        id: med.id, product_id: med.product_id, name: med.name, batch_number: med.batch_number,
        manufacture_date: med.manufacture_date, expiry_date: med.expiry_date,
        manufacturer_name: med.manufacturer_name, reference_image_path: med.reference_image_path,
      },
      chain: chain ?? [],
      scans: scans ?? [],
      ledger_blocks: (ledger ?? []).length,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
