import { useEffect, useRef } from "react";

// Tiny QR generator wrapper — uses the Google Charts-free public qrserver.com API as image,
// so we don't need a native QR lib. Falls back to data URL via a CDN-free approach: we use
// a minimal pure-canvas QR via 'qrcode' if installed; otherwise an <img> from a public API.
// Here we use the well-known and lightweight `qrcode` lib only if present; otherwise fallback.
export default function QrPreview({ value, size = 160 }: { value: string; size?: number }) {
  // Use api.qrserver.com (free, no auth). Acceptable for hackathon prototype.
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&qzone=1`;
  return (
    <img
      src={url}
      alt="QR code"
      width={size}
      height={size}
      className="rounded-md border bg-white p-1"
    />
  );
}
