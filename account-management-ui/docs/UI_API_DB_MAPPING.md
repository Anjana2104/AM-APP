# UI → API → Database Mapping

Each row maps a UI feature to its API endpoints and the database tables it reads/writes.

---

## Account Summary

| UI Component | API Endpoint | DB Tables |
|---|---|---|
| Revenue chart / tiles | `GET /api/finance/projects` | `finance_projects`, `finance_revenue` |
| Invoice chart | `GET /api/invoice/projects` | `invoice_projects`, `invoice_amounts` |
| Resource count | `GET /api/resources` | `resources` |
| Request count | `GET /api/requests` | `client_requests` |

---

## Finance > Revenue Management (`FinanceManagement`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Project list | `GET /api/finance/projects` | `finance_projects` |
| Add project | `POST /api/finance/projects` | `finance_projects` |
| Edit project | `PUT /api/finance/projects/:id` | `finance_projects` |
| Delete project | `DELETE /api/finance/projects/:id` | `finance_projects` |
| Monthly revenue grid | `GET /api/finance/revenue?projectId=` | `finance_revenue` |
| Save revenue cell | `POST /api/finance/revenue` | `finance_revenue` |
| Bulk import (Excel) | `POST /api/finance/projects/bulk` | `finance_projects`, `finance_revenue` |
| Export Excel | `GET /api/finance/export` | `finance_projects`, `finance_revenue` |

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
| Audit log (combined) | `GET /api/audit/process-combined/:id` | `audit_log` |
| Download files | `GET /api/process/:id/files` | `ra_process` |

---

## Information > Rate Card (`RateCard`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Rate data | `GET /api/config/items?typeId=rate_card` | `app_config_items` |

---

## Information > Team Hierarchy (`TeamHierarchy`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Hierarchy data | `GET /api/config/items?typeId=team_hierarchy` | `app_config_items` |

---

## Information > Code Guide (`CodeGuide`)

| UI Feature | API Endpoint | DB Tables |
|---|---|---|
| Guide content | `GET /api/config/items?typeId=code_guide` | `app_config_items` |

---

## App Settings (`AppSettings`)

Sub-tabs: **App Notifications** | **Templates** | **Dropdowns & Values**

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
