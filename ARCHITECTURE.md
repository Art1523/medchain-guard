# MedChain AI — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│                                                                 │
│   React 18 + TypeScript + Vite                                  │
│   ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐  │
│   │  Scan    │ │  Result  │ │Manufacturer│ │ VerifyImage    │  │
│   │  Page    │ │  Page    │ │   Page    │ │ (pHash+Vision) │  │
│   └────┬─────┘ └────┬─────┘ └─────┬─────┘ └───────┬────────┘  │
│        └────────────┴─────────────┴───────────────┘            │
│                           │                                     │
│                    Supabase JS Client                           │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTPS (direct)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Platform                            │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │   Auth   │  │PostgreSQL│  │ Storage  │  │ Edge Functions│  │
│  │  (JWT)   │  │   (RLS)  │  │ (images) │  │   (Deno)      │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Hosting & Deployment

```
Developer writes code
        │
        ▼
Lovable Cloud (AI-assisted IDE)
        │  auto-syncs
        ▼
GitHub Repository (Art1523/medichain-trust)
        │  auto-deploys on push
        ▼
Lovable Hosting (frontend CDN)
        │
        └── serves built React app to users
                │
                └── calls Supabase directly via HTTPS
```

- **Lovable** handles the full frontend build pipeline and hosting
- No separate CI/CD configuration needed — push to GitHub triggers deploy automatically
- Supabase is called directly from the browser using the anon key + JWT

---

## Database Schema

```
auth.users (Supabase managed)
    │
    ├── profiles          (display_name, company_name)
    ├── user_roles        (role: manufacturer|distributor|pharmacy|consumer|admin)
    │
    └── medicines         (product_id, qr_secret, name, batch, dates, phash)
            │
            ├── supply_chain_events   (actor, event_type, location, timestamp)
            ├── scan_logs             (trust_score, status, location, ip_hash)
            └── ledger                (block_type, payload, prev_hash, block_hash)

storage.buckets
    └── medicine-images   (reference packaging photos)
```

### Key Design Decisions

- **Row Level Security (RLS)** on every table — no client can read/write beyond its role
- **Ledger table has no INSERT/UPDATE/DELETE policies** — only edge functions with the service role key can write blocks, preventing any client from forging blocks
- **qr_secret** is never exposed in full API responses — only the first 12 chars are embedded in the QR as a signature

---

## Blockchain / Ledger Architecture

### Block Structure

```
┌─────────────────────────────────────────────┐
│  Block N                                    │
│                                             │
│  id:          bigserial (auto-increment)    │
│  medicine_id: uuid (FK → medicines)         │
│  block_type:  genesis | supply_event |      │
│               image_anchor                  │
│  payload:     jsonb (event data)            │
│  prev_hash:   SHA-256 of block N-1          │
│  block_hash:  SHA-256(prev_hash|payload|ts) │
│  created_at:  timestamptz                   │
└─────────────────────────────────────────────┘
```

### Hash Formula

```
block_hash = SHA-256(
    prev_hash
    + "|"
    + canonicalize(payload)   ← sorted-key JSON, no whitespace
    + "|"
    + created_at_iso
)
```

Genesis block uses `"0000...0000"` (64 zeros) as `prev_hash`.

### Why Canonical JSON?

Standard `JSON.stringify()` does not guarantee key order. If key order changes, the hash changes — allowing subtle tampering. Canonical JSON sorts all keys recursively before hashing, making the hash deterministic and order-independent.

### Chain Verification

```
verify-ledger edge function:

prev = "0000...0000"
for each block in ascending order:
    expected = SHA-256(prev | canonicalize(payload) | created_at)
    if expected ≠ block.block_hash → TAMPERED
    if block.prev_hash ≠ prev     → TAMPERED
    prev = block.block_hash
```

Any modification to any block's data, timestamp, or order breaks all subsequent hashes — making tampering immediately detectable.

### Block Lifecycle

