// Perceptual hash (aHash 8x8) implemented for Deno edge runtime using ImageScript.
// Returns 64-bit hex string. Hamming distance between two hashes ~ visual similarity.
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

export async function pHashFromBytes(bytes: Uint8Array): Promise<string> {
  const img = await Image.decode(bytes);
  const small = img.resize(8, 8);
  // grayscale luminance
  const lum: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const px = small.getPixelAt(x + 1, y + 1); // ImageScript is 1-indexed
      const r = (px >> 24) & 0xff;
      const g = (px >> 16) & 0xff;
      const b = (px >> 8) & 0xff;
      lum.push(0.299 * r + 0.587 * g + 0.114 * b);
    }
  }
  const avg = lum.reduce((a, b) => a + b, 0) / lum.length;
  let bits = "";
  for (const v of lum) bits += v >= avg ? "1" : "0";
  // bits length 64 → hex 16 chars
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

// Convert hamming distance (0..64) to a similarity percent (100 = identical)
export function hammingToSimilarity(distance: number): number {
  return Math.max(0, Math.round((1 - distance / 64) * 100));
}
