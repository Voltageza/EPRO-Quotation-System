# EPRO Quotation System — Progress Report

**Last updated:** 2026-02-08

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
│       │   └── components.api.ts  # Inverters, MPPTs, batteries
│       ├── pages/
│       │   ├── quotes/
│       │   │   ├── QuotesListPage.tsx
│       │   │   ├── QuoteWizardPage.tsx    ← Sprint 4
│       │   │   └── QuoteDetailPage.tsx    ← Sprint 4
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
│       │   ├── components.routes.ts
│       │   └── admin.routes.ts
│       ├── services/
│       │   ├── pdf-generator.ts       ← Sprint 4
│       │   ├── pricing.service.ts
│       │   └── rule-engine/           # 8 engine modules + types
│       ├── database/
│       │   ├── connection.ts          # SQLite (better-sqlite3, WAL)
│       │   └── migrate.ts            # Schema + seeds
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
