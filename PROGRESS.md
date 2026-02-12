# EPRO Quotation System — Progress Report

**Last updated:** 2026-02-12

---

## Completed Sprints

### Sprint 1 — Foundation
- Express + SQLite server with JWT auth (bcrypt)
- 15+ database tables (products, clients, quotes, quote_bom_items, quote_flags, etc.)
- Product CRUD API + seeded 40+ Victron/solar products
- Pricing engine (pricing_factor, VAT, line totals)
- HTM price list parser for bulk product import
- React + Mantine frontend: Login, Dashboard, Products, Pricing, Users pages

### Sprint 2 — Panels & Components
- Panel import with PDF datasheet upload (OCR via Tesseract.js)
- Voc/Imp validation against Victron MPPT specs
- Panel approval workflow (pending → approved/rejected)
- Extended component tables: inverters, MPPTs, batteries
- Admin Components page for managing inverters, MPPTs, batteries

### Sprint 3 — Rule Engine & BoM
- Victron rule engine with 8 modules:
  - `system-class.engine.ts` — inverter selection by system class
  - `pv-string.engine.ts` — string calculator, panel/cable/connector items
  - `dc-battery.engine.ts` — battery cable sizing from rule table
  - `dc-protection.engine.ts` — fuses, isolators, surge protection
  - `ac-cable.engine.ts` — AC cable sizing from rule table
  - `ac-protection.engine.ts` — breakers, earth leakage from rule table
  - `mounting.engine.ts` — roof rails, clamps, brackets from rule table
  - `labour.engine.ts` — installation labour + travel from rule table
- 5 rule tables with admin management UI (dc_battery, ac_cable, ac_protection, labour, mounting)
- BoM generation: rule engine → priced line items → stored in quote_bom_items
- Quotes + Clients CRUD API
- Quotes list page with status filter

### Sprint 4 — Quote Wizard + PDF Output ✅ (Completed 2026-02-08)
- **QuoteWizardPage** (`client/src/pages/quotes/QuoteWizardPage.tsx`)
  - 5-step Mantine Stepper: Client → System Class → Components → Installation → Review
  - Step 1: Select existing client (searchable) or create new inline
  - Step 2: Radio group for V5/V8/V10/V15 with auto inverter info display
  - Step 3: Panel + Battery + MPPT selection with quantity inputs, specs shown inline
  - Step 4: Cable distances (DC battery, AC inv-DB, AC DB-grid, PV string) + travel + notes
  - Step 5: Full BoM review grouped by 11 sections, flags/warnings, pricing summary
  - Supports create (`/quotes/new`) and edit (`/quotes/:id/edit`) modes
  - "Download PDF" and "Finalize" (sets status to `review`) buttons

- **QuoteDetailPage** (`client/src/pages/quotes/QuoteDetailPage.tsx`)
  - Read-only view with client info, system config, full BoM table
  - Section subtotals, pricing summary (subtotal, VAT 15%, total in ZAR)
  - Flags/warnings display
  - Actions: Download PDF, Edit (draft/review only), Approve, Mark Sent

- **PDF Generator** (`server/src/services/pdf-generator.ts`)
  - PDFKit A4 layout with company header ("Electrical Pro")
  - Client block, system summary, BoM table grouped by section
  - Totals: subtotal, VAT, total in ZAR currency format
  - Disclaimer, page numbers, footer on every page
  - Endpoint: `GET /api/v1/quotes/:id/pdf` → downloads `EPQ-YYYY-NNNN.pdf`

- **Routes wired in App.tsx:**
  - `/quotes/new` → QuoteWizardPage
  - `/quotes/:id` → QuoteDetailPage
  - `/quotes/:id/edit` → QuoteWizardPage (edit mode)

- **Client API addition:** `downloadQuotePdf(quoteId)` in `quotes.api.ts`

---

## How to Start the App

```bash
# Kill any old server on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Start server (serves both API and built client)
cd EPRO-Quotation-System/server
npx ts-node src/index.ts

# If client needs rebuilding:
cd EPRO-Quotation-System/client
npm run build
```

**Access:** http://localhost:3000
**Login:** admin / changeme

---

## Key Architecture

