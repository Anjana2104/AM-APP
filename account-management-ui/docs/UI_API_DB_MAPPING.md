# UI → API → Database Mapping

Each row maps a UI feature to its API endpoints and the database tables it reads/writes.

> **Redux Caching Layer:** Several pages skip the API call entirely when their data is already loaded in the Redux store (`loaded` flag). The table below documents the server API — actual runtime behaviour may serve data directly from the Redux store. See `docs/WORKFLOW.md` Section 10 and `docs/ARCHITECTURE.md` State Management for the full Redux data-flow rules.
>
> Pages that consume Redux-cached data on first render: `AccountSummary`, `FinanceSummary`, `FinanceManagement`, `InvoiceManagement`, `ResourceHub`, `ClientRequests`, `InternalProcess`.

---

## Account Summary

| UI Component | API Endpoint | DB Tables |
|---|---|---|
| Revenue chart / tiles | `GET /api/finance/projects` | `finance_projects`, `finance_revenue` |
| Invoice chart | `GET /api/invoice/projects` | `invoice_projects`, `invoice_amounts` |
| Resource count | `GET /api/resources` | `resources` |
| Request count | `GET /api/requests` | `client_requests` |

---

## Finance > SOW Project Milestones & Insights (`FinanceManagement`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Project list | `GET /api/finance/projects` | `finance_projects` |
| Add project | `POST /api/finance/projects` | `finance_projects` |
| Edit project | `PUT /api/finance/projects/:id` | `finance_projects` |
| Delete project | `DELETE /api/finance/projects/:id` | `finance_projects` |
| Bulk import (Excel) | `POST /api/finance/projects/bulk` | `finance_projects`, `finance_revenue` |
| Milestone type updates | `PUT /api/finance/projects/:id/milestone-types` | `finance_revenue` |
| Project bookings list | `GET /api/finance/projects/:id/bookings` | `project_bookings` |
| Add booking | `POST /api/finance/projects/:id/bookings` | `project_bookings` |
| Update booking | `PUT /api/finance/projects/:id/bookings/:bookingId` | `project_bookings` |
| Delete booking | `DELETE /api/finance/projects/:id/bookings/:bookingId` | `project_bookings` |
| Add bookings batch | `POST /api/finance/projects/:id/bookings/batch` | `project_bookings` |
| Delete all project bookings | `DELETE /api/finance/projects/:id/bookings` | `project_bookings` |
| Insights export (PNG/Excel) | Client-side (`html2canvas`, `xlsx`) | — |

---

## Finance > Invoice Management (`InvoiceManagement`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Invoice project list | `GET /api/invoice/projects` | `invoice_projects` |
| Add / Edit / Delete | `POST/PUT/DELETE /api/invoice/projects/:id` | `invoice_projects` |
| Monthly amounts | `GET/POST /api/invoice/amounts` | `invoice_amounts` |

---

## Resources > Resource Hub (`ResourceHub`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Resource list | `GET /api/resources` | `resources` LEFT JOIN `ra_process` |
| Add resource | `POST /api/resources` | `resources` + `audit_log` |
| Edit resource | `PUT /api/resources/:id` | `resources` + `audit_log` |
| Bulk save | `PUT /api/resources/batch` | `resources` + `audit_log` |
| Delete resource | `DELETE /api/resources/:id` | `resources` |
| Upload Excel | `POST /api/resources/bulk-upload` | `resources` + `audit_log` |
| Link Beeline ID | `PUT /api/resources/:id/beeline` | `resources` + `audit_log` |
| Resource comments | `GET/POST /api/resources/:id/comments` | `resource_comments` |
| Edit/Delete comment | `PUT/DELETE /api/resources/:id/comments/:cid` | `resource_comments` |
| Audit log | `GET /api/audit/resources/:id` | `audit_log` |

---

## Resources > Resource Intelligence (`ResourceIntelligence`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Resource list | `GET /api/resources` | `resources` |
| Insights entries | `GET /api/resource-insights?resourceId=` | `resource_insights` |
| Add insight | `POST /api/resource-insights` | `resource_insights` |
| Edit insight | `PUT /api/resource-insights/:id` | `resource_insights` |
| Delete insight | `DELETE /api/resource-insights/:id` | `resource_insights` |
| Resource comments | `GET/POST /api/resources/:id/comments` | `resource_comments` |
| Cross-resource search | `GET /api/resource-insights/search?q=` | `resource_insights` |
| AI log summary | `POST /api/ai/summary` | (OpenAI API, no DB write) |
| Audit log | `GET /api/audit/resources/:id` | `audit_log` |
| PDF export | Client-side (jsPDF) | — |

---

