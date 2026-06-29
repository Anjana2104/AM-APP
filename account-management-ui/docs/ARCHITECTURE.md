# Architecture

## Overview

EAM (Engagement & Account Management) is a single-page React application with a local Node.js/Express API server backed by a SQLite database.

```
┌─────────────────────────────────────────────┐
│              Browser (SPA)                  │
│  React 18 + Ant Design 5 + TypeScript       │
│  Vite build tool                            │
└───────────────────┬─────────────────────────┘
                    │ HTTP (localhost:5173 dev / dist/ prod)
                    ▼
┌─────────────────────────────────────────────┐
│          Express API Server                 │
│  Node.js + Express 4                        │
│  Port: 3001                                 │
│  server/index.js — entry point              │
└───────────────────┬─────────────────────────┘
                    │ better-sqlite3 / sql.js
                    ▼
┌─────────────────────────────────────────────┐
│              SQLite Database                │
│  server/db/connection.js                    │
│  server/data/*.db (file-based)              │
└─────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Entry Point
`src/main.tsx` → mounts `<App />` wrapped in `AuthProvider`, `ConfigProvider`, `NotificationProvider`, `UserPreferencesProvider`.

### Routing
Client-side routing via `window.history.pushState` — no React Router. `App.tsx` owns all page-switch logic with `activePage` state. Browser Back/Forward handled via `popstate` listener.

### Page Structure
```
src/
├── App.tsx                    — Root layout, sidebar nav, page router
├── pages/                     — Full-page components (one per feature)
│   ├── AccountSummary.tsx     — Executive / Account Summary dashboard
│   ├── AppSettings.tsx        — Settings > App Settings (dropdowns, app values,
│   │                            notification triggers, templates)
│   ├── ClientRequests.tsx     — Client Requests (Beeline requests)
│   ├── EngagementMapping.tsx  — Resource Engagement Mapping
│   │                            Tabs: Deployment Pool | Projects |
│   │                                  Forecasting | Utilization Insights
│   ├── EnhancedInsights.tsx   — Cross-resource insights (AI-assisted)
│   ├── FinanceManagement.tsx  — Finance > Revenue Management
│   ├── FinanceSummary.tsx     — Finance > Summary dashboard
│   ├── FinanceProjectTable.tsx— Reusable finance project grid
│   ├── InternalProcess.tsx    — Process > SOW/PIW management
│   ├── InvoiceManagement.tsx  — Finance > Invoice Management
│   ├── LoginPage.tsx          — Authentication page
│   ├── RateCard.tsx           — Information > Rate Card
│   ├── ResourceHub.tsx        — Resources > Resource Hub (CRUD)
│   ├── ResourceIntelligence.tsx — Resources > Resource Intelligence
│   ├── stakeholders/
│   │   ├── StakeholderNetwork.tsx — Clients > Stakeholders
│   │   ├── StakeholderFilterPanel.tsx — Stakeholder filters + quick team tags
│   │   └── stakeholderNetworkUtils.ts — Stakeholder shared helpers/layout/mappers
│   ├── UserAccessControl.tsx  — Settings > User Access Control
│   └── UserSettings.tsx       — Settings > User Settings
│                                 Tabs: Column Visibility | Notification Snooze
├── components/                — Shared reusable components
│   ├── ProcessDetailPanel.tsx — Process detail side panel
│   ├── RequestDetailPanel.tsx — Client request side panel
│   ├── ResourceDetailPanel.tsx— Resource detail side panel
│   ├── ResourceOverviewCharts.tsx — Charts for resource overview
│   └── TemplatesTab.tsx       — File template upload/download
├── api/                       — API client functions (fetch wrappers)
│   ├── aiApi.ts               — AI/LLM endpoints
│   ├── auditApi.ts            — Audit log read/write
│   ├── authApi.ts             — Login / user management
│   ├── configApi.ts           — App config types & items
│   ├── financeApi.ts          — Finance revenue data
│   ├── invoiceApi.ts          — Invoice data
│   ├── notificationApi.ts     — Notifications
│   ├── notificationTriggerApi.ts — Notification trigger rules
│   ├── piwApi.ts              — PIW generation
│   ├── processApi.ts          — ra_process CRUD
│   ├── requestApi.ts          — Client requests CRUD
│   ├── resourceApi.ts         — Resources CRUD
│   ├── resourceInsightsApi.ts — Resource Intelligence entries
│   ├── sowApi.ts              — SOW generation
│   ├── stakeholderNetworkApi.ts — Stakeholder network CRUD wrappers
│   ├── templateApi.ts         — Template file management
│   └── userPreferencesApi.ts  — User preferences
├── context/                   — React context providers
│   ├── AuthContext.tsx        — Current user + login state
│   ├── ConfigContext.tsx      — App config (dropdowns)
│   ├── NotificationContext.tsx— Notification polling + state
│   └── UserPreferencesContext.tsx — UI preference persistence
└── types/
    └── resource.ts            — Shared ResourceRow type
