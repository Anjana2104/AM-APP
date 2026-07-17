# account-management-ui

## Latest Update Highlights (2026-07-07)

- Finance > Insights > Resource Insights now supports:
  - Active-only project quick toggle (default)
  - Resource Name filter (searchable multi-select)
  - Project-level PNG export from icon action
  - Improved active/inactive status visualization and refined filter layout
- Resource Hub now includes a Verification tab to compare recorded vs DOJ-calculated workex and highlight exp-range mismatches using fixed experience buckets (`0-3`, `3-5`, `5-8`, `8-10`, `10+`).
- App Settings > Manage Data now includes an App Notifications category with:
  - Notifications History backup/delete operations (current user visible scope)
  - Notification Triggers backup/delete operations (admin-managed trigger definitions)
- Resource role/domain handling hardening:
  - Role/Domain charts now split comma-separated values and aggregate case-insensitively.
  - Blank role/domain values are consistently labeled as **Unassigned** in insights click-through flows.
  - Resource download template includes a multi-role sample in `Role/Domain` (e.g., `Full Stack, DevOps`).