## Resources > Engagement Mapping (`EngagementMapping`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Deployment Pool / Projects grid | `GET /api/resources` | `resources` LEFT JOIN `ra_process` |
| Update engagement | `PUT /api/resources/batch` | `resources` + `audit_log` |
| Forecasting tab — timeline view | `GET /api/resources` | `resources` |
| Forecasting — availability check | `GET /api/resources` (filtered) | `resources` |
| Forecasting — upcoming releases | `GET /api/resources` (date filtered) | `resources` |

---

## Client Requests (`ClientRequests`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Request list | `GET /api/requests` | `client_requests` |
| Add request | `POST /api/requests` | `client_requests` + `audit_log` |
| Edit request | `PUT /api/requests/:id` | `client_requests` + `audit_log` |
| Bulk import | `POST /api/requests/bulk` | `client_requests` |
| Delete request | `DELETE /api/requests/:id` | `client_requests` |
| Link resources | `POST /api/resources/:id/link-process` | `resources` + `audit_log` |
| Request comments | `GET/POST /api/requests/:id/comments` | `request_comments` |
| Insights (chart) | `GET /api/requests` | `client_requests` |
| Audit log | `GET /api/audit/client_requests/:id` | `audit_log` |

---

## Process > Internal Process (`InternalProcess`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Process list | `GET /api/process` | `ra_process` |
| Add process | `POST /api/process` | `ra_process` + `audit_log` |
| Edit process | `PUT /api/process/:id` | `ra_process` + `audit_log` |
| Bulk import | `POST /api/process/bulk` | `ra_process` |
| Delete process | `DELETE /api/process/:id` | `ra_process` |
| Link resources | `PUT /api/resources/:id/link-process` | `resources` + `audit_log` |
| Unlink resources | `PUT /api/resources/:id/link-process` (null) | `resources` + `audit_log` |
| Update engagement dates | `PUT /api/resources/batch` | `resources` + `audit_log` |
| Upload PIW | `POST /api/piwGeneration/upload` | `ra_process` + `audit_log` |
| Generate PIW | `POST /api/piwGeneration/generate` | (file output) |
| Generate SOW | `POST /api/sowGeneration/generate` | (file output) |
| Process progress insights (date-range + trend + detail export) | `GET /api/process` | `ra_process.step_completed_at`, `ra_process.start_date`, `ra_process.updated_at` |
| Audit log (combined) | `GET /api/audit/process-combined/:id` | `audit_log` |
| Download files | `GET /api/process/:id/files` | `ra_process` |

---

## Information > Rate Card (`RateCard`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Rate data from uploaded template | `GET /api/templates?type=rate_card_template`, `GET /api/templates/:id` | `templates` |

---

## Clients > Stakeholders (`StakeholderNetwork`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| List stakeholders by team type | `GET /api/team-hierarchy?teamType=client|ra` | `team_hierarchy_entries` |
| Save uploaded/edited stakeholder network | `PUT /api/team-hierarchy/:teamType/bulk` | `team_hierarchy_entries`, `audit_log` |

---

## App Settings (`AppSettings`)

Sub-tabs: **App Notifications** | **Templates** | **Configs** | **App Values** | **Manage Data**

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Dropdown type list | `GET /api/config/types` | `app_config_types` |
| Add/Edit type | `POST/PUT /api/config/types/:id` | `app_config_types` |
| Dropdown items | `GET /api/config/items?typeId=` | `app_config_items` |
| Add/Edit/Delete item | `POST/PUT/DELETE /api/config/items/:id` | `app_config_items` |
| Upload/Download items (bulk) | `POST /api/config/bulk-upload` | `app_config_items` |
| App values list | `GET /api/config/values` | `app_values` |
| Add/Edit/Delete app value | `POST/PUT/DELETE /api/config/values/:id` | `app_values` |
| Templates list | `GET /api/templates` | `templates` |
| Upload template | `POST /api/templates` | `templates` |
| Delete template | `DELETE /api/templates/:id` | `templates` |
| App notification triggers list | `GET /api/notification-triggers` | `notification_triggers` |
| Persona-filtered triggers | `GET /api/notification-triggers/relevant?userId=` | `notification_triggers`, `user_group_members`, `roles` |
| Add/Edit trigger | `POST/PUT /api/notification-triggers/:id` | `notification_triggers` |
| Delete trigger | `DELETE /api/notification-triggers/:id` | `notification_triggers` |
| Reorder triggers (DnD) | `PUT /api/notification-triggers/:id` (sort_order) | `notification_triggers` |

