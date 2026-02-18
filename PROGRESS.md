# EPRO Quotation System — Progress Report

**Last updated:** 2026-02-18

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
  - Actions: Download PDF, Edit (draft/review only), Approve, Mark Sent, Clone

- **PDF Generator** (`server/src/services/pdf-generator.ts`)
  - PDFKit A4 layout with company header ("Electrical Pro")
  - Client block, system summary, BoM table grouped by section
  - Totals: subtotal, VAT, total in ZAR currency format
  - Disclaimer, page numbers, footer on every page
  - Endpoint: `GET /api/v1/quotes/:id/pdf` → downloads `EPQ-YYYY-NNNN.pdf`

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
  - Corrected formulas for all 5 mounting types (IBR, Corrugated, Tile, Tilt Frame IBR/Corrugated)

- **MPPT Design Assistant** (`server/src/services/design-assistant.ts`)
  - `GET /api/v1/components/mppts/recommend?panel_id=X&panel_qty=Y`
  - Auto-fills MPPT selection in Quote Wizard Step 3

### Sprint 5b — Refactoring & Grid Editor ✅ (Completed 2026-02-12)

- **Bracket Calculator Grid Editor** — interactive 10x15 clickable grid, multi-array support
- **Position-Aware Clamp Calculation** — column-by-column overlap between adjacent rows
- **Quote Wizard Refactor** — Mantine `useForm`, beforeunload guard, per-step validation
- **MPPT Design Assistant Improvements** — multiple parallel strings per MPPT model
- **Photo-Based Panel Layout Analyzer** — Gemini 2.5 Flash vision for aerial photo analysis

### Sprint 5c — Dashboard Visual Overhaul ✅ (Completed 2026-02-13)

- Gradient accent stat cards, Quote Pipeline progress bar, RingProgress for system classes
- Revenue by System Class chart, improved Recent Quotes table, skeleton loading

### Sprint 6 — Node-Based Solar System Designer ✅ (Completed 2026-02-15)

**Goal:** Replace the linear 5-step wizard with a visual node-based designer (like n8n) that supports multiple inverter brands. Components are draggable nodes, wiring is edges with auto-calculated cable specs.

#### Sprint 6a — Canvas Foundation + DB Schema
- **Migration 006** (`server/src/database/migrations/006_node_designer.ts`)
  - Recreated `inverters` table with `brand`, `has_mppt`, `has_battery_port`, `max_pv_input_w` columns
  - Added `brand` column to `mppts`, `batteries`, `products` tables
  - Relaxed `quotes` table: removed `system_class` CHECK constraint, added `design_mode` ('wizard' | 'designer')
  - Created `quote_designs` table (stores React Flow graph JSON per quote)
- **6 Custom React Flow Nodes:**
  - `SolarPanelArrayNode` — panel model + qty, `dc-pv-out` handle
  - `InverterNode` — brand-aware conditional ports (Victron: MPPT+battery+AC; integrated MPPT brands: PV-in+battery+AC)
  - `MpptNode` — `pv-in` + `dc-out` handles
  - `BatteryNode` — `dc-out` handle
  - `DistributionBoardNode` — `ac-in` + `ac-grid-out`
  - `GridConnectionNode` — `ac-in`
- **ComponentPalette** — left sidebar with draggable node cards grouped by category
- **NodeConfigPanel** — right sidebar with dynamic forms per node type (brand→model cascading select)
- **DesignerCanvas** — React Flow wrapper with drag-drop, snap grid, minimap, connection validation
- **SystemDesignerPage** — 3-panel layout: palette | canvas | config tabs (Config/Settings/BoM)
- **API endpoints:** design save/load (`POST/GET /api/v1/quotes/:id/design`), brand-filtered components

#### Sprint 6b — Connections & Auto Wire Calculation
- **WiringEdge** — custom edge with color-coded path, distance popover (NumberInput), debounced wire gauge calculation
- **Connection validation matrix** — typed handle compatibility (pv-dc, mppt-dc, battery-dc, ac-power, ac-grid)
- **Wire calculation endpoint** (`POST /api/v1/design/calculate-wire`) — reuses existing engine modules

#### Sprint 6c — Protection, BoM Generation & Side Panels
- **Graph-to-BoM Generator** (`server/src/services/graph-bom-generator.ts`)
  - Traverses design graph nodes/edges → calls existing engine modules
  - Handles integrated MPPT by creating synthetic MpptData from inverter specs
  - Auto-inserts DC/AC protection based on connections
