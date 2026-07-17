# Module, File, and High-Level Functionality Overview

This document lists the primary modules, key files, and their high-level responsibilities.

## Redux State Store

| Module Area | File | High-Level Functionality |
|---|---|---|
| Redux store setup | `src/store/index.ts` | Configures the Redux store; exports `RootState` and `AppDispatch` types. |
| Typed hooks | `src/store/hooks.ts` | Exports `useAppDispatch` and `useAppSelector` typed hooks for use across all components. |
| Resources slice | `src/store/resourcesSlice.ts` | Shared resource list with `items`, `loaded`, and `fromServer` flags; dispatched by ResourceHub on load/save/upload. |
| Requests slice | `src/store/requestsSlice.ts` | Shared request list and active Beeline request options with load flags; dispatched by ClientRequests. |
| Finance data slice | `src/store/financeDataSlice.ts` | Shared finance project + month headers and invoice project + month headers; dispatched by FinanceManagement and InvoiceManagement, consumed by FinanceSummary and AccountSummary. |
| App shell slice | `src/store/appShellSlice.ts` | Active module/page, sidebar collapsed state, and cross-page navigation filters (resource role/RA-ID filters, request Beeline filters, initial SOW nav). |
| Admin directory slice | `src/store/adminDirectorySlice.ts` | Shared users, roles, and user groups with per-entity loaded flags; dispatched by UserAccessControl. |

## Finance Module

### Frontend

| Module Area | File | High-Level Functionality |
|---|---|---|
| Finance main page | `src/pages/FinanceManagement.tsx` | SOW Project Milestones + Insights workspace (Project/Booking sub-tabs, booking trends, unbooked drilldowns, export actions). |
| Finance UI-aligned alias | `src/pages/SowManagement.tsx` | Router-facing alias to align file naming with SOW workspace terminology while reusing `FinanceManagement` implementation. |
| Booking drawer | `src/pages/finance/ProjectBookingDrawer.tsx` | Project-level booking create/edit UI and validations. |
| Bulk booking drawer | `src/pages/finance/BulkBookingDrawer.tsx` | Bulk booking upload/edit flow with validation and save actions. |
| SOW Resource Insights tab | `src/pages/finance/FinanceSowResourceInsightsTab.tsx` | SOW-level Resource Insights view (project/sow grouping, active/inactive status filtering, resource-name filtering, project-level PNG export, and shared resource-history timeline reuse). |
| Booking upload utilities | `src/pages/finance/bookingUploadUtils.ts` | Booking Excel parsing, normalization, and upload-side validations. |
| Booking export utilities | `src/pages/finance/bookingExportUtils.ts` | Booking export/template generation for single and bulk flows. |
| Finance list/table | `src/pages/FinanceProjectTable.tsx` | Finance project tabular presentation and interactions. |
| Finance summary | `src/pages/FinanceSummary.tsx` | Finance KPI/summary view. |

### Backend API (`server/routes/finance/`)

| Module Area | File | High-Level Functionality |
|---|---|---|
| Finance router entry | `server/routes/finance.js` | Thin passthrough â€” delegates to `finance/index.js`. Required by `server/index.js`. |
| Finance index | `server/routes/finance/index.js` | Assembles revenue, projects, and bookings sub-routers under `/api/finance`. |
| Shared helpers | `server/routes/finance/helpers.js` | Month sort key, booking normalisation/validation, `insertBooking`, `formatBookingAuditValue`, `insertFinanceAudit`, `projectRecordName`, `auditProjectFieldChanges` â€” used by all sub-domain files. |
| Projects routes | `server/routes/finance/projects.js` | Finance project CRUD (`GET/POST/PUT/DELETE /projects`), bulk upsert upload, milestone-type upsert endpoint. Full audit trail and trigger evaluation. |
| Revenue routes | `server/routes/finance/revenue.js` | `GET /month-headers` â€” sorted list of distinct revenue months. |
| Bookings routes | `server/routes/finance/bookings.js` | Project bookings CRUD â€” single, batch, update, delete-one, delete-all-for-project, delete-all-global. Full audit trail per operation. |