```
EPRO-Quotation-System/
├── client/                    # React 18 + Vite + Mantine v7
│   └── src/
│       ├── api/               # Axios API functions
│       │   ├── client.ts      # Axios instance with JWT interceptor
│       │   ├── quotes.api.ts  # Quotes, clients, BoM, PDF download
│       │   ├── panels.api.ts  # Panel CRUD + validation
│       │   ├── components.api.ts  # Inverters, MPPTs, batteries, MPPT recommend
│       │   └── tools.api.ts       # Bracket calculator API         ← Sprint 5a
│       ├── pages/
│       │   ├── quotes/
│       │   │   ├── QuotesListPage.tsx
│       │   │   ├── QuoteWizardPage.tsx    ← Sprint 4 + 5a updates
│       │   │   └── QuoteDetailPage.tsx    ← Sprint 4
│       │   ├── tools/
│       │   │   └── BracketCalculatorPage.tsx  ← Sprint 5a
│       │   ├── admin/         # Products, Panels, Components, Rules, Pricing, Users
│       │   ├── DashboardPage.tsx
│       │   └── LoginPage.tsx
│       └── App.tsx            # Route definitions
│
├── server/                    # Node.js + Express + TypeScript
│   └── src/
│       ├── routes/
│       │   ├── quotes.routes.ts   # Quotes CRUD + BoM + PDF endpoint
│       │   ├── auth.routes.ts
│       │   ├── products.routes.ts
│       │   ├── panels.routes.ts
│       │   ├── components.routes.ts  # + MPPT recommend endpoint   ← Sprint 5a
│       │   ├── tools.routes.ts       # Bracket calculator endpoint ← Sprint 5a
│       │   └── admin.routes.ts
│       ├── services/
│       │   ├── pdf-generator.ts       ← Sprint 4
│       │   ├── pricing.service.ts
│       │   ├── design-assistant.ts    # MPPT auto-suggestion       ← Sprint 5a
│       │   └── rule-engine/           # 8 engine modules + types
│       ├── database/
│       │   ├── connection.ts          # SQLite (better-sqlite3, WAL)
│       │   ├── migrate.ts            # Schema + seeds (001–005)
│       └── index.ts                   # Express app entry
│
└── data/                      # SQLite DB file
```

## Rule Engine Sections (11 total)
`inverter`, `solar_panels`, `battery`, `dc_battery`, `pv_cabling`, `pv_dc_protection`, `ac_cabling`, `ac_protection`, `mounting`, `labour`, `travel`

## Test Data
- 1 client: "Test Client" (0821234567, test@example.com)
- 1 quote: EPQ-2026-0001 — V10, 12 panels (3 strings of 4), 1 battery, 2 MPPTs
- 38 BoM items, R136,491.28 total
- 4 inverters (V5/V8/V10/V15), 3 MPPTs, 1 battery, 1 approved panel

### Sprint 5a — Bracket Calculator & Mounting Engine Overhaul ✅ (Completed 2026-02-10)

- **Bracket Calculator Tool** (`client/src/pages/tools/BracketCalculatorPage.tsx`)
  - Standalone mounting hardware estimator — no quote needed
  - SegmentedControl for 4 mounting types: IBR, Corrugated, Tile, Tilt Frame
  - Tilt Frame shows sub-selector for IBR/Corrugated roof type
  - Panel source: Database (searchable approved panels) or Manual (width in mm)
  - Rows × Columns layout input with computed panel quantity
  - Results table: product, SKU, qty, unit price, line total, grand total (excl. VAT)
  - Flags/warnings displayed as Alert components

- **Mounting Engine Rewrite** (`server/src/services/rule-engine/mounting.engine.ts`)
  - Corrected formulas for all 5 mounting types:
    - **IBR/Corrugated:** Panels landscape, mounting lines = rows+1. Outer 2 lines → end clamps (2 per panel per line), inner lines → mid clamps (2 per panel per line), 1 bracket per clamp (IBR or corrugated)
    - **Tile:** Panels portrait, independent rails per row (2 × rows). End clamps at rail ends (2 per rail), mid clamps between panels along rail ((cols-1) per rail). Rails optimized with offcut reuse. Hanger bolts at 1,450mm spacing
    - **Tilt Frame (IBR/Corrugated):** Each panel independent — 2 front short + 2 rear long brackets + 4 tilt ends + 4 IBR or corrugated roof brackets per panel
  - New products seeded: SOLAR45 (IBR bracket), SOLAR46 (corrugated bracket), SOLAR50 (front short tilt), SOLAR51 (rear long tilt), SOLAR52 (tilt ends)

- **Tools API** (`server/src/routes/tools.routes.ts`)
  - `POST /api/v1/tools/mounting-calculate` — auth-protected, read-only
  - Accepts panel_id or manual width_mm, mounting type, rows, cols
  - Returns enriched items with prices + flags + grand total