- **System Accessories Engine** (`server/src/services/rule-engine/system-accessories.engine.ts`)
  - Brand-aware: Victron gets VE Direct + RJ45 + GX Cerbo; other brands use default/warning
- **MountingSidePanel**, **LabourTravelPanel** — settings tab forms
- **BomPreviewPanel** — collapsible BoM grouped by section, flags, totals, Generate/Finalize/PDF buttons

#### Sprint 6d — Integration & Polish
- **QuotesListPage** — brand colors for system classes, "New Design" button, Mode column (Design vs Wizard)
- **QuoteDetailPage** — `design_mode`-aware Edit routing, Designer badge
- **DashboardPage** — system class colors, "New Quote" routes to designer
- **PDF Generator** — brand-aware system label in header + summary, conditional battery/MPPT display
- **Clone** — copies `quote_designs` graph + BoM items for designer-mode quotes
- **Bug fixes:**
  - Fixed SQLite FK references to `quotes_backup` (caused by `ALTER TABLE RENAME` updating FKs in dependent tables)
  - Removed non-existent `mounting_type`/`mounting_rows`/`mounting_cols` columns from clone + generate-bom endpoints

**New dependency:** `@xyflow/react` v12 (React Flow)

### Sprint 7 — Schema Improvements ✅ (Completed 2026-02-16)

**Goal:** Add multi-MPPT support, fix Freedom battery brand, add P/W25 cable product.

#### Migration 009 — Schema & Data Fixes
- **Freedom battery brand fix:** Corrected from "Victron" to "FreedomWON"
- **New P/W25 product:** 25mm² 4-core PVC/PVC cable for high-current systems
- **New `mppt_count` column** on inverters table (defaults to 1)

#### Multi-MPPT Support
- `graph-bom-generator.ts` now uses `mpptCount` from inverter data (not hardcoded 1)
- `components.routes.ts` returns `mppt_count` via `i.*` select
- **NodeConfigPanel:** Passes `mppt_count` from inverter data for multi-MPPT string splitting

> **Note:** Atess/Sungrow component data that was added in the original Sprint 7 was removed in Sprint 8. See Sprint 8 for details.

### Sprint 8 — Remove Atess & Sungrow Data ✅ (Completed 2026-02-17)

**Goal:** Remove all Atess and Sungrow product/component data so brands can be re-added later with real datasheets. The multi-brand architecture (brand columns, topology system, designer, graph-to-BoM) stays intact.

#### Migrations
- **Migration 010** (`010_remove_atess_sungrow_data.ts`) — FK-safe deletion of all Atess/Sungrow data from existing databases:
  - Quotes with Atess/Sungrow system_class or brand (+ bom_items, designs, flags, versions)
  - Rule entries for ATT5, ATT10, SG5, SG8, SG10, SG10RT
  - Inverters for those system classes
  - Batteries with brand 'Atess' or 'Sungrow'
  - Products with brand 'Atess' or 'Sungrow'
