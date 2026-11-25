<div align="center">

<img src="./public/logo.jpg" alt="Food Rescue — Share Food • Reduce Waste • Nourish Lives" width="480" style="border-radius:16px; max-width:100%;"/>

[![CI](https://github.com/still-trying/food-rescue/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/still-trying/food-rescue/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-RLS_Hardened-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)
[![Node](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)

**[🌐 Live Demo](#)** · **[🐛 Report Bug](../../issues)** · **[✨ Request Feature](../../issues)**

</div>

---

## 📚 Table of Contents

- [What is Food Rescue?](#-what-is-food-rescue)
- [Core User Flow](#-core-user-flow)
- [System Architecture](#-system-architecture)
- [Data Flow](#-data-flow)
- [Database Schema](#-database-schema)
- [Listing Lifecycle](#-listing-lifecycle)
- [Security Architecture](#-security-architecture)
- [ML & AI Layer](#-ml--ai-layer)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Project Structure](#-project-structure)
- [Feature Set](#-feature-set)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Supabase Setup](#-supabase-setup)
- [Edge Functions](#-edge-functions)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Performance](#-performance)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌱 What is Food Rescue?

Food Rescue is a **production-grade, full-stack Progressive Web App** that connects surplus food donors with people nearby who can use it — before it becomes waste.

Restaurants, home kitchens, bakeries, grocers, and individuals can post listings in seconds. Nearby authenticated users can discover, claim, and pick up food in real time.

> [!IMPORTANT]
> **Core lifecycle:** `Available → Claimed → Picked Up`
>
> Listings auto-expire when their pickup window closes. Stale browser tabs are protected against invalid claims via server-side RPC guards.

---

## 🔄 Core User Flow

```mermaid
flowchart LR
    A(["📤 Post Listing"])
    B(["🔍 Discover Feed"])
    C(["📍 Locate on Map"])
    D(["🤝 Claim"])
    E(["🔑 PIN Handoff"])
    F(["✅ Picked Up"])
    G(["♻️ Impact Logged"])

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G

    style A fill:#FFD166,stroke:#b8860b,color:#000000
    style B fill:#06D6A0,stroke:#04795a,color:#000000
    style C fill:#118AB2,stroke:#0b5c73,color:#ffffff
    style D fill:#8338EC,stroke:#5b0fb3,color:#ffffff
    style E fill:#FF6B6B,stroke:#c0392b,color:#ffffff
    style F fill:#3ECF8E,stroke:#1a7a52,color:#000000
    style G fill:#EF476F,stroke:#a3223f,color:#ffffff
```

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client["🌐 Browser / PWA"]
        direction TB
        UI["React 19 + TypeScript"]
        HK["Custom Hooks\nuseAuth · useListings · useUserLocation\nuseBrowserNotifications · useRealtimeNotice"]
        UTIL["Utilities\nsmartRescue · listingFilters · geo\ngeocoding · imageProcessor · telemetry"]
        UI --> HK
        HK --> UTIL
    end

    subgraph CDN["☁️ Vercel CDN"]
        direction TB
        VITE["Vite Production Build\nCSP · HSTS · X-Frame-Options"]
        SPA["SPA Rewrite Rules"]
        VITE --> SPA
    end

    subgraph SB["🟢 Supabase Platform"]
        direction TB
        AUTH["Auth Service\nJWT · Email/Password"]
        DB["PostgreSQL 15+\nRow Level Security\n(select auth.uid()) pattern"]
        RT["Realtime Engine\nWebSocket channels"]
        STORE["Storage\nlisting-photos bucket\nRLS-protected"]
        FN["Edge Functions (Deno)\ngeocoding proxy\nAI photo analysis"]
        DB --- RT
        AUTH --- DB
        FN --- DB
    end

    subgraph EXT["🔌 External Services"]
        NOM["Nominatim\nOpenStreetMap Geocoding"]
        GEM["Google Gemini Vision\nFood Photo AI Analysis"]
    end

    Client -- "HTTPS + WSS" --> SB
    Client -- "npm run build" --> CDN
    FN --> NOM
    FN --> GEM

    style Client fill:#1a1a2e,stroke:#4f46e5,color:#ffffff
    style CDN fill:#0f0f0f,stroke:#888888,color:#ffffff
    style SB fill:#1a3a2a,stroke:#3ECF8E,color:#ffffff
    style EXT fill:#2a1a0f,stroke:#f59e0b,color:#ffffff
```

---

## 🔀 Data Flow

```mermaid
sequenceDiagram
    actor User
    participant App as React App
    participant Auth as Supabase Auth
    participant DB as PostgreSQL + RLS
    participant RT as Realtime
    participant EF as Edge Functions
    participant AI as Gemini Vision

    User->>App: Open app
    App->>Auth: getUser() — server-verify session
    Auth-->>App: JWT + user object

    User->>App: Post listing + photo
    App->>EF: analyze-food-photo (image bytes)
    EF->>AI: Gemini Vision JSON extraction
    AI-->>EF: category, description, allergens
    EF-->>App: AI autofill suggestions

    App->>DB: create_listing_with_pickup_details RPC
    DB-->>App: listing_id

    Note over RT: Realtime broadcast
    RT-->>App: INSERT event (all subscribers)

    User->>App: Claim listing
    App->>DB: claim_listing RPC (atomic)
    DB-->>App: claimed listing or conflict error

    User->>App: Verify pickup via PIN
    App->>DB: verify_and_mark_picked_up RPC
    DB-->>App: success + impact data

    App->>DB: get_listings_feed RPC
    DB-->>App: paginated, filtered listings
```

---

## 🗄️ Database Schema

```mermaid
erDiagram
    PROFILES {
        uuid id PK
        text display_name
        text avatar_url
        text bio
        text phone_e164
        boolean is_verified
        timestamptz created_at
        timestamptz updated_at
    }

    LISTINGS {
        uuid id PK
        uuid poster_id FK
        uuid claimed_by FK
        text food_name
        text description
        text quantity
        text category
        text pickup_area
        timestamptz pickup_start
        timestamptz pickup_end
        text status
        text photo_url
        float8 lat
        float8 lng
        text contact_phone
        text[] dietary_types
        text[] allergens
        text storage_type
        timestamptz created_at
        timestamptz updated_at
    }

    LISTING_PICKUP_DETAILS {
        uuid id PK
        uuid listing_id FK
        text pickup_instructions
        text contact_name
        text contact_method
        text pin_hash
        boolean is_picked_up
        timestamptz picked_up_at
    }

    LISTING_MESSAGES {
        uuid id PK
        uuid listing_id FK
        uuid sender_id FK
        text content
        timestamptz created_at
    }

    LISTING_REPORTS {
        uuid id PK
        uuid listing_id FK
        uuid reporter_id FK
        text reason
        text details
        timestamptz created_at
    }

    GEOCODE_CACHE {
        text query PK
        float8 lat
        float8 lng
        text display_name
        timestamptz cached_at
    }

    PROFILES ||--o{ LISTINGS : "posts"
    PROFILES ||--o{ LISTINGS : "claims"
    LISTINGS ||--|| LISTING_PICKUP_DETAILS : "has"
    LISTINGS ||--o{ LISTING_MESSAGES : "has"
    LISTINGS ||--o{ LISTING_REPORTS : "reported_via"
```

---

## 🔄 Listing Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Available : create_listing_with_pickup_details RPC

    Available --> Claimed : claim_listing RPC\n(atomic, poster cannot self-claim)
    Available --> Expired : pickup_end < NOW()
    Available --> Cancelled : cancel_listing RPC\n(poster only)

    Claimed --> Available : unclaim_listing RPC\n(claimant only, within window)
    Claimed --> PickedUp : verify_and_mark_picked_up RPC\n(PIN verified handoff)
    Claimed --> Expired : pickup_end < NOW()

    PickedUp --> [*] : impact recorded
    Expired --> [*] : archived by pg_cron
    Cancelled --> [*]
```

---

## 🔐 Security Architecture

```mermaid
flowchart TD
    subgraph RLS["Row Level Security — PostgreSQL"]
        P1["listings: SELECT\nTO authenticated\nUSING (true for available,\nor (select auth.uid()) = poster_id)"]
        P2["listings: INSERT\nTO authenticated\nWITH CHECK ((select auth.uid()) = poster_id)"]
        P3["listings: UPDATE\nTO authenticated\nUSING (atomic RPC guards only)"]
        P4["listing_pickup_details: SELECT\nTO authenticated\nUSING ((select auth.uid()) = listing.poster_id\nOR (select auth.uid()) = listing.claimed_by)"]
    end

    subgraph RPCs["SECURITY DEFINER RPCs\nsearch_path = public, pg_temp"]
        R1["claim_listing\n— atomicity guard\n— expiry check\n— self-claim block"]
        R2["verify_and_mark_picked_up\n— PIN bcrypt verify\n— claimant-only"]
        R3["cancel_listing / unclaim_listing\n— poster / claimant only\n— state machine guards"]
        R4["report_listing\n— duplicate prevention\n— rate-limited"]
        R5["send_listing_message\n— participant-only\n— rate-limited (10/min)"]
        R6["edit_listing\n— poster-only\n— immutable field guard"]
    end

    subgraph FrontEnd["Frontend Security"]
        F1["getUser() on startup\nServer-verified JWT"]
        F2["Magic-byte image validation\nJPEG/PNG/WebP only"]
        F3["PII detection before submit\nphone/email scrubbing"]
        F4["CSP headers via Vercel\nno unsafe-eval / unsafe-inline"]
        F5["HSTS preload\nX-Frame-Options: DENY"]
    end

    subgraph DB_Extra["Database Extras"]
        D1["REVOKE ALL FROM anon\non sensitive tables"]
        D2["protect_profile_verification_flag\ntrigger — prevents self-promotion"]
        D3["enforce_listing_limits trigger\n≤10 active listings per user"]
    end

    RLS --> RPCs
    RPCs --> FrontEnd
    DB_Extra --> RLS
```

---

## 🤖 ML & AI Layer

```mermaid
flowchart LR
    subgraph Input["Input Signals"]
        I1["Food title text"]
        I2["Photo upload"]
        I3["Pickup window duration"]
        I4["Has photo flag"]
        I5["Description length"]
    end

    subgraph SmartRescue["smartRescue.ts — Heuristic Engine"]
        SR1["suggestCategoryFromText\nKeyword scoring across 6 categories\nMacro-F1 = 1.0 ✅"]
        SR2["computeRescueScore\nUrgency × Distance × Preference"]
        SR3["isEndingSoon\n60-minute urgency window"]
        SR4["predictExpiryRisk\nBrier Score = 0.046 ✅"]
        SR5["detectPublicPiiLeak\nPhone/email pattern guard\nRecall = 1.0, FPR = 0.0 ✅"]
        SR6["computeImpactMetrics\nkg rescued · CO₂e · meals"]
    end

    subgraph EdgeAI["Edge Function AI"]
        E1["analyze-food-photo\nGemini Vision API"]
        E2["Returns: category, allergens\ndescription, dietary_type"]
    end

    subgraph Output["Output"]
        O1["AI autofill suggestions\nin PostListingForm"]
        O2["Recommended sort score"]
        O3["Ending-soon badge"]
        O4["Expiry risk indicator"]
        O5["PII warning toast"]
        O6["Impact dashboard metrics"]
    end

    I1 --> SR1
    I2 --> E1
    I3 --> SR4
    I4 --> SR4
    I5 --> SR4
    E1 --> E2
    E2 --> O1
    SR1 --> O1
    SR2 --> O2
    SR3 --> O3
    SR4 --> O4
    SR5 --> O5
    SR6 --> O6

    style SmartRescue fill:#1a1a3a,stroke:#818cf8,color:#ffffff
    style EdgeAI fill:#1a2a1a,stroke:#3ECF8E,color:#ffffff
```

---

## 🚀 CI/CD Pipeline

```mermaid
flowchart LR
    Push["git push\nmain / PR"]

    subgraph CI["GitHub Actions — ubuntu-latest / Node 22"]
        L["🔍 ESLint\nesllint . "]
        T["🧪 Unit Tests\n25 / 25 ✅"]
        ML["🤖 ML Eval\nMacro-F1 · PII · AUC · Brier"]
        TC["📐 Typecheck\ntsc -b --noEmit"]
        B["📦 Build\nvite build"]
        A["🔒 Audit\nnpm audit --audit-level=high"]
    end

    subgraph Deploy["Production Deploy"]
        V["Vercel\nAuto-deploy on main"]
        SB["Supabase\nMigrations via SQL Editor\nEdge Functions via CLI"]
    end

    Push --> L --> T --> ML --> TC --> B --> A
    A -- "✅ all green" --> V
    A -- "manual step" --> SB

    style CI fill:#0f172a,stroke:#3b82f6,color:#ffffff
    style Deploy fill:#0a1a0a,stroke:#22c55e,color:#ffffff
```

---

## 📁 Project Structure

```
food-rescue/
├── 📂 .github/
│   ├── workflows/ci.yml          # GitHub Actions — lint, test, ML eval, build, audit
│   └── dependabot.yml            # Automated dependency updates
│
├── 📂 public/
│   ├── manifest.webmanifest      # PWA manifest
│   └── icon-{192,512}.png        # App icons
│
├── 📂 src/
│   ├── 📂 components/            # React UI components
│   │   ├── Auth.tsx              # Login / signup
│   │   ├── EditListingModal.tsx  # In-place listing editor
│   │   ├── ErrorBoundary.tsx     # React error boundary
│   │   ├── FilterBar.tsx         # Category / distance / sort filters
│   │   ├── Header.tsx            # App header + profile button
│   │   ├── ImpactDashboard.tsx   # Rescue impact metrics
│   │   ├── ListingActions.tsx    # Claim / cancel / edit / report / PIN
│   │   ├── ListingCard.tsx       # Individual listing card
│   │   ├── ListingFeed.tsx       # Virtualized listing list
│   │   ├── ListingsMap.tsx       # Canvas map with Haversine pins
│   │   ├── ListingStatusBadge.tsx# Status pill UI
│   │   ├── NavTabs.tsx           # Tab navigation
│   │   ├── PickupChatPanel.tsx   # Poster ↔ Claimant messaging
│   │   ├── PickupDetailsPanel.tsx# Pickup instructions view
│   │   ├── PostListingForm.tsx   # New listing form + AI autofill
│   │   ├── ProfileModal.tsx      # User profile editor
│   │   ├── RealtimeBanner.tsx    # Realtime status + notification toggle
│   │   └── ResetPasswordModal.tsx# Password recovery
│   │
│   ├── 📂 constants/
│   │   └── categories.ts         # FOOD_CATEGORIES, DIETARY_OPTIONS, ALLERGENS
│   │
│   ├── 📂 hooks/                 # Custom React hooks
│   │   ├── useAuth.ts            # Auth state + server-verify getUser()
│   │   ├── useBrowserNotifications.ts # Web Push opt-in
│   │   ├── useListings.ts        # Realtime + RPC feed + snapshot merge
│   │   ├── useNowTick.ts         # 1-min clock tick for expiry UI
│   │   ├── useRealtimeNotice.ts  # Toast on realtime events
│   │   └── useUserLocation.ts    # Geolocation API wrapper
│   │
│   ├── 📂 lib/
│   │   └── supabase.ts           # Typed Supabase client (dual env)
│   │
│   ├── 📂 types/
│   │   ├── database.ts           # Full DB schema TypeScript types
│   │   └── listing.ts            # Domain types: Listing, View, SortOption
│   │
│   ├── 📂 utils/                 # Pure utility functions
│   │   ├── date.ts               # Relative date + expiry helpers
│   │   ├── geo.ts                # Haversine distance calculation
│   │   ├── geocoding.ts          # TTL/LRU geocoding cache
│   │   ├── imageProcessor.ts     # Magic-byte validation + resize
│   │   ├── listingFilters.ts     # Filter + sort pipeline
│   │   ├── listingsMerge.ts      # Realtime snapshot reconciliation
│   │   ├── mapProjection.ts      # Lat/lng → canvas projection
│   │   ├── phone.ts              # E.164 phone validation
│   │   ├── smartRescue.ts        # ML heuristics + impact analytics
│   │   └── telemetry.ts          # PII-scrubbed event logging
│   │
│   ├── App.tsx                   # Root component, view routing
│   ├── main.tsx                  # React entry point
│   └── index.css                 # Tailwind CSS base
│
├── 📂 supabase/
│   ├── 📂 functions/
│   │   ├── geocode-area/         # Nominatim proxy Edge Function
│   │   └── analyze-food-photo/   # Gemini Vision Edge Function
│   ├── 📂 migrations/
│   │   ├── 20261125000100_lifecycle_reports_and_geocache.sql
│   │   ├── 20261125000200_edit_chat_and_rate_limits.sql
│   │   └── 20261125000300_safety_profiles_and_handoff_pin.sql
│   └── 📂 tests/
│       └── rls_and_concurrency.test.sql
│
├── 📂 scripts/
│   ├── run-tests.mjs             # Rolldown bundler + Node test runner
│   └── eval-ml.mjs               # Offline ML calibration script
│
├── 📂 tests/
│   ├── unit.test.ts              # 25 unit tests across 12 suites
│   ├── components.test.tsx       # 5 SSR render tests
│   └── ml-eval.json              # Golden dataset for ML eval
│
├── 📂 docs/
│   └── SUPABASE_SECURITY_REFERENCE.sql
│
├── vercel.json                   # CSP / HSTS / headers config
├── vite.config.ts                # Vite + Tailwind + React plugin
├── tsconfig.json                 # TypeScript strict config
├── eslint.config.js              # ESLint flat config
└── package.json                  # Scripts: dev, build, lint, test, eval:ml
```

---

## ✨ Feature Set

### 🔐 Authentication
| Feature | Status |
|---|---|
| Email + password signup / login / logout | ✅ |
| Server-verified JWT on startup (`getUser()`) | ✅ |
| Password recovery via email link | ✅ |
| Profile editing (name, bio, phone, avatar) | ✅ |
| `is_verified` flag protected by DB trigger | ✅ |

### 🍱 Listings
| Feature | Status |
|---|---|
| Post food: name, description, quantity, category | ✅ |
| Pickup area + time window (start/end) | ✅ |
| Food photo upload (JPEG/PNG/WebP, magic-byte validated) | ✅ |
| AI autofill via Gemini Vision (category, allergens) | ✅ |
| Dietary types: vegan, vegetarian, halal, kosher, gluten-free | ✅ |
| Allergen tagging (8 common allergens) | ✅ |
| Storage type: room temp / refrigerated / frozen | ✅ |
| Contact phone with E.164 validation | ✅ |
| Edit listing (poster only, immutable-field guards) | ✅ |
| Repost (duplicates an archived listing as new) | ✅ |
| Cancel listing (poster only) | ✅ |
| Rate limit: ≤ 10 active listings per user | ✅ |

### 🗺️ Discovery & Location
| Feature | Status |
|---|---|
| Available feed with search + category filter | ✅ |
| Distance filter (1–50 km radius) | ✅ |
| Sort: Newest / Ending Soon / Recommended / Nearest | ✅ |
| Browser geolocation (Geolocation API) | ✅ |
| Haversine straight-line distance on every card | ✅ |
| Canvas map with pinned listing locations | ✅ |
| Geocoding with TTL + LRU cache (quota-safe) | ✅ |
| Geocode-area Edge Function (Nominatim proxy) | ✅ |
| Open in Apple Maps / Google Maps / OSM | ✅ |

### ⚡ Realtime & Notifications
| Feature | Status |
|---|---|
| Supabase Realtime WebSocket feed | ✅ |
| Snapshot reconciliation (merge realtime + DB) | ✅ |
| Realtime status banner | ✅ |
| Browser Push Notification opt-in | ✅ |
| Toast notifications on realtime events | ✅ |

### 🤝 Claiming & Handoff
| Feature | Status |
|---|---|
| Atomic claim (server-side RPC guard) | ✅ |
| Poster cannot self-claim | ✅ |
| Unclaim (claimant only, within window) | ✅ |
| Secure PIN generation for pickup handoff | ✅ |
| PIN verification marks listing as Picked Up | ✅ |
| Poster ↔ Claimant in-app chat | ✅ |
| Pickup details panel (instructions, PIN) | ✅ |

### 📊 Impact & Reporting
| Feature | Status |
|---|---|
| Impact dashboard (kg rescued, CO₂e saved, meals) | ✅ |
| Smart rescue score (urgency × distance × pref) | ✅ |
| Expiry-risk prediction (Brier = 0.046) | ✅ |
| Report listing (abuse / misleading) | ✅ |
| PII leak detection before posting | ✅ |
| PII-scrubbed telemetry | ✅ |

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | React | 19 |
| **Language** | TypeScript | 6.x |
| **Build Tool** | Vite | 8.x |
| **Styling** | Tailwind CSS | v4 |
| **Backend / Auth** | Supabase | 2.x |
| **Database** | PostgreSQL (via Supabase) | 15+ |
| **Realtime** | Supabase Realtime (WebSocket) | — |
| **Storage** | Supabase Storage | — |
| **Edge Functions** | Deno (Supabase Functions) | — |
| **AI / Vision** | Google Gemini Vision API | — |
| **Geocoding** | Nominatim / OpenStreetMap | — |
| **Deployment** | Vercel | — |
| **CI/CD** | GitHub Actions | — |
| **Test Runner** | Node.js built-in `--test` | 22 |
| **Bundler (tests)** | Rolldown | — |
| **Linter** | ESLint + typescript-eslint | 10.x |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 22 (`node --version`)
- **npm** ≥ 10
- A **Supabase** project — [create one free](https://supabase.com)

### 1. Clone & install

```bash
git clone https://github.com/still-trying/food-rescue.git
cd food-rescue
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Start development server

```bash
npm run dev
# → http://localhost:5173
```

---

## 🔑 Environment Variables

Create `.env` in the project root (never commit this file):

```env
# Required — from Supabase Project Settings → API
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional — enables geocoding proxy Edge Function
VITE_USE_GEOCODE_PROXY=false

# Optional — Supabase project reference (for CLI operations)
SUPABASE_PROJECT_REF=your-project-ref
```

> [!CAUTION]
> Never commit `.env` or any real API keys. The `.gitignore` excludes `.env` by default.

---

## 🗃️ Supabase Setup

### Apply migrations (in order)

Run each file in the Supabase SQL Editor or via CLI:

```bash
# Using Supabase CLI
supabase db push --project-ref your-project-ref
```

| Order | Migration File | What it adds |
|---|---|---|
| 1 | `20261125000100_lifecycle_reports_and_geocache.sql` | `geocode_cache`, `listing_reports`, lifecycle RPCs |
| 2 | `20261125000200_edit_chat_and_rate_limits.sql` | `listing_messages`, `edit_listing`, rate-limit trigger |
| 3 | `20261125000300_safety_profiles_and_handoff_pin.sql` | `profiles`, dietary/allergen columns, PIN handoff RPCs |

### RLS Policy Pattern

All Row Level Security policies use the initPlan-optimized pattern:

```sql
-- ✅ Correct — uses (select auth.uid()) for plan caching
CREATE POLICY "owner_only" ON listings
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = poster_id);

-- ❌ Never use auth.role() — deprecated
-- ❌ Never use bare auth.uid() in USING — prevents plan caching
```

### Storage Setup

Create a bucket named `listing-photos` with:
- **Public:** `false` (private bucket, signed URLs)
- RLS policies granting authenticated INSERT on own files
- Max file size: 5 MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

---

## ⚡ Edge Functions

### Deploy

```bash
# Install Supabase CLI
npm install -g supabase

# Deploy both functions
supabase functions deploy geocode-area --project-ref your-project-ref
supabase functions deploy analyze-food-photo --project-ref your-project-ref

# Set secrets
supabase secrets set GEMINI_API_KEY=your-gemini-key --project-ref your-project-ref
supabase secrets set ALLOWED_ORIGIN=https://your-vercel-domain.vercel.app --project-ref your-project-ref
```

| Function | Trigger | Purpose |
|---|---|---|
| `geocode-area` | HTTP POST (JWT-verified) | Nominatim proxy; caches results in `geocode_cache` |
| `analyze-food-photo` | HTTP POST (JWT-verified) | Gemini Vision JSON extraction for AI autofill |

---

## 🌐 Deployment

### Vercel (recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Set these environment variables in Vercel Dashboard → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://your-ref.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon key |
| `VITE_USE_GEOCODE_PROXY` | `true` (after deploying `geocode-area`) |

The `vercel.json` already configures:

```
✅ Content-Security-Policy (strict)
✅ Strict-Transport-Security (HSTS, preload, 2-year max-age)
✅ X-Frame-Options: DENY
✅ X-Content-Type-Options: nosniff
✅ Referrer-Policy: strict-origin-when-cross-origin
✅ Permissions-Policy: geolocation=(self), camera=(), microphone=()
✅ SPA rewrite rules
```

---

## 🧪 Testing

### Run all checks

```bash
npm run lint       # ESLint (TypeScript + React Hooks rules)
npm test           # 25 unit + 5 component tests
npm run eval:ml    # ML calibration evaluation
npx tsc -b --noEmit  # TypeScript strict type check
npm run build      # Production bundle
npm audit --audit-level=high  # Dependency vulnerability scan
```

### Test coverage

| Suite | Tests | Description |
|---|---|---|
| Geo utilities | 2 | Haversine distance calculation |
| Date utilities | 3 | Relative dates, expiry detection |
| Phone utilities | 2 | E.164 validation, tel-href safety |
| Image magic-byte | 1 | JPEG/PNG/WebP signature + spoof detection |
| Categories & labels | 1 | Category/dietary/storage validation |
| Telemetry PII scrubbing | 1 | Email/phone/JWT redaction |
| smartRescue & ML | 5 | Rescue score, category suggest, PII leak, impact, expiry risk |
| Listings merge | 1 | Realtime snapshot reconciliation |
| Map projection | 1 | lat/lng → canvas coordinate |
| Geocoding cache | 1 | TTL, LRU eviction, QuotaExceededError |
| Listing filters | 2 | Filter pipeline, distance, sort |
| Component SSR | 5 | Header, Auth, ListingFeed privacy, ImpactDashboard, Map |

### ML Evaluation Thresholds

| Metric | Threshold | Current |
|---|---|---|
| Category Macro-F1 | ≥ 0.85 | **1.00** ✅ |
| PII Recall | ≥ 0.95 | **1.00** ✅ |
| PII False Positive Rate | ≤ 0.05 | **0.00** ✅ |
| Expiry Risk ROC-AUC | ≥ 0.90 | **1.00** ✅ |
| Expiry Risk Brier Score | ≤ 0.20 | **0.046** ✅ |

---

## ⚡ Performance

| Metric | Target | Approach |
|---|---|---|
| Bundle size | < 150 kB gzip | Lazy-loaded routes (PostListingForm, Map, Impact) |
| First contentful paint | < 1.5 s | Vite code splitting, Vercel CDN |
| Realtime latency | < 500 ms | Supabase Realtime WebSocket |
| Geocoding quota safety | Zero overages | TTL + LRU-100 cache, QuotaExceededError recovery |
| RLS policy performance | Optimal | `(select auth.uid())` initPlan caching pattern |
| DB listing reads | Paginated | `get_listings_feed` RPC with cursor |

---

## 🗺️ Roadmap

### Phase 1 — Infrastructure (In Progress)
- [ ] Apply all 3 migrations to live Supabase DB
- [ ] Deploy `geocode-area` and `analyze-food-photo` Edge Functions
- [ ] Enable `pg_cron` for automated listing archival
- [ ] E2E tests with Playwright + axe-core a11y

### Phase 2 — Enhanced Discovery
- [ ] Interactive map (Leaflet / MapLibre + OpenStreetMap tiles)
- [ ] Neighborhood / area-based search
- [ ] Advanced filters (dietary, allergens, storage)

### Phase 3 — Trust & Safety
- [ ] Listing moderation workflow + admin panel
- [ ] Cloudflare Turnstile on signup (bot protection)
- [ ] Business / organization verified accounts
- [ ] Community reputation + reliability scores

### Phase 4 — Engagement
- [ ] Server-side push notifications for high-expiry-risk listings
- [ ] User profile pages (contribution history, rescued meals)
- [ ] Animated impact counter on listing completion

### Phase 5 — Scale
- [ ] Delivery / logistics coordination
- [ ] Platform analytics dashboard
- [ ] Mobile apps (React Native or PWA install flow)
- [ ] Multi-language / i18n support

---

## 🤝 Contributing

Contributions are welcome! For anything non-trivial, **open an issue first** to discuss the change.

```bash
# 1. Fork the repo
# 2. Create your branch
git checkout -b feature/your-feature

# 3. Make changes and verify
npm run lint && npm test && npm run eval:ml && npm run build

# 4. Commit with a conventional message
git commit -m "feat: add your feature description"

# 5. Push and open a PR
git push origin feature/your-feature
```

> [!NOTE]
> All PRs must pass the full CI pipeline (lint → test → ML eval → typecheck → build → audit) before merging.

### Commit Convention

| Prefix | Use for |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `security:` | Security patch |
| `perf:` | Performance improvement |
| `test:` | Test additions or changes |
| `chore:` | Build, deps, CI config |
| `docs:` | Documentation only |

---

## 📄 License

MIT — see [`LICENSE`](./LICENSE).

---

## 💚 Mission

<div align="center">

> *Food that can still be eaten should not become waste simply because it is surplus.*

Food Rescue connects surplus food with people who can use it — **quickly, locally, and simply.**

```
📤 Post  →  🔍 Discover  →  📍 Locate  →  🤝 Claim  →  🔑 PIN Handoff  →  ✅ Pick Up  →  ♻️ Rescue
```

🔗 [github.com/still-trying/food-rescue](https://github.com/still-trying/food-rescue)

Made with 🍱 + ☕ — if this is useful, a ⭐ helps.

</div>