```

### State Management
- **No global store** (no Redux/Zustand) — state lives in page components
- Context used only for: auth session, app config, notifications, user prefs
- Cross-page navigation state passed via `App.tsx` props / callbacks

### Performance Patterns
- `useMemo` / `useCallback` for expensive derivations and stable callbacks
- `sessionStorage` for persisting selected resource across in-app navigation
- Ant Design `Table` virtual scroll for large datasets

---

## Backend Architecture

### Entry Point
`server/index.js` — runs DB migrations on startup, registers all Express routers, starts HTTP server on port 3001.

### Route Structure
```
server/
├── index.js                   — Server entry: migrations + route mount
├── routes/
│   ├── ai.js                  — POST /api/ai/* (OpenAI proxy)
│   ├── audit.js               — GET/POST /api/audit/*
│   ├── auth.js                — POST /api/auth/login, /logout
│   ├── config.js              — GET/POST/PUT/DELETE /api/config/*
│   ├── finance.js             — GET/POST/PUT/DELETE /api/finance/*
│   ├── invoices.js            — GET/POST/PUT/DELETE /api/invoice/*
│   ├── notification-triggers.js — /api/notification-triggers/*
│   │                              GET /relevant?userId= (persona-filtered)
│   ├── notifications.js       — /api/notifications/*
│   ├── piwGeneration.js       — POST /api/piwGeneration/generate
│   ├── process.js             — GET/POST/PUT/DELETE /api/process/*
│   ├── requests.js            — GET/POST/PUT/DELETE /api/requests/*
│   ├── resource-insights.js   — /api/resource-insights/*
│   ├── resources.js           — GET/POST/PUT/DELETE /api/resources/*
│   ├── roles.js               — /api/roles/*
│   ├── sowGeneration.js       — POST /api/sowGeneration/generate
│   ├── team-hierarchy.js      — GET/PUT /api/team-hierarchy/*
│   ├── templates.js           — GET/POST/DELETE /api/templates/*
│   ├── user-groups.js         — /api/user-groups/*
│   ├── user-preferences.js    — /api/user-preferences/*
│   └── users.js               — /api/users/*
├── db/
│   ├── connection.js          — SQLite singleton + sql.js adapter
│   ├── migrate.js             — Legacy standalone migration runner
│   ├── sqliteAdapter.js       — Browser-compatible sql.js wrapper
│   ├── seed.js                — Sample data seeding
│   ├── seed-config.js         — Config type/item seeding
│   └── seed-resources.js      — Resource sample data
├── utils/
│   └── evaluateTriggers.js    — Auto-fire notification triggers on data change
└── config/
    └── database.js            — DB client config
```

### Middleware Chain
```
CORS → express.json(10mb) → Routes → 404 handler → Error handler
```

### Audit Trail Pattern
Every data mutation route calls `POST /api/audit` to record:
- `module` (table name), `record_id`, `field`, `old_value`, `new_value`, `changed_by`
- The combined process audit endpoint (`GET /api/audit/process-combined/:id`) merges: field changes + resource linking events + engagement date changes.

### Notification Trigger Pattern
`utils/evaluateTriggers.js` is called after field updates. It queries `notification_triggers` for rules matching `(source_table, trigger_field)` and fires notifications to matched users/groups.

---

## Build & Run

```bash
# Frontend dev server (port 5173)
npm run dev

# Frontend production build → dist/
npm run build

# Backend server (port 3001)
cd server && node index.js

# DB migrations only (legacy)
cd server && node db/migrate.js
```

---

## Security Notes
- Passwords hashed with SHA-256 + static salt (`eam_salt_2024`)
- Role-based access: permissions stored as JSON in `roles.permissions`
- Page-level granularity: `{ view, edit, delete }` per page ID
- CORS restricted to configured origin (default: `http://localhost:5173`)