- **Migration 011** (`011_cleanup_atess_sungrow_quotes.ts`) — Catches quotes with `system_class='V10'` but `brand='Atess'/'Sungrow'` (test quotes missed by 010's system_class filter)
- **Migration 006 cleaned** — Removed Atess/Sungrow product/inverter/battery/rule seeding (lines 205-406)
- **Migration 009 cleaned** — Stripped to only: FreedomWON brand fix, P/W25 cable product, mppt_count column

#### Server Service Cleanup
- `voltage-drop-calculator.ts` — Removed 6 Atess/Sungrow entries from SYSTEM_CURRENTS (kept V5-V15)
- `system-accessories.engine.ts` — Removed `case 'Atess'` and `case 'Sungrow'` blocks (kept Victron + default)
- `graph-bom-generator.ts` — Updated comment from "Integrated MPPT (Sungrow/Atess)" to "Integrated MPPT"

#### Client Cleanup
- `brandTopology.ts` — `BrandKey = 'Victron'`, removed Atess/Sungrow topologies, `BRAND_OPTIONS = ['Victron']`
- `InverterNode.tsx` — Removed Atess/Sungrow brand colors, simplified badge logic
- `DashboardPage.tsx` — Removed ATT5/ATT10/SG5/SG8/SG10/SG10RT from CLASS_COLORS
- `QuotesListPage.tsx`, `QuoteDetailPage.tsx` — Removed Atess/Sungrow from classColor maps
- `NodeConfigPanel.tsx`, `SystemDesignerPage.tsx` — Simplified brand badge to Victron/gray

#### What's Preserved (for future brand re-addition)
- `brand` column on quotes, inverters, batteries, mppts, products tables
- `has_mppt`, `has_battery_port`, `max_pv_input_w`, `mppt_count` columns on inverters
- `quote_designs` table and graph-to-BoM generator with integrated MPPT support
- Brand topology architecture in `brandTopology.ts` (just add new entries)
- Connection validation matrix supporting integrated MPPT topologies
- P/W25 25mm cable product (useful for high-current systems)

### Sprint 9 — Re-add Atess HPS with Commercial Rules ✅ (Completed 2026-02-18)

**Goal:** Re-add Atess HPS inverters (5 models) with FreedomWON HV batteries and full 3-phase commercial rule tables. Brand-aware RCD selection.

#### Migration 012 — Seed Atess HPS Data
- **5 Atess HPS Inverters:** HPS30 (30kW, 2 MPPT), HPS50 (50kW, 4 MPPT), HPS100 (100kW, 6 MPPT), HPS120 (120kW, 8 MPPT), HPS150 (150kW, 10 MPPT)
  - All 400V 3-phase, 1000V max DC, integrated MPPT + battery port
- **5 FreedomWON LiTE Commercial HV Batteries:** 100/200/300/400/500 kWh at 512V
- **Commercial cable & protection products:** welding cables (50-185mm), 4-core panel wires (70-150mm), 3-pole breakers (63-250A), MCCB breakers, motorised changeover switch, 3P+N surge arrestor, HV DC fuses, 4P RCD
- **Rule table entries for all 5 system classes (ATT30–ATT150):**
  - DC battery cable rules (35mm→2x185mm parallel by system class)
  - AC cable rules (10mm→150mm 4-core 3-phase by system class)
  - AC protection rules (3-pole breakers, changeover switch, surge arrestor)
  - Labour rules (16–56 base hours, programming hours, commercial adders)
- **FreedomWON 15kWh battery brand fix** (set to 'Victron' for brand filtering)

#### Server Service Updates
- **`voltage-drop-calculator.ts`** — Added ATT30–ATT150 system currents (400V, 93–467A DC battery) + larger gauge wires (120–240mm²)
- **`system-accessories.engine.ts`** — Added `case 'Atess'` for CAN/RS485 communication cable
- **`graph-bom-generator.ts`** — Brand-aware RCD: 4P 63A 30mA for Atess 3-phase, 2P 40A 30mA for Victron

#### Client Updates
- **`brandTopology.ts`** — Added Atess HPS topology (integrated MPPT, 400V 3-phase, Panel→Inverter←Battery flow)
- **`InverterNode.tsx`** — Atess orange brand color (#e8590c)
- **`NodeConfigPanel.tsx`** — Atess orange badge in inverter config
- **`SystemDesignerPage.tsx`** — Add Client modal (inline create), Atess brand badge color
- **`DashboardPage.tsx`** — ATT30–ATT150 class colors
- **`QuotesListPage.tsx`** — ATT30–ATT150 class colors
- **`QuoteDetailPage.tsx`** — ATT30–ATT150 class colors

---

## How to Start the App

```bash
# Kill any old server on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# If client needs rebuilding:
cd EPRO-Quotation-System/client
npm run build

# Start server (serves both API and built client)
cd EPRO-Quotation-System/server
npx ts-node src/index.ts
```

**Access:** http://localhost:3000
**Login:** admin / changeme

---

## Key Architecture

```
EPRO-Quotation-System/
├── client/                    # React 18 + Vite + Mantine v7 + React Flow v12
│   └── src/
│       ├── api/               # Axios API functions
│       │   ├── client.ts      # Axios instance with JWT interceptor
│       │   ├── quotes.api.ts  # Quotes, clients, BoM, PDF, design save/load
│       │   ├── panels.api.ts  # Panel CRUD + validation
│       │   ├── components.api.ts  # Inverters, MPPTs, batteries (brand-filtered)
│       │   └── tools.api.ts       # Bracket calculator API
│       ├── pages/
│       │   ├── quotes/
│       │   │   ├── QuotesListPage.tsx      # Quote list + brand/mode columns
│       │   │   ├── QuoteWizardPage.tsx     # Legacy 5-step wizard (Victron)
│       │   │   ├── QuoteDetailPage.tsx     # Quote detail + mode-aware actions
│       │   │   └── SystemDesignerPage.tsx  # Node-based designer (all brands)
│       │   ├── tools/
│       │   │   └── BracketCalculatorPage.tsx
│       │   ├── admin/         # Products, Panels, Components, Rules, Pricing, Users
│       │   ├── DashboardPage.tsx
│       │   └── LoginPage.tsx
│       ├── components/
│       │   └── designer/      # Node-based designer components
│       │       ├── DesignerCanvas.tsx
│       │       ├── nodes/     # 6 custom node types + nodeTypes.ts registry
│       │       ├── edges/     # WiringEdge + edgeTypes.ts registry
│       │       ├── panels/    # ComponentPalette, NodeConfigPanel, MountingSidePanel,
│       │       │              # LabourTravelPanel, BomPreviewPanel
│       │       └── utils/     # connectionRules.ts (handle compatibility)
│       └── App.tsx            # Route definitions
│
├── server/                    # Node.js + Express + TypeScript
│   └── src/
│       ├── routes/
│       │   ├── quotes.routes.ts      # Quotes CRUD + BoM + PDF + design endpoints
│       │   ├── design.routes.ts      # Wire calculation endpoint
│       │   ├── components.routes.ts  # Brand-filtered component listing
│       │   ├── auth.routes.ts
│       │   ├── products.routes.ts
│       │   ├── panels.routes.ts
│       │   ├── tools.routes.ts
│       │   └── admin.routes.ts
│       ├── services/
│       │   ├── pdf-generator.ts           # Brand-aware PDF generation
│       │   ├── graph-bom-generator.ts     # Design graph → BoM (all brands)
│       │   ├── pricing.service.ts
│       │   ├── design-assistant.ts        # MPPT auto-suggestion
│       │   └── rule-engine/               # 9 engine modules + types
│       │       ├── system-class.engine.ts
│       │       ├── pv-string.engine.ts
│       │       ├── dc-battery.engine.ts
│       │       ├── dc-protection.engine.ts
│       │       ├── ac-cable.engine.ts
│       │       ├── ac-protection.engine.ts
│       │       ├── mounting.engine.ts
│       │       ├── labour.engine.ts
│       │       ├── system-accessories.engine.ts  # Brand-aware accessories
│       │       └── types.ts
│       ├── database/
│       │   ├── connection.ts          # SQLite (better-sqlite3, WAL)
│       │   ├── migrate.ts            # Schema + seeds (001–012)
│       │   └── migrations/           # 006–012 (brand support, wiring, data cleanup, Atess HPS)
│       └── index.ts                   # Express app entry
│
└── data/                      # SQLite DB file (epro.db)
```

## Supported Brands & System Classes

| Brand | System Classes | Topology | Inverters | Batteries |
|-------|---------------|----------|-----------|-----------|
| **Victron** | V5, V8, V10, V15 | Low voltage (48V), external MPPTs, battery | Multiplus-II 5-15kVA | FreedomWON 15kWh |
| **Atess HPS** | ATT30, ATT50, ATT100, ATT120, ATT150 | High voltage (400V), 3-phase, integrated MPPT | HPS 30-150kW hybrid | FreedomWON LiTE 100-500kWh HV |

> **Note:** Sungrow data was removed in Sprint 8. The multi-brand architecture supports re-adding — add topology in `brandTopology.ts`, seed products via migration, and add system currents to `voltage-drop-calculator.ts`.

## Rule Engine Sections (11 total)
`inverter`, `solar_panels`, `battery`, `dc_battery`, `pv_cabling`, `pv_dc_protection`, `ac_cabling`, `ac_protection`, `mounting`, `labour`, `travel`

## Test Data
- 3 clients: Test Client, Test Custie, Stiaan
- 32 quotes (all Victron — wizard V5/V8/V10, designer V5/V8/V10)
- 9 inverters (4 Victron Multiplus-II: V5/V8/V10/V15 + 5 Atess HPS: ATT30/50/100/120/150)
- 3 MPPTs (Victron), 6 batteries (1 FreedomWON 15kWh + 5 FreedomWON LiTE HV 100-500kWh)
- 85+ products across all categories (incl. commercial cables, 3-phase protection, HV fuses)

---

## What's Next

### Future Ideas
- Re-add Atess/Sungrow brands with real datasheet data (architecture ready)
- Quote versioning (snapshot BoM on each change)
- Email quote PDF to client
- Multi-user support with role-based access (sales vs admin views)
- Quote templates / clone existing quote
- Inventory tracking / stock availability
- Customer portal (read-only quote view via shared link)
- Export quotes to CSV/Excel