## Resource Module

| Module Area | File | High-Level Functionality |
|---|---|---|
| Resource main page | `src/pages/ResourceHub.tsx` | End-to-end resource management (CRUD, filters, upload, exports, beeline links, insights integration). |
| Resource resumes tab | `src/pages/resource/ResourceResumesTab.tsx` | Resume upload/list/download helper workflow. |
| Resource verification tab | `src/pages/resource/ResourceVerificationTab.tsx` | Resource verification grid for RA ID/name/workex validation against DOJ-derived computed workex and fixed experience buckets (`0-3`, `3-5`, `5-8`, `8-10`, `10+`), with mismatch highlighting. |
| Resource upload utilities | `src/pages/resource/resourceUploadUtils.ts` | Resource Excel parsing, merge logic, and bulk-save payload mapping. Supports repeated RA IDs in one upload to load multiple project allocations for the same resource, merges allocation rows, preserves 0â€“200% per-project allocation values, and keeps imported resources in **Available** status unless an explicit pipeline/project status is supplied. **Implements append logic for multi-domain support**: during bulk update (upsert), new domains/roles are appended to existing ones (like skills) instead of replacing them; duplicates removed via Set. |
| Resource row mappers | `src/pages/resource/resourceRowMappers.ts` | Shared API-to-UI and API payload row normalization for resources, including parsing stored `allocation_entries` JSON into combined allocation totals, deduplicating repeated engagement names case-insensitively (space-insensitive), and deriving legacy summary fields from multi-allocation data. |
| Resource verification utilities | `src/pages/resource/resourceVerificationUtils.ts` | Shared workex parsing/truncation (no rounding), DOJ-to-years computation, and fixed experience-bucket resolution helpers for verification flows. |
| Resource intelligence | `src/pages/ResourceIntelligence.tsx` | Resource-focused analytics/intelligence main page (~1350 lines). Imports sub-modules from `resource-intelligence/` and reuses `components/ResourceOverviewCharts.tsx` for All Resources charts (including comma-split, case-insensitive Roles/Domains aggregation and `Unassigned` fallback for blank values). Displays multi-project allocation breakdown and combined utilization per resource. |
| RI shared constants/types | `src/pages/resource-intelligence/resourceIntelligenceTypes.ts` | SECTION_META, SectionKey, STATUS_COLOR, PRIORITY_COLOR, COMMENT_TAG_COLORS, fmtDate, fmtRelative, cleanVal, resolveCommentSection. Used by all RI sub-components and the main page. |
| RI entry card | `src/pages/resource-intelligence/EntryCard.tsx` | Card component for a single insight entry â€” shows tags, status, priority, author, actions. |
| RI entry modal | `src/pages/resource-intelligence/EntryModal.tsx` | Add/Edit modal for insight entries with section-specific form fields. |
| RI comment mini card | `src/pages/resource-intelligence/CommentMiniCard.tsx` | Compact card for linked resource comments mapped into section tabs. |
| RI section tab | `src/pages/resource-intelligence/SectionTab.tsx` | Full section tab (Interactions/Escalations/Career/Plans) with CRUD, filters, and comment linking. |
| Resource forecasting | `src/pages/ResourceForecasting.tsx` | Allocation/availability forecasting and exports. Uses combined multi-project allocation totals per resource; classifies resources as **Overutilized** when total allocation >100%, **Fully Allocated** at 100%, and **Underutilized** below 100%. |

## Client Requests Module

