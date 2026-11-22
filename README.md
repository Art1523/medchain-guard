# MedChain AI

> Stop fake medicine. Verify in one scan.

MedChain AI is a pharmaceutical anti-counterfeiting platform that fuses a **tamper-evident blockchain ledger**, **AI-powered anomaly detection**, and **computer-vision packaging verification** — so patients know if a pill is real before they swallow it.

Live demo → **https://medichain-trust-1-4erp.onrender.com**

---

## The Problem

The WHO estimates **1 in 10 medicines** in low/middle-income countries is substandard or falsified. Existing solutions are expensive, centralized, or require specialized hardware. MedChain AI solves this with a smartphone camera and a QR code.

---

## Key Features

| Feature | Description |
|---|---|
| Tamper-evident ledger | Every supply-chain step is SHA-256 hash-chained — any tampering breaks the chain instantly |
| Dynamic QR signatures | Each medicine has a private signing secret — duplicated QR codes are flagged on scan |
| AI anomaly detection | Detects cloned QRs by analyzing scan frequency, location variance, and timing patterns |
| Vision packaging check | Compares a photo of the box against the manufacturer's reference  |
| Role-based access | Manufacturer → Distributor → Pharmacy → Consumer — each role has scoped permissions |
| Real-time dashboard | Network-wide analytics: scan counts, fraud flags, top flagged products |

---
D7QGDW
## How It Works

```
01  Manufacturer registers
    Medicine + reference photo signed onto the chain.
    Genesis block created with perceptual hash of packaging.

02  Supply chain updates
    Distributor → Pharmacy each append immutable events to the ledger.
    Every block is cryptographically linked to the previous one.

03  Patient scans QR
    App fetches blockchain history, scan logs, and runs anomaly checks.

04  AI computes trust score
    0–100 score with verdict: Genuine / Suspicious / Fake — with reasons.
```

---

## Trust Score System

| Condition | Penalty |
|---|---|
| QR signature mismatch | −40 |
| Ledger integrity failed | −60 |
| 5+ scans in 24 hours | −15 |
| 15+ scans in 24 hours | −20 |
| Scanned in 3+ locations in 24h | −25 |
| Multiple scans within 10 seconds | −15 |
| Medicine expired | −30 |
| No supply chain events | −10 |

| Score | Verdict |
|---|---|
| 80 – 100 | ✅ Genuine |
| 50 – 79 | ⚠️ Suspicious |
| 0 – 49 | ❌ Fake |

---

## Tech Stack

**Frontend**
- React 18 + TypeScript 5
- Vite 5 (SWC)
- Tailwind CSS + shadcn/ui + Radix UI
- Framer Motion, Recharts, React Router v6
- TanStack Query v5, React Hook Form + Zod

**Backend**
- Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- Deno-based Edge Functions (serverless)
- Row Level Security on all tables


**Blockchain / Ledger**
- Custom SHA-256 hash-chained ledger (no public chain)
- Web Crypto API (`crypto.subtle.digest`)
- Canonical JSON serialization (sorted keys, tamper-proof)
- Genesis + supply_event + image_anchor block types

**AI / Vision**
- Perceptual hashing (pHash) — 64-bit visual fingerprint of packaging

- Combined score: vision × 0.65 + pHash × 0.35

---

## Project Structure

```
src/
├── pages/
│   ├── Index.tsx          # Landing page
│   ├── Scan.tsx           # QR scanner (camera + manual)
│   ├── Result.tsx         # Verification result + supply chain timeline
│   ├── VerifyImage.tsx    # Packaging photo AI verification
│   ├── Manufacturer.tsx   # Register medicines, view QR codes
│   ├── Chain.tsx          # Append supply chain events
│   ├── Dashboard.tsx      # Network analytics
│   └── Auth.tsx           # Login / signup
├── components/
│   ├── TrustGauge.tsx     # Animated SVG trust score gauge
│   ├── QrPreview.tsx      # QR code renderer
│   ├── Header.tsx
│   └── ui/                # shadcn/ui components
├── contexts/
│   ├── AuthContext.tsx    # Auth + role management
│   └── ThemeContext.tsx
└── integrations/
    └── supabase/
        ├── client.ts      # Supabase client (points to Cloudflare proxy)
        └── types.ts       # Generated DB types

supabase/
├── functions/
│   ├── register-medicine/     # Creates genesis block
│   ├── update-supply-chain/   # Appends supply_event block
│   ├── verify-qr/             # Full verification + trust score
│   ├── verify-ledger/         # Standalone chain integrity check
│   ├── image-check/           # pHash + Gemini vision comparison
│   └── _shared/
│       ├── chain.ts           # SHA-256 hash-chain engine
│       ├── phash.ts           # Perceptual hash implementation
│       └── cors.ts
└── migrations/                # PostgreSQL schema
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Cloudflare account (for jiobase proxy, optional)

### Local Development

```bash
# Clone the repo
git clone https://github.com/Art1523/medichain-trust.git
cd medichain-trust

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your values in .env

# Start dev server
npm run dev
```


### Deploy to LOVABLE

1. Push to GitHub
2. Create a new **Web Service**
3. Set build command: `npm install && npm run build`
4. Set start command: `npx serve -s dist -l $PORT`
5. Add environment variables


---

## User Roles

| Role | Permissions |
|---|---|
| **Manufacturer** | Register medicines, upload reference images, view own QR codes |
| **Distributor** | Append supply chain events (shipped, received) |
| **Pharmacy** | Append supply chain events (received, dispensed) |
| **Consumer** | Scan QR codes, verify packaging photos |


---

## License

MIT — built as a hackathon prototype.

