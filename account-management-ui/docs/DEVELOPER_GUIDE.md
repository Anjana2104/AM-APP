# Developer Guide

**EAM — Engagement & Account Management**  
Version 1.0 | July 2026 | Rockwell Automation — Internal Use Only

> This guide documents the coding standards, architecture patterns, and production-readiness rules that all contributors **must** follow. These conventions were established iteratively through the application's modularization and Redux migration phases and are enforced in all new code.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Redux State Management](#2-redux-state-management)
3. [Error Handling Standards](#3-error-handling-standards)
4. [Veracode / Security Standards](#4-veracode--security-standards)
5. [Console Logging Guidelines](#5-console-logging-guidelines)
6. [File & Component Naming Conventions](#6-file--component-naming-conventions)
7. [Modularization Rules](#7-modularization-rules)
8. [Backend Route Modularization](#8-backend-route-modularization)
9. [API Layer Standards](#9-api-layer-standards)
10. [Future Development Checklist](#10-future-development-checklist)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Ant Design 5 |
| State Management | Redux Toolkit (`@reduxjs/toolkit`, `react-redux`) |
| Build | Vite 8+ |
| API Client | Native `fetch` wrappers in `src/api/` |
| Backend | Node.js + Express 4 |
| Database | SQLite (via `better-sqlite3` / `sql.js`) |

---

## 2. Redux State Management

### 2.1 Rule: Redux-first for all shared server-backed data

If data is **used by more than one page** or **loaded from the server**, it belongs in a Redux slice — not local `useState`.

**What stays local (never in Redux):**
- Filter values, open/close state of drawers and modals
- Form field values
- Per-page row selections and pagination
- Temporary UI animation state

**What goes into Redux:**
- Server-fetched resource lists, request lists, finance/invoice datasets
- App shell navigation state (active page/module, sidebar state)
- Admin directory data (users, roles, groups)

### 2.2 Existing slices

| Slice | File | State |
|---|---|---|
| `resources` | `src/store/resourcesSlice.ts` | `items`, `loaded`, `fromServer` |
| `requests` | `src/store/requestsSlice.ts` | `items`, `loaded`, `fromServer`, `activeRequestOptions`, `activeRequestOptionsLoaded` |
| `financeData` | `src/store/financeDataSlice.ts` | `financeProjects`, `financeMonths`, `financeLoaded`, `invoiceProjects`, `invoiceMonths`, `invoiceLoaded` |
| `appShell` | `src/store/appShellSlice.ts` | `activeModule`, `activePage`, sidebar state, cross-page nav filters |
| `adminDirectory` | `src/store/adminDirectorySlice.ts` | `users`, `roles`, `groups` with per-entity loaded flags |

### 2.3 Always use typed hooks

```typescript
// ✅ CORRECT — always use the typed wrappers
import { useAppSelector, useAppDispatch } from '../store/hooks';

// ❌ WRONG — never import raw hooks directly
import { useSelector, useDispatch } from 'react-redux';
```

### 2.4 Skip-if-loaded pattern

Every page that consumes shared data must check the `loaded` flag before fetching:

```typescript
const resourcesLoaded = useAppSelector(s => s.resources.loaded);

useEffect(() => {
  if (resourcesLoaded) return;          // already in Redux — skip API call
  resourceApi.getResources()
    .then(data => {
      dispatch(setResourcesFromServer(data.map(mapResourceApiRowToResourceRow)));
    })
    .catch(err => {
      console.error('[ResourceHub] Failed to load resources:', err);
      message.error('Failed to load resources');
    });
}, [resourcesLoaded]);
```

### 2.5 Post-mutation refresh pattern

After **any** server mutation (create / update / delete / link), always refresh Redux:

```typescript
// After save/delete succeeds:
resourceApi.getResources()
  .then(data => dispatch(setResourcesFromServer(data.map(mapResourceApiRowToResourceRow))))
  .catch(err => console.error('[ResourceHub] Failed to refresh resources after save:', err));
```

### 2.6 Adding a new Redux slice

1. Create `src/store/yourFeatureSlice.ts` using `createSlice` from `@reduxjs/toolkit`
2. Always include a `loaded: boolean` flag (and optionally `fromServer: boolean`)
3. Register the reducer in `src/store/index.ts`
4. Update `docs/ARCHITECTURE.md` State Management section and `docs/WORKFLOW.md` Section 10

---

## 3. Error Handling Standards

### 3.1 All API calls must have `.catch()`

Every `fetch` / API wrapper call must have an explicit error handler. **Silent failures are not permitted.**

```typescript
// ✅ CORRECT
someApi.doSomething(payload)
  .then(result => {
    // success path
    message.success('Saved successfully');
  })
  .catch((err: unknown) => {
    console.error('[ModuleName] Operation failed:', err);
    message.error('Failed to save. Please try again.');
  });

// ❌ WRONG — no error handling
someApi.doSomething(payload).then(result => { /* ... */ });
```

### 3.2 User-facing error messages

- Always call `message.error(...)` (Ant Design) for any server error visible to the user
- Be specific: `'Failed to save booking'` not just `'Error'`
- Do not expose raw error messages from the server to end users

### 3.3 Staged operations (explicit save)

Mutations that require an explicit **Save** button (e.g., deletes in SOW/Invoice management) must:
- Stage changes locally in state first
- Only call the server API when the user clicks **Save**
- Never perform irreversible server operations automatically on click/row action

### 3.4 Validation before submission

- Validate all form inputs client-side before API submission
- For bulk uploads, validate **each row** and report row-level errors in the UI preview — do not silently skip invalid rows

---

## 4. Veracode / Security Standards

These rules are enforced to pass Veracode static analysis scans.

### 4.1 No dynamic SQL construction in frontend code

The frontend must never construct SQL strings. All database operations happen exclusively through the Express API layer.

### 4.2 No `innerHTML` / raw HTML injection

```typescript
// ❌ WRONG
element.innerHTML = userInput;
dangerouslySetInnerHTML={{ __html: userContent }}

// ✅ CORRECT — use React text nodes or DOMPurify if HTML is unavoidable
<span>{userInput}</span>
```

### 4.3 Sanitise all user inputs before use

- Never pass raw user input directly into API calls without trimming and type-checking
- For Excel uploads: validate and sanitize each cell value before constructing the payload

### 4.4 No secrets in source code

- Never commit API keys, database passwords, or auth tokens
- Environment-specific values go in `.env` files (excluded from git via `.gitignore`)
- Use `.env.example` files to document required variables without values

### 4.5 Dependency security

- Run `npm audit` before merging any PR that adds or upgrades dependencies
- Root: `npm audit --omit=dev`
- Server: `cd server && npm audit --omit=dev`
- Known safe-to-accept advisories (transitive, no fix available): `xlsx` / `exceljs` → `uuid` path injection (documented, monitored)
- `dompurify` is enforced via `overrides` in `package.json` for sanitization

### 4.6 Password handling

- Passwords are hashed server-side (SHA-256 + salt) — never stored in plaintext
- Never log passwords or auth tokens in console output

### 4.7 CORS

- CORS is restricted to configured origin (`http://localhost:5173` dev default)
- Update `CORS_ORIGIN` env var for production deployment — do not use wildcard (`*`) in production

---

## 5. Console Logging Guidelines

### 5.1 Production rules

| ✅ Allowed | ❌ Not Allowed |
|---|---|
| `console.error(...)` for caught errors | `console.log(...)` for debug output |
| `console.warn(...)` for recoverable issues | `console.log(...)` left in production builds |
| Diagnostic prefix: `[ModuleName] message: details` | Logging raw user data or auth tokens |

### 5.2 Format

Always prefix with the module/component name in square brackets:

```typescript
console.error('[FinanceManagement] Failed to load bookings:', err);
console.warn('[InternalProcess] PIW upload returned empty resource list');
```

### 5.3 Remove debug logs before merging

All `console.log` calls added during development must be removed before merging to `main`. Use the linter or a pre-commit check to catch stragglers.

---

## 6. File & Component Naming Conventions

### 6.1 Page files must match UI module names

File names must reflect the exact module label shown in the navigation sidebar:

| UI Label | Correct File Name | ❌ Old / Wrong Name |
|---|---|---|
| Finance Management / SOW | `FinanceManagement.tsx` | `SowManagement.tsx` |
| Internal Process | `InternalProcess.tsx` | — |
| Resource Intelligence | `ResourceIntelligence.tsx` | — |
| Stakeholders | `stakeholders/StakeholderNetwork.tsx` | `TeamHierarchy.tsx` |
| App Settings | `AppSettings.tsx` | — |

> `SowManagement.tsx` is retained as a thin re-export alias for router compatibility only — the implementation lives in `FinanceManagement.tsx`.

### 6.2 Sub-module files

Sub-module components live in a sub-directory named after the parent module:

```
src/pages/
├── finance/               ← Finance sub-modules
│   ├── ProjectBookingDrawer.tsx
│   ├── BulkBookingDrawer.tsx
│   ├── FinanceInsightsPanel.tsx
│   └── ...
├── internal-process/      ← Internal Process sub-modules
│   ├── ProcessInsightsPanel.tsx
│   ├── ProcessDetailViewPanel.tsx
│   ├── PiwCreateTabPanel.tsx
│   └── PiwUploadSubTabPanel.tsx
├── client-requests/       ← Client Requests sub-modules
│   ├── ClientRequestsFilterPanel.tsx
│   ├── BulkSelectionActionsBar.tsx
│   └── ...
├── resource/              ← Resource sub-modules
│   ├── ResourceResumesTab.tsx
│   └── resourceUploadUtils.ts
├── resource-intelligence/ ← Resource Intelligence sub-modules (extracted from ResourceIntelligence.tsx)
│   ├── resourceIntelligenceTypes.ts   ← shared constants, types, helpers
│   ├── EntryCard.tsx
│   ├── EntryModal.tsx
│   ├── CommentMiniCard.tsx
│   └── SectionTab.tsx
└── stakeholders/          ← Stakeholders sub-modules
    ├── StakeholderNetwork.tsx
    └── StakeholderFilterPanel.tsx
```

### 6.3 Utility and mapper files

| Pattern | Convention | Example |
|---|---|---|
| Row mappers | `*RowMappers.ts` | `resourceRowMappers.ts`, `processRowMappers.ts` |
| Upload utilities | `*UploadUtils.ts` | `resourceUploadUtils.ts`, `requestUploadUtils.ts` |
| Export utilities | `*ExportUtils.ts` | `financeInsightsExportUtils.ts`, `bookingExportUtils.ts` |
| Shared Excel writers | `utils/*.ts` | `styledExcelExport.ts`, `xlsxExport.ts` |
| Hooks | `use*.ts` | `useFinanceProjectInsights.ts`, `useFinanceInsightsActions.ts` |

---

## 7. Modularization Rules

### 7.1 When to extract a sub-module

Extract a component or utility when **any two** of these are true:
- The code block is > ~150 lines of JSX / logic
- The same logic appears in 2+ places
- The logic has a distinct, nameable responsibility (e.g., "PIW upload", "booking drawer")
- The parent file exceeds ~600 lines of code

### 7.2 Shared utilities first

Before adding new export logic, Excel generation, PNG export, or row-mapping code to a page file, check:
- `src/utils/exportChartAsPng.ts` — PNG chart export (`exportChartAsPng`, `captureElementAsPng`, `captureElementCanvas`)
- `src/utils/styledExcelExport.ts` — styled worksheet formatting + `getCurrentDateStamp()`
- `src/utils/xlsxExport.ts` — plain XLSX writer helpers (`writeJsonSheetFile`, `writeAoaSheetFile`, `writeMultiSheetFile`)
- `src/utils/moduleCleanupApi.ts` — module cleanup operations
- The module-level `*ExportUtils.ts` for the same module

**Never inline `html2canvas` boilerplate directly in a component.** Always use `exportChartAsPng` or `captureElementCanvas` from `src/utils/exportChartAsPng.ts`.

**Never inline `new Date().toISOString().slice(0, 10)` for filename dates.** Use `getCurrentDateStamp()` from `src/utils/styledExcelExport.ts`.

### 7.3 Don't duplicate row-mapping logic

Row-mapping (API response → UI row type) is always shared via a mapper file:
- Add to the relevant `*RowMappers.ts`
- Never inline the same object literal mapping in multiple components

---

## 8. Backend Route Modularization

### 8.1 Established pattern: domain sub-directory

When a route file grows beyond ~300 lines or spans multiple logical domains, split it into a sub-directory following this pattern (as done for `finance`):

```
server/routes/
├── finance.js              ← thin passthrough: module.exports = require('./finance/index')
└── finance/
    ├── index.js            ← assembles sub-routers with router.use('/', subRouter)
    ├── helpers.js          ← shared utility functions (no route handlers)
    ├── projects.js         ← project CRUD sub-domain
    ├── revenue.js          ← revenue sub-domain
    └── bookings.js         ← bookings sub-domain
```

**Why keep the top-level `finance.js`?** Node.js resolves `require('./routes/finance')` to the `.js` file before the directory. The passthrough pattern avoids changing `server/index.js` registrations.

### 8.2 Sub-domain rules

- Each sub-domain file exports one `express.Router()`
- No logic is shared between sub-domain files directly — all shared code goes in `helpers.js`
- Each route handler must have: `try/catch`, `logger.error(...)` on catch, and a user-safe error response

### 8.3 helpers.js pattern

Move to `helpers.js` any function that is:
- Used by 2+ route files in the same domain
- A pure utility with no HTTP logic (no `req`, `res`, `next` parameters)
- Reusable normalisation, audit logging, or formatting logic

### 8.4 Error response standards (backend)

```javascript
// ✅ CORRECT — structured error with console log
router.get('/projects', async (req, res) => {
  try {
    // ...
  } catch (err) {
    logger.error('[Finance/Projects] Failed to list projects:', err.message);
    res.status(500).json({ error: 'Failed to retrieve projects' });
  }
});

// ❌ WRONG — exposes raw stack trace / DB errors to client
catch (err) { res.status(500).json({ error: err.message }); }
```

Never expose raw `err.message` (which may contain SQL, paths, or internal details) in the JSON error response sent to clients. Log internally, return a safe summary.

### 8.5 Logger prefix convention

All `logger.error` / `logger.warn` calls must prefix with `[Domain/SubDomain]`:

```javascript
logger.error('[Finance/Bookings] Batch insert failed for project 42:', err.message);
logger.warn('[Finance/Projects] Bulk upload: no projects in payload');
```

---

## 9. API Layer Standards

### 9.1 All server calls go through `src/api/`

Never call `fetch(...)` directly from a page component. All HTTP calls are wrapped in typed functions in `src/api/`:

```typescript
// ✅ CORRECT
import * as resourceApi from '../api/resourceApi';
const data = await resourceApi.getResources();

// ❌ WRONG
const res = await fetch('/api/resources');
```

### 9.2 No hardcoded localhost URLs

No `http://localhost:3001/...` URLs in any frontend source file. All API paths must be relative (`/api/...`) so they work through the Vite proxy in dev and Nginx proxy in production.

### 9.3 Mutation confirmation

Destructive operations (delete, bulk delete, unlink all) must display an Ant Design `Modal.confirm(...)` before calling the server API.

---

## 10. Future Development Checklist

Use this checklist when implementing any new feature:

**State**
- [ ] Is the data shared across pages? → Add to an existing or new Redux slice
- [ ] Added `loaded` flag and skip-if-loaded check?
- [ ] Post-mutation path refreshes Redux?
- [ ] Used `useAppSelector` / `useAppDispatch` (never raw hooks)?

**Error Handling**
- [ ] All API calls have `.catch()` with `console.error` + `message.error`?
- [ ] Destructive actions have `Modal.confirm` before API call?
- [ ] Staged-save pattern used where explicit Save button is required?

**Code Quality**
- [ ] No `console.log` debug statements left in production code?
- [ ] No hardcoded `localhost` URLs?
- [ ] No `innerHTML` / `dangerouslySetInnerHTML` with unsanitized values?
- [ ] No secrets or tokens in source code?

**Naming & Structure**
- [ ] File name matches the UI module label?
- [ ] Sub-module extracted if parent file would exceed ~600 lines?
- [ ] Shared row-mapper / export helper reused instead of duplicated?

**Documentation**
- [ ] `docs/ARCHITECTURE.md` updated if new slice added?
- [ ] `docs/MODULE_FILE_FUNCTIONALITY_OVERVIEW.md` updated for new files?
- [ ] `docs/WORKFLOW.md` updated if new data-flow pattern introduced?
- [ ] User manual page updated if user-facing behavior changed?

---

> For architecture overview, see [ARCHITECTURE.md](./ARCHITECTURE.md).  
> For workflow diagrams, see [WORKFLOW.md](./WORKFLOW.md).  
> For database schema, see [DATABASE_DESIGN.md](./DATABASE_DESIGN.md).