### Manage Data Tab

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Backup — SOW Finance Projects | `GET /api/finance/projects` → Excel export | `finance_projects`, `finance_revenue` |
| Delete All — SOW Finance Projects | `DELETE /api/finance/projects` | `finance_projects`, `finance_revenue`, `project_bookings` |
| Delete All — Finance Bookings | `DELETE /api/finance/bookings/all` | `project_bookings` |
| Backup — Invoice Projects | `GET /api/invoice/projects` → Excel export | `invoice_projects`, `invoice_amounts` |
| Delete All — Invoice Projects | `DELETE /api/invoice/projects` | `invoice_projects`, `invoice_amounts` |
| Backup — Resource Records | `GET /api/resources` → Excel export | `resources` |
| Delete All — Resource Records | `DELETE /api/resources` | `resources` |
| Delete Audit History — Resources | `DELETE /api/resources/all-audit` | `audit_log` (resources) |
| Delete Comments — Resources | `DELETE /api/resources/all-comments` | `resource_comments` |
| Backup — Client Requests | `GET /api/requests` → Excel export | `client_requests` |
| Delete All — Client Requests | `DELETE /api/requests` | `client_requests` |
| Delete Audit — Requests | `DELETE /api/requests/all-audit` | `audit_log` (requests) |
| Delete Comments — Requests | `DELETE /api/requests/all-comments` | `request_comments` |
| Backup — Process Records | `GET /api/process` → Excel export | `ra_process` |
| Delete All — Process Records | `DELETE /api/process` | `ra_process` |
| Delete Audit — Process | `DELETE /api/process/all-audit` | `audit_log` (process) |
| Delete Comments — Process | `DELETE /api/process/all-comments` | `process_comments` |
| Backup — Client Stakeholders | `GET /api/team-hierarchy?teamType=client` → Excel | `team_hierarchy_entries` |
| Delete All — Client Stakeholders | `PUT /api/team-hierarchy/client/bulk` (empty array) | `team_hierarchy_entries` |
| Backup — RA Stakeholders | `GET /api/team-hierarchy?teamType=ra` → Excel | `team_hierarchy_entries` |
| Delete All — RA Stakeholders | `PUT /api/team-hierarchy/ra/bulk` (empty array) | `team_hierarchy_entries` |
| Backup — Config Dropdown Types | `GET /api/config/` → Excel export | `app_config_types`, `app_config_items` |
| Delete All — Config Types | `DELETE /api/config/types` (via ConfigContext) | `app_config_types`, `app_config_items` |
| Backup — App Values | `GET /api/config/values` → Excel export | `app_values` |
| Delete All — App Values | `DELETE /api/config/values` (via ConfigContext) | `app_values` |

---

## User Access Control (`UserAccessControl`)

Sub-tabs: **Users** | **Roles & Permissions** | **User Groups**

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| User list | `GET /api/users` | `users` |
| Add/Edit user | `POST/PUT /api/users/:id` | `users` |
| Delete user | `DELETE /api/users/:id` | `users` |
| Role list | `GET /api/roles` | `roles` |
| Add/Edit role | `POST/PUT /api/roles/:id` | `roles` |
| Update permissions matrix | `PUT /api/roles/:id/permissions` | `roles` |
| User groups list | `GET /api/user-groups` | `user_groups` |
| Add/Edit group | `POST/PUT /api/user-groups/:id` | `user_groups` |
| Delete group | `DELETE /api/user-groups/:id` | `user_groups` |
| Group members (Transfer) | `GET/POST /api/user-groups/:id/members` | `user_group_members` |

---

## User Settings (`UserSettings`)

Sub-tabs: **Column Visibility** | **Notification Snooze**

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Load preferences | `GET /api/user-preferences/:userId` | `user_preferences` |
| Save column visibility | `PUT /api/user-preferences/:userId` | `user_preferences` |
| Notification snooze list | `GET /api/user-preferences/:userId` (snooze_rules) | `user_preferences` |
| Add/Edit/Delete snooze rule | `PUT /api/user-preferences/:userId` | `user_preferences` |
| Relevant triggers dropdown | `GET /api/notification-triggers/relevant?userId=` | `notification_triggers`, `user_group_members`, `roles` |

---

## Notifications (global, `App.tsx`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Notification bell list | `GET /api/notifications?userId=` | `notifications` |
| Mark read | `PUT /api/notifications/:id/read` | `notifications` |
| Send notification | `POST /api/notifications` | `notifications` |
| Auto-triggers | (server-side via `evaluateTriggers`) | `notification_triggers` → `notifications` |

---

## Audit Log (cross-cutting)

| Source | Write endpoint | Read endpoint |
|---|---|---|
| Any field edit | `POST /api/audit` | `GET /api/audit/:module/:recordId` |
| Process (combined) | `POST /api/audit` (multiple) | `GET /api/audit/process-combined/:id` |
