// Hash-chained tamper-evident ledger helpers.
// Each block: SHA-256( prev_hash || canonical_json(payload) || created_at_iso )
// Verifying recomputes the chain from genesis. Any tamper breaks subsequent hashes.

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function canonicalize(value: unknown): string {
  // Stable JSON: sorted keys, no whitespace
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}

export async function computeBlockHash(prevHash: string, payload: unknown, createdAtIso: string) {
  return sha256Hex(prevHash + "|" + canonicalize(payload) + "|" + createdAtIso);
}