```
Manufacturer registers medicine
        │
        ▼
register-medicine (edge fn)
        │
        ├── INSERT medicines row
        ├── Compute pHash of reference image
        └── INSERT ledger block (type: genesis)
                │
                ▼
        Distributor ships
                │
                ▼
        update-supply-chain (edge fn)
                │
                ├── INSERT supply_chain_events row
                ├── Fetch latest block_hash (chain tip)
                └── INSERT ledger block (type: supply_event)
                        │
                        ▼
                Pharmacy receives → same flow
                        │
                        ▼
                Patient scans QR
                        │
                        ▼
                verify-qr (edge fn)
                        │
                        ├── Recompute entire chain
                        ├── Check QR signature
                        ├── Run anomaly detection
                        └── Return trust score + verdict
```

---

## Edge Functions

| Function | Trigger | What it does |
|---|---|---|
| `register-medicine` | Manufacturer submits form | Validates role, uploads image, computes pHash, creates medicine row, writes genesis block |
| `update-supply-chain` | Distributor/pharmacy submits event | Validates role, inserts supply_chain_event, fetches chain tip, appends new block |
| `verify-qr` | Patient scans QR | Fetches medicine + chain + scans + ledger, verifies integrity, runs anomaly detection, returns trust score |
| `verify-ledger` | Standalone audit | Recomputes full chain for a product, returns per-block validity |
| `image-check` | User uploads packaging photo | Computes pHash of uploaded image, calls Gemini vision, combines scores, returns verdict |

All edge functions run on **Deno** (Supabase's serverless runtime). Only edge functions with the `SUPABASE_SERVICE_ROLE_KEY` can write to the ledger table.

---



### Why pHash + Vision?

- **pHash alone** fails on minor print variations, lighting, and angles
- **Vision alone** is expensive and can hallucinate
- **Combined**: pHash catches pixel-level forgeries fast and cheap; Gemini catches semantic differences (wrong logo, different text, repackaged product)

---

## Authentication & Authorization

```
Supabase Auth (JWT)
        │
        ├── Email/password signup
        ├── Auto-creates profile row (trigger: on_auth_user_created)
        └── Role assigned at signup → stored in user_roles table

Role checks:
        has_role(user_id, 'manufacturer') → PostgreSQL function
        Called inside RLS policies AND edge functions
```

### RLS Policy Summary

| Table | Read | Write |
|---|---|---|
| medicines | Anyone | Manufacturer only (own rows) |
| supply_chain_events | Anyone | Manufacturer + Distributor + Pharmacy |
| scan_logs | Anyone | Anyone (anonymous scans allowed) |
| ledger | Anyone | Service role only (edge functions) |
| profiles | Anyone | Own row only |
| user_roles | Own rows | Own row (signup only) |

---

## Anomaly Detection Logic

On every QR scan, `verify-qr` computes a trust score (0–100):

```
score = 100

if QR signature mismatch       → score -= 40
if ledger integrity failed     → score -= 60
if 5+  scans in last 24h       → score -= 15
if 15+ scans in last 24h       → score -= 20
if 3+  distinct locations/24h  → score -= 25
if rapid scans < 10s apart     → score -= 15
if medicine is expired         → score -= 30
if no supply chain events      → score -= 10

score = clamp(score, 0, 100)

≥ 80 → genuine
50–79 → suspicious
< 50 → fake
```

Every scan is logged to `scan_logs` with the computed score and status.

---

## Security Considerations

- `.env` is gitignored — secrets never committed to GitHub
- `qr_secret` is never returned in full from any API — only the 12-char signature prefix is embedded in QR
- Ledger is append-only from the client's perspective — no RLS insert policy means only service-role edge functions can write
- Scan logs accept anonymous inserts but validate `product_id` length and existence
- All edge functions validate JWT before any write operation
- Storage policies require authenticated upload and scoped object paths (`user_id/filename`)
- Supabase anon key is safe to expose in frontend — RLS enforces all access control server-side
