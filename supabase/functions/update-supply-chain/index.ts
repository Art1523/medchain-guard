// Append a supply chain event + ledger block (distributor/pharmacy/manufacturer).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { computeBlockHash } from "../_shared/chain.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing auth" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Invalid session" }, 401);
    const user = u.user;

    const { product_id, event_type, location, notes } = await req.json();
    if (!product_id || !event_type || !location) return json({ error: "Missing fields" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const allowed = ["manufacturer", "distributor", "pharmacy"];
    const role = roles?.find((r) => allowed.includes(r.role))?.role;
    if (!role) return json({ error: "Role not allowed to update chain" }, 403);

    const { data: med } = await admin.from("medicines").select("*").eq("product_id", product_id).maybeSingle();
    if (!med) return json({ error: "Unknown product" }, 404);

    const { data: profile } = await admin.from("profiles").select("display_name, company_name").eq("user_id", user.id).maybeSingle();
    const actor_name = profile?.company_name || profile?.display_name || "Unknown";

    const { data: evt, error: evtErr } = await admin.from("supply_chain_events").insert({
      medicine_id: med.id, actor_id: user.id, actor_role: role,
      actor_name, event_type, location, notes: notes ?? null,
    }).select().single();
    if (evtErr) return json({ error: evtErr.message }, 400);

    // Append ledger block linking to previous tip
    const { data: prev } = await admin.from("ledger").select("block_hash")
      .eq("medicine_id", med.id).order("id", { ascending: false }).limit(1).maybeSingle();
    const prev_hash = prev?.block_hash ?? "0".repeat(64);
    const createdAt = evt.created_at;
    const payload = {
      type: "supply_event", event_type, location, actor_id: user.id, actor_role: role, actor_name, notes: notes ?? null,
    };
    const block_hash = await computeBlockHash(prev_hash, payload, createdAt);
    await admin.from("ledger").insert({
      medicine_id: med.id, block_type: "supply_event", payload, prev_hash, block_hash, created_at: createdAt,
    });

    return json({ ok: true, event: evt, block_hash });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
