// Recompute the hash chain for a medicine to prove tamper-evidence.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { computeBlockHash } from "../_shared/chain.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const product_id = url.searchParams.get("product_id");
    if (!product_id) return json({ error: "product_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: med } = await admin.from("medicines").select("id").eq("product_id", product_id).maybeSingle();
    if (!med) return json({ error: "Unknown" }, 404);
    const { data: ledger } = await admin.from("ledger").select("*").eq("medicine_id", med.id).order("id");

    let prev = "0".repeat(64);
    const verified: { id: number; valid: boolean; expected: string; stored: string }[] = [];
    let valid = true;
    for (const b of ledger ?? []) {
      const expected = await computeBlockHash(prev, b.payload, new Date(b.created_at).toISOString());
      const ok = expected === b.block_hash && b.prev_hash === prev;
      if (!ok) valid = false;
      verified.push({ id: b.id, valid: ok, expected, stored: b.block_hash });
      prev = b.block_hash;
    }
    return json({ valid, blocks: verified, count: verified.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
