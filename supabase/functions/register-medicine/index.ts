// Register a new medicine: creates DB row + computes pHash of reference image + writes genesis ledger block.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { computeBlockHash } from "../_shared/chain.ts";
import { pHashFromBytes } from "../_shared/phash.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const user = userData.user;

    const body = await req.json();
    const { name, batch_number, manufacture_date, expiry_date, reference_image_path, manufacturer_name } = body ?? {};
    if (!name || !batch_number || !manufacture_date || !expiry_date || !manufacturer_name) {
      return json({ error: "Missing required fields" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    // Verify role
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r) => r.role === "manufacturer")) return json({ error: "Manufacturer role required" }, 403);

    // Compute pHash from reference image (if provided)
    let reference_phash: string | null = null;
    if (reference_image_path) {
      const { data: blob, error: dlErr } = await admin.storage.from("medicine-images").download(reference_image_path);
      if (dlErr) console.error("download err", dlErr);
      else {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        try { reference_phash = await pHashFromBytes(bytes); } catch (e) { console.error("phash err", e); }
      }
    }

    // Generate IDs
    const product_id = "MC-" + crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
    const qr_secret = crypto.randomUUID().replace(/-/g, "");

    const { data: med, error: medErr } = await admin.from("medicines").insert({
      product_id, qr_secret, name, batch_number, manufacture_date, expiry_date,
      manufacturer_id: user.id, manufacturer_name, reference_image_path, reference_phash,
    }).select().single();
    if (medErr) return json({ error: medErr.message }, 400);

    // Genesis ledger block
    const createdAt = new Date().toISOString();
    const payload = {
      type: "genesis",
      product_id: med.product_id,
      name: med.name,
      batch_number: med.batch_number,
      manufacture_date: med.manufacture_date,
      expiry_date: med.expiry_date,
      manufacturer_id: user.id,
      manufacturer_name,
      reference_phash,
    };
    const prev_hash = "0".repeat(64);
    const block_hash = await computeBlockHash(prev_hash, payload, createdAt);
    await admin.from("ledger").insert({
      medicine_id: med.id, block_type: "genesis", payload, prev_hash, block_hash, created_at: createdAt,
    });

    // Also log first supply chain event "manufactured"
    await admin.from("supply_chain_events").insert({
      medicine_id: med.id, actor_id: user.id, actor_role: "manufacturer",
      actor_name: manufacturer_name, event_type: "manufactured",
      location: "Manufacturing Facility", notes: "Product registered on chain",
    });

    return json({ ok: true, medicine: med, qr_payload: { pid: med.product_id, sig: qr_secret.slice(0, 12) } });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