| Module Area | File | High-Level Functionality |
|---|---|---|
| Client requests main page | `src/pages/ClientRequests.tsx` | Request lifecycle management with filters, views, bulk actions, and integrations. |
| Request upload utilities | `src/pages/client-requests/requestUploadUtils.ts` | Request upload parse/merge/save payload helpers. |
| Request update utilities | `src/pages/client-requests/requestUpdateUtils.ts` | Shared request update payload construction for edit/bulk updates. |
| Request row mappers | `src/pages/client-requests/requestRowMappers.ts` | Request API row mapping and create payload shaping. |
| Request mappers/helpers | `src/pages/client-requests/clientRequestsMappers.ts` | Request config/date/resource mapping helpers reused in page logic. |
| Request filter panel | `src/pages/client-requests/ClientRequestsFilterPanel.tsx` | Reusable filter sidebar panel for request views. |
| Request menus | `src/pages/client-requests/clientRequestsMenus.tsx` | Centralized toolbar/card action menu item builders. |
| Bulk status content | `src/pages/client-requests/BulkStatusPopoverContent.tsx` | Shared status option rendering for bulk status updates. |
| Bulk action bar | `src/pages/client-requests/BulkSelectionActionsBar.tsx` | Shared selected-row bulk action controls and handlers wiring. |
| Request insights widgets | `src/pages/RequestInsightsChart.tsx`, `src/pages/EnhancedInsights.tsx` | Request analytics charts and insights dashboards. |

## Internal Process Module

| Module Area | File | High-Level Functionality |
|---|---|---|
| Internal process main page | `src/pages/InternalProcess.tsx` | Internal process orchestration (SOW/process/PIW flows, uploads, linking, exports). |
| Process insights panel | `src/pages/internal-process/ProcessInsightsPanel.tsx` | Process KPI/analytics including Process Progress Analysis (date-range filter, stage trend, detail export). |
| Process detail view panel | `src/pages/internal-process/ProcessDetailViewPanel.tsx` | Detailed process view and related actions. |
| PIW upload sub-tab | `src/pages/internal-process/PiwUploadSubTabPanel.tsx` | PIW upload workflow and mapping/linking interactions. |
| PIW create tab | `src/pages/internal-process/PiwCreateTabPanel.tsx` | PIW creation/generation flow with review warnings, allocation-aware calculations, and detail exports. |
| Process row mappers | `src/pages/internal-process/processRowMappers.ts` | Shared process row normalization, resequencing, save/export payload builders. |

## Stakeholders Module

| Module Area | File | High-Level Functionality |
|---|---|---|
| Stakeholders main page | `src/pages/stakeholders/StakeholderNetwork.tsx` | Stakeholder network workspace with directory/network views, search, filters, profile side panel, upload/export/template, and persistence orchestration. |
| Stakeholder comments panel | `src/pages/stakeholders/StakeholderCommentsPanel.tsx` | Stakeholder detail comments/audit panel with escalation resource linking and consolidated client comments tab. |
| Stakeholder filter panel | `src/pages/stakeholders/StakeholderFilterPanel.tsx` | Reusable filter popover panel and quick team-type tags for Stakeholders view. |
| Stakeholder utilities | `src/pages/stakeholders/stakeholderNetworkUtils.ts` | Shared Stakeholder helper logic (types, upload row merge mapping, graph layout computation, search/filter helpers). |
| Stakeholder API | `src/api/stakeholderNetworkApi.ts` | Stakeholder server health checks plus hierarchy, comments, comment-audit, and bulk-save API wrappers with operational diagnostics. |

## Shared / Cross-Module Utilities

Redux hooks are the preferred integration pattern for cross-page data sharing.

| Module Area | File | High-Level Functionality |
|---|---|---|
| Module cleanup API | `src/utils/moduleCleanupApi.ts` | Centralized utility for module-level cleanup operations (audit/comments artifacts). |
| Styled Excel export utility | `src/utils/styledExcelExport.ts` | Shared styled-sheet generation and `getCurrentDateStamp()` date suffix helper for exports. |
| Generic XLSX export utility | `src/utils/xlsxExport.ts` | Shared plain XLSX write helpers: `writeJsonSheetFile`, `writeAoaSheetFile`, `writeMultiSheetFile` for JSON/AOA template/export generation. |
| Chart PNG export utility | `src/utils/exportChartAsPng.ts` | Shared html2canvas wrappers: `exportChartAsPng` (direct download), `captureElementAsPng` (data URL for PDF), `captureElementCanvas` (raw canvas for PDF aspect-ratio), `buildPngFilename`. Replaces 11 identical inline boilerplate blocks. |
| Typed Redux hooks | `src/store/hooks.ts` | `useAppSelector` / `useAppDispatch` â€” required typed wrappers for all Redux store access. |