- **MPPT Design Assistant** (`server/src/services/design-assistant.ts`)
  - `GET /api/v1/components/mppts/recommend?panel_id=X&panel_qty=Y`
  - Calculates optimal MPPT configurations based on cold Voc, string voltage limits, current limits, and capacity scoring
  - Returns top 3 recommendations with warnings and utilization %
  - Auto-fills MPPT selection in Quote Wizard (Step 3) with debounced 500ms trigger

- **Quote Wizard Updates** (`client/src/pages/quotes/QuoteWizardPage.tsx`)
  - Step 4: Mounting type selector with tilt frame sub-selector (IBR/Corrugated)
  - Step 3: MPPT auto-recommendation alert with manual override indicator
  - Mounting type, rows, cols saved to quote and passed to BoM generation

- **DB Migration 005** — Added `mounting_type`, `mounting_rows`, `mounting_cols` columns to quotes table

- **Navigation** — Added "Tools" section in sidebar with Bracket Calculator link (visible to all users)

### Sprint 5b — Refactoring & Grid Editor (2026-02-12)

- **Bracket Calculator Grid Editor** (`client/src/pages/tools/BracketCalculatorPage.tsx`)
  - Replaced rows/cols numeric inputs with interactive 10x15 clickable grid
  - Click or drag to toggle panel positions — supports irregular layouts natively
  - Panel cells styled to look like solar panels (portrait vs landscape orientations)
  - Row/column numbering on grid axes
  - Multi-array support: add, duplicate, remove arrays (up to 10)
  - **Global Settings card** — shared mounting type, orientation, roof type, panel source
  - Array cards show only label + grid (compact); "Custom settings" toggle for per-array overrides
  - Smart array naming: reuses lowest available number when arrays are deleted
  - Summary card shows per-array breakdown: rows, column span, panel count, row counts list
  - Tilt Frame mode uses rows/cols inputs (rectangular by nature)
  - Uses `calculateMountingIrregular` API with `row_columns` for position-aware calculations
  - Combined BoM across all arrays with per-group breakdowns

- **Position-Aware Clamp Calculation** (`server/src/services/rule-engine/mounting.engine.ts`)
  - Fixed incorrect end/mid clamp counts for shifted/staggered panel rows
  - Client sends `row_columns` (active column indices per row) alongside `row_counts`
  - Server computes column-by-column overlap between adjacent rows using Set intersection
  - Panels at same column in adjacent rows → mid clamp; unmatched positions → end clamp
  - Falls back to count-based formula when `row_columns` not provided (backward compatible)
  - Column span display: shows actual grid span (e.g., 9 cols) instead of max panels per row

- **Quote Wizard Refactor** (`client/src/pages/quotes/QuoteWizardPage.tsx`)
  - Migrated to Mantine `useForm` hook for centralized form state and validation
  - Added `useWindowEvent('beforeunload')` — warns before closing unsaved changes
  - Extracted constants: `SECTION_ORDER`, `SECTION_LABELS`, `MOUNTING_LABELS`
  - Added `extractError()` helper for better API error messages (401, 404, 400 handling)
  - Per-step field validation via `STEP_FIELDS` map
  - Dynamic step descriptions showing selected client, system class, panel info, totals

- **MPPT Design Assistant Improvements** (`server/src/services/design-assistant.ts`)
  - Changed from "1 string per MPPT" to "multiple parallel strings per MPPT" model
  - Victron SmartSolar supports ~150% PV oversizing — `stringsPerMppt` now calculated
  - Improved scoring: penalizes excessive MPPTs, rewards 80-120% utilization
  - Better oversize warnings at >120% and >130% thresholds

- **Photo-Based Panel Layout Analyzer** (Gemini AI integration)
  - `POST /api/v1/tools/mounting-analyze-photo` — upload aerial/roof photo
  - Gemini 2.5 Flash vision model detects panel arrays and counts per-row
  - Returns structured JSON: groups with labels and row counts
  - Photo analysis results can feed directly into irregular mounting calculator

---

## What's Next (Potential Sprint 5+ Ideas)
- Quote versioning (snapshot BoM on each change)
- Email quote PDF to client
- Dashboard stats (quotes by status, revenue pipeline)
- Multi-user support with role-based access (sales vs admin views)
- Quote templates / clone existing quote
- Inventory tracking / stock availability
- Customer portal (read-only quote view via shared link)
- Export quotes to CSV/Excel
