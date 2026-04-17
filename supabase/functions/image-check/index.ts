// Image-based authenticity check.
// Combines:
//   1) Perceptual hash similarity vs manufacturer's reference image (deterministic)
//   2) Lovable AI Gemini vision comparison (semantic — packaging details, logo, fonts)
// Returns a single 0..100 genuine confidence.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { pHashFromBytes, hammingHex, hammingToSimilarity } from "../_shared/phash.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { product_id, image_base64 } = await req.json();
    if (!product_id || !image_base64) return json({ error: "Missing product_id or image" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: med } = await admin.from("medicines").select("*").eq("product_id", product_id).maybeSingle();
    if (!med) return json({ error: "Unknown product" }, 404);
    if (!med.reference_image_path || !med.reference_phash) {
      return json({ error: "Manufacturer has not uploaded a reference image yet." }, 400);
    }

    // Decode incoming image
    const b64 = image_base64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
    const userBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    // (1) pHash similarity
    const userHash = await pHashFromBytes(userBytes);
    const distance = hammingHex(userHash, med.reference_phash);
    const phashSim = hammingToSimilarity(distance); // 0..100

    // Download reference image for vision LLM
    const { data: refBlob } = await admin.storage.from("medicine-images").download(med.reference_image_path);
    const refBytes = new Uint8Array(await refBlob!.arrayBuffer());
    const refB64 = btoa(String.fromCharCode(...refBytes));

    // (2) Vision LLM comparison via Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let visionScore = phashSim; // fallback
    let visionReasoning = "Vision model unavailable; using perceptual hash only.";
    if (LOVABLE_API_KEY) {
      const visionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a pharmaceutical packaging authenticator. Compare the USER image against the REFERENCE image (same medicine). " +
                "Score 0-100 how visually consistent the user image is with the reference (logos, fonts, layout, color, batch label area). " +
                "Be honest. If the images clearly do not match, return a low score. Output ONLY via the score function.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Reference image of "${med.name}" (batch ${med.batch_number}):` },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${refB64}` } },
                { type: "text", text: "User-submitted image to authenticate:" },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
              ],
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "score",
              description: "Return authenticity score",
              parameters: {
                type: "object",
                properties: {
                  similarity: { type: "integer", minimum: 0, maximum: 100 },
                  reasoning: { type: "string" },
                },
                required: ["similarity", "reasoning"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "score" } },
        }),
      });
      if (visionResp.ok) {
        const j = await visionResp.json();
        const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) {
          try {
            const parsed = JSON.parse(args);
            visionScore = Math.max(0, Math.min(100, parsed.similarity));
            visionReasoning = parsed.reasoning ?? "";
          } catch (_) { /* keep fallback */ }
        }
      } else {
        const t = await visionResp.text();
        console.error("vision err", visionResp.status, t);
        if (visionResp.status === 429) return json({ error: "AI rate limit. Please retry shortly." }, 429);
        if (visionResp.status === 402) return json({ error: "AI credits exhausted. Add funds in Settings." }, 402);
      }
    }

    // Combine: weight vision higher (semantic) but anchor with pHash
    const combined = Math.round(visionScore * 0.65 + phashSim * 0.35);
    const verdict = combined >= 80 ? "genuine" : combined >= 55 ? "suspicious" : "fake";

    return json({
      verdict, confidence: combined,
      phash: { similarity: phashSim, distance, user_hash: userHash, reference_hash: med.reference_phash },
      vision: { similarity: visionScore, reasoning: visionReasoning },
      product: { product_id: med.product_id, name: med.name, batch_number: med.batch_number },
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