## API Layer

| Module Area | File | High-Level Functionality |
|---|---|---|
| Resource API | `src/api/resourceApi.ts` | All resource CRUD, bulk save, comments, Beeline links, process links. Uses relative `/api/resources` base path. Typed with `ResourcePayload` interface; all catch blocks use `catch (e: unknown)`. |
| Config API | `src/api/configApi.ts` | Config types and items CRUD, app values CRUD. Exports `ConfigType`, `ConfigItem`, `AppValue`, `ApiOk` interfaces. All functions are fully typed â€” no `any` return types. |
| Template API | `src/api/templateApi.ts` | Template upload/download/delete with SQLite-primary, localStorage-fallback dual mode. Uses relative `/api/templates` path (no hardcoded localhost). Exports `Template` interface; all functions typed. |
| PIW API | `src/api/piwApi.ts` | PIW Excel generation via server-side ExcelJS. Uses relative `/api/piwGeneration/generate` (no hardcoded localhost). Clean async/await with typed error handling. |
| SOW API | `src/api/sowApi.ts` | SOW document generation via server. Uses relative `/api/sowGeneration/generate` (no hardcoded localhost). Response error typed as `{ error?: string }`. |
| Auth API | `src/api/authApi.ts` | Login, logout, and user list operations against `/api/auth`. |
| Notification API | `src/api/notificationApi.ts` | Notification read/unread/history management. |
| Notification Rules API | `src/api/notificationRulesApi.ts` | Notification rules CRUD. |
| Process API | `src/api/processApi.ts` | Internal process (SOW/PIW tracking) server operations. |
| Request API | `src/api/requestApi.ts` | Client request CRUD and status updates. |

> **Security note:** All API files use relative paths (`/api/...`). The Vite dev server proxy (`vite.config.ts`) forwards these to `http://localhost:3001`. In production, serve both frontend and backend from the same origin, or configure a reverse proxy.


| Module Area | File | High-Level Functionality |
|---|---|---|
| App settings | `src/pages/AppSettings.tsx` | Configuration management for app values, notification triggers, templates, and data management. Now contains 5 tabs: App Notifications, Templates, Configs, App Values, **Manage Data**. |
| App settings export utils | `src/pages/app-settings/appSettingsExportUtils.ts` | Shared App Settings Excel template/export builders for configuration types and app values. |
| Manage Data tab | `src/pages/app-settings/ManageDataTab.tsx` | Centralised data management hub â€” page-wise backup (Excel export) and delete-all operations for all modules (Finance, Invoice, Resources, Requests, Process, Stakeholders, App Settings, Notifications). Uses double-confirm (type DELETE). Permission-gated per page ID. Reuses all existing API clients. |
| Engagement mapping | `src/pages/EngagementMapping.tsx` | Engagement-resource mapping and deployment updates. |
| Invoice management | `src/pages/InvoiceManagement.tsx` | Invoice data management, upload/edit, and exports. |
| Stakeholder network | `src/pages/stakeholders/StakeholderNetwork.tsx` | Stakeholder structure management and relationship-network operations. |
| User access control | `src/pages/UserAccessControl.tsx` | Role/permission configuration and access governance UI. |
| User settings | `src/pages/UserSettings.tsx` | User-level settings/preferences screen. |
| Project list | `src/pages/ProjectList.tsx` | Project registry/listing and related actions. |
| Account summary | `src/pages/AccountSummary.tsx` | Account-level summary dashboard. |
| Login page | `src/pages/LoginPage.tsx` | Application authentication entry UI. |
| Rate card | `src/pages/RateCard.tsx` | Rate band/reference management and display. |

